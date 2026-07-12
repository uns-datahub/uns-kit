import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowEvalCaseFromTraceCandidate,
  buildAssistantWorkflowTraceEvalCandidate,
  buildAssistantWorkflowTraceSummary,
  collectAssistantWorkflowTraceTuningSignals,
  hasAssistantWorkflowConstrainedToolSelectionEvidence,
  isAssistantWorkflowErrorTraceStage,
  readAssistantWorkflowTraceUserMessagePreview,
  type AssistantWorkflowTraceEvent,
} from "../src/index.js";

describe("assistant workflow trace replay", () => {
  it("exposes shared trace classification helpers", () => {
    expect(isAssistantWorkflowErrorTraceStage("tool.call.error")).toBe(true);
    expect(isAssistantWorkflowErrorTraceStage("direct.value.route.error")).toBe(true);
    expect(isAssistantWorkflowErrorTraceStage("tool.call")).toBe(false);
    expect(readAssistantWorkflowTraceUserMessagePreview("chat.request.start", {
      message: "  Show me latest values.  ",
    })).toBe("Show me latest values.");
    expect(readAssistantWorkflowTraceUserMessagePreview("schema_advisory.request", {
      key: "MaterialTemperature",
    })).toBe("MaterialTemperature");
    expect(readAssistantWorkflowTraceUserMessagePreview("user.message", {
      content: "1234567890",
    }, { limit: 6 })).toBe("123...");
    expect(readAssistantWorkflowTraceUserMessagePreview("user.message", {
      content: "1234567890",
    }, { limit: 6, omission: "…" })).toBe("12345…");
  });

  it("preserves structured artifact evidence from a tool call", () => {
    const summary = buildAssistantWorkflowTraceSummary([{
      stage: "tool.call",
      payload: {
        tool: "get_multi_attribute_batch",
        structuredArtifactKinds: ["table"],
      },
    }]);

    expect(summary.toolCalls).toEqual([expect.objectContaining({
      tool: "get_multi_attribute_batch",
      structuredArtifactKinds: ["table"],
    })]);
  });

  it("retains the workflow revision that produced a tool-selection trace", () => {
    const summary = buildAssistantWorkflowTraceSummary([{
      stage: "tool_selection.workflow_comparison",
      payload: {
        intent: "table_view",
        workflowRun: {
          workflowId: "support-agent",
          workflowVersion: 2,
        },
      },
    }]);

    expect(summary.workflow).toMatchObject({
      workflowId: "support-agent",
      workflowVersion: 2,
      intent: "table_view",
    });
  });

  it("retains flat workflow identity when a bounded trace omits workflowRun", () => {
    const summary = buildAssistantWorkflowTraceSummary([{
      stage: "tool_selection.workflow_comparison",
      payload: {
        intent: "table_view",
        workflowId: "support-agent",
        workflowVersion: 4,
        workflowAuthorityProfileKeys: ["table_view|profiles:unresolved_scope_resolver"],
      },
    }]);

    expect(summary.workflow).toMatchObject({
      workflowId: "support-agent",
      workflowVersion: 4,
      intent: "table_view",
      workflowAuthorityProfileKeys: ["table_view|profiles:unresolved_scope_resolver"],
    });
  });

  it("preserves intent write-policy shadow evidence from memory patch traces", () => {
    const summary = buildAssistantWorkflowTraceSummary([{
      stage: "assistant_workflow.memory_patch",
      payload: {
        intentWritePolicy: {
          intentId: "chart_single",
          writeSlots: ["topic_of_interest"],
          changedSlots: ["topic_of_interest"],
          appliedPatchCount: 1,
          skippedPatchCount: 1,
          skippedPatches: [{
            slotId: "preferred_time_window",
            operation: "set",
            reason: "write-not-allowed",
          }],
          profilePatchEquivalent: false,
          profilePatchComparedFields: ["preferredTimeWindow"],
          profilePatchMismatchedFields: ["preferredTimeWindow"],
        },
      },
    }]);

    expect(summary.memoryPatches[0]?.intentWritePolicy).toEqual({
      intentId: "chart_single",
      writeSlots: ["topic_of_interest"],
      missingMemorySlots: [],
      changedSlots: ["topic_of_interest"],
      appliedPatchCount: 1,
      skippedPatchCount: 1,
      skippedPatches: [{
        slotId: "preferred_time_window",
        operation: "set",
        reason: "write-not-allowed",
      }],
      profilePatchEquivalent: false,
      profilePatchComparedFields: ["preferredTimeWindow"],
      profilePatchMismatchedFields: ["preferredTimeWindow"],
    });
  });

  it("does not treat an unpruned full catalog as workflow selection evidence", () => {
    const summary = buildAssistantWorkflowTraceSummary([{
      stage: "tool_selection.workflow_comparison",
      payload: {
        intent: "table_view",
        pruningEnabled: false,
        selectedMode: "full",
        workflowSuggestedTools: ["get_attribute_data_view"],
        workflowSelectionCandidateTools: ["get_attribute_data_view"],
        missingWorkflowSelectionCandidateTools: ["get_attribute_data_view"],
        selectedOutsideWorkflowSelectionCandidate: ["list_uns_tree", "search_uns_nodes"],
      },
    }]);

    expect(summary.workflow).toMatchObject({
      toolSelectionPruningEnabled: false,
      toolSelectionMode: "full",
    });
    expect(hasAssistantWorkflowConstrainedToolSelectionEvidence(summary.workflow!)).toBe(false);
    expect(collectAssistantWorkflowTraceTuningSignals(summary)).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "workflow_suggested_not_selected" }),
      expect.objectContaining({ name: "selected_outside_workflow" }),
    ]));
  });

  it("preserves actual provider tool selections separately from workflow candidates", () => {
    const summary = buildAssistantWorkflowTraceSummary([{
      stage: "tools.selected",
      payload: {
        hop: 1,
        mode: "full",
        reason: "workflow_equivalent",
        toolPruningEnabled: false,
        toolCount: 1,
        totalToolCount: 29,
        schemaCostSource: "effective_selected_tool_definitions_v1",
        approxSchemaChars: 681,
        approxSavedChars: 32140,
        tools: ["get_attribute_latest_values"],
      },
    }]);

    expect(summary.toolSelections).toEqual([{
      stage: "tools.selected",
      hop: 1,
      mode: "full",
      reason: "workflow_equivalent",
      pruningEnabled: false,
      toolCount: 1,
      totalToolCount: 29,
      schemaCostSource: "effective_selected_tool_definitions_v1",
      approxSchemaChars: 681,
      approxSavedChars: 32140,
      toolNames: ["get_attribute_latest_values"],
    }]);
  });

  it("uses invoked tools rather than a pruned prompt catalog for unmodeled-tool signals", () => {
    const baseEvents: AssistantWorkflowTraceEvent[] = [
      {
        stage: "planner_classifier.done",
        payload: { intent: "table_view" },
      },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "table_view",
          pruningEnabled: true,
          selectedMode: "pruned",
          workflowSuggestedTools: ["get_attribute_data_view"],
          selectedOutsideWorkflowSelectionCandidate: ["search_uns_nodes"],
        },
      },
    ];

    expect(collectAssistantWorkflowTraceTuningSignals(buildAssistantWorkflowTraceSummary(baseEvents)))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "selected_outside_workflow" }),
      ]));

    const invoked = buildAssistantWorkflowTraceSummary([
      ...baseEvents,
      { stage: "tool.call", payload: { tool: "search_uns_nodes" } },
    ]);
    expect(collectAssistantWorkflowTraceTuningSignals(invoked)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: "selected_outside_workflow",
        detail: "search_uns_nodes",
      }),
    ]));
  });

  it("keeps conditional planning profile ids in trace summaries and eval candidates", () => {
    const events: AssistantWorkflowTraceEvent[] = [
      { stage: "chat.request.start", payload: { message: "Show latest event chart." } },
      {
        stage: "planner_classifier.done",
        payload: {
          intent: "chart_single",
          presentation: "chart",
          confidence: 0.91,
          toolsToExpose: ["get_attribute_data_view", "get_instance_journey"],
        },
      },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "chart_single",
          effectivePresentation: "chart",
          workflowSuggestedTools: ["get_attribute_data_view", "get_instance_journey"],
          workflowSelectionCandidateTools: ["get_attribute_data_view", "get_instance_journey"],
          missingToolHints: [],
          missingRequiredToolHints: [],
          extraClassifierTools: [],
          missingWorkflowSuggestedTools: [],
          selectedOutsideWorkflowSuggestions: [],
          plan: {
            stepIds: ["resolve_topic", "fetch_instance_journey", "build_chart"],
            activePlanningStepProfileIds: ["last_event_lifecycle_context"],
            profileStepIds: ["fetch_instance_journey"],
            missingPlanningSteps: [],
            missingToolHints: [],
            missingRequiredToolHints: [],
            executionHints: { producesArtifact: true },
          },
        },
      },
      {
        stage: "assistant_workflow.direct_route_policy",
        payload: {
          intent: "chart_single",
          route: "structured",
          enabled: true,
          reason: "enabled",
          policyRouteIds: ["structured"],
        },
      },
      {
        stage: "assistant_workflow.direct_route_gap",
        payload: {
          handlerId: "direct_structured_view",
          layer: "direct_route.structured_view",
          route: "structured",
          reason: "Structured view spans multiple intents.",
        },
      },
      {
        stage: "direct.structured.route.done",
        payload: {
          reason: "handled",
          strategy: "last_event_interval",
          topic: "factory/line-1/material/slab-001/temperature",
          tool: "get_attribute_data_view",
          mode: "structured",
          handled: true,
          contentChars: 256,
          tookMs: 84,
        },
      },
      {
        stage: "direct.value.route.error",
        payload: {
          reason: "tool_failed",
          strategy: "attribute_intent",
          topic: "factory/line-1/material/slab-001/temperature",
          tool: "get_attribute_latest_values",
          tookMs: 12,
        },
      },
      {
        stage: "assistant_workflow.outcome",
        payload: {
          source: "direct_route_dispatch",
          layer: "direct_route.structured_view",
          skipEvent: "direct.structured.route.skip",
          kind: "direct_route",
          handled: true,
          contentChars: 256,
          reason: "handled",
          route: "structured",
        },
      },
      {
        stage: "assistant_workflow.memory_patch",
        payload: {
          changedSlots: ["topic_of_interest", "preferred_presentation"],
          changedProfileFields: ["topicOfInterest", "preferredPresentation"],
          appliedPatchCount: 2,
          skippedPatchCount: 1,
          appliedPatches: [
            { slotId: "topic_of_interest", operation: "set", changed: true },
            { slotId: "preferred_presentation", operation: "set", changed: true },
          ],
          skippedPatches: [
            { slotId: "artifact_context", operation: "set", reason: "unknown-slot" },
          ],
          profilePatchEquivalent: true,
          profilePatchComparedFields: ["topicOfInterest", "preferredPresentation"],
          profilePatchMismatchedFields: [],
          patchDerivation: "classification",
          profileWriteMode: "shadow",
          profileWriteSource: "legacy_accumulator",
          profileWriteReason: "shadow_mode",
        },
      },
      {
        stage: "thread.profile.updated",
        payload: {
          changed: true,
          changedFields: ["topicOfInterest", "preferredPresentation"],
          writeMode: "shadow",
          writeSource: "legacy_accumulator",
          writeReason: "shadow_mode",
        },
      },
    ];

    const summary = buildAssistantWorkflowTraceSummary(events);
    const candidate = buildAssistantWorkflowTraceEvalCandidate(summary);
    const evalCase = candidate
      ? buildAssistantWorkflowEvalCaseFromTraceCandidate(candidate, { tags: ["trace"] })
      : null;

    expect(summary.workflow?.plan).toMatchObject({
      activePlanningStepProfileIds: ["last_event_lifecycle_context"],
      profileStepIds: ["fetch_instance_journey"],
    });
    expect(summary.directRoutePolicies).toEqual([
      {
        stage: "assistant_workflow.direct_route_policy",
        intent: "chart_single",
        route: "structured",
        enabled: true,
        reason: "enabled",
        policyRouteIds: ["structured"],
      },
    ]);
    expect(summary.directRouteGaps).toEqual([
      {
        stage: "assistant_workflow.direct_route_gap",
        handlerId: "direct_structured_view",
        layer: "direct_route.structured_view",
        route: "structured",
        reason: "Structured view spans multiple intents.",
      },
    ]);
    expect(summary.directRoutes).toEqual([
      expect.objectContaining({
        route: "structured",
        outcome: "done",
        strategy: "last_event_interval",
        topic: "factory/line-1/material/slab-001/temperature",
        tool: "get_attribute_data_view",
        tookMs: 84,
      }),
      expect.objectContaining({
        route: "value",
        outcome: "error",
        reason: "tool_failed",
        strategy: "attribute_intent",
        tool: "get_attribute_latest_values",
        tookMs: 12,
      }),
    ]);
    expect(summary.outcomes).toEqual([
      expect.objectContaining({
        kind: "direct_route",
        handled: true,
        route: "structured",
        source: "direct_route_dispatch",
        layer: "direct_route.structured_view",
      }),
    ]);
    expect(summary.handledOutcome).toEqual(expect.objectContaining({
      kind: "direct_route",
      route: "structured",
    }));
    expect(summary.memoryPatches).toEqual([
      {
        stage: "assistant_workflow.memory_patch",
        changedSlots: ["topic_of_interest", "preferred_presentation"],
        changedProfileFields: ["topicOfInterest", "preferredPresentation"],
        appliedPatchCount: 2,
        skippedPatchCount: 1,
        appliedPatches: [
          { slotId: "topic_of_interest", operation: "set", changed: true },
          { slotId: "preferred_presentation", operation: "set", changed: true },
        ],
        skippedPatches: [
          { slotId: "artifact_context", operation: "set", reason: "unknown-slot" },
        ],
        profilePatchEquivalent: true,
        profilePatchComparedFields: ["topicOfInterest", "preferredPresentation"],
        profilePatchMismatchedFields: [],
        patchDerivation: "classification",
        profileWriteMode: "shadow",
        profileWriteSource: "legacy_accumulator",
        profileWriteReason: "shadow_mode",
        intentWritePolicy: null,
      },
    ]);
    expect(summary.threadProfileWrites).toEqual([
      {
        stage: "thread.profile.updated",
        changed: true,
        changedFields: ["topicOfInterest", "preferredPresentation"],
        writeMode: "shadow",
        writeSource: "legacy_accumulator",
        writeReason: "shadow_mode",
      },
    ]);
    expect(candidate).toMatchObject({
      expectedActivePlanningStepProfileIds: ["last_event_lifecycle_context"],
      expectedProfileStepIds: ["fetch_instance_journey"],
    });
    expect(evalCase).toMatchObject({
      expectations: {
        activePlanningStepProfileIds: ["last_event_lifecycle_context"],
        profileStepIds: ["fetch_instance_journey"],
      },
    });
  });

  it("preserves runtime tool binding policy evidence", () => {
    const summary = buildAssistantWorkflowTraceSummary([
      {
        stage: "assistant_workflow.tool_binding_runtime",
        payload: {
          toolName: "get_server_time",
          status: "policy-drift",
          capabilityProvider: "local-function",
          bindingProvider: "local-function",
          runtimeAdapterId: "controller-chat-tool-runtime",
          policyMismatches: [{
            field: "enabled",
            expected: true,
            actual: false,
          }],
        },
      },
    ]);

    expect(summary.toolRuntimeBindings).toEqual([{
      stage: "assistant_workflow.tool_binding_runtime",
      toolName: "get_server_time",
      status: "policy-drift",
      capabilityProvider: "local-function",
      bindingProvider: "local-function",
      runtimeAdapterId: "controller-chat-tool-runtime",
      policyMismatchFields: ["enabled"],
    }]);
  });

  it("preserves structured-artifact and clarification outcome trace rows", () => {
    const events: AssistantWorkflowTraceEvent[] = [
      {
        stage: "assistant_workflow.outcome",
        payload: {
          source: "final_answer",
          layer: "post_hop.structured_fast_path",
          kind: "structured_artifact",
          handled: true,
          contentChars: 128,
          artifactKind: "chart",
          mode: "structured_tool_output",
          submode: "chart_artifact",
          tool: "get_attribute_data_view",
          streamed: false,
        },
      },
      {
        stage: "assistant_workflow.outcome",
        payload: {
          source: "final_answer",
          layer: "in_hop.disambiguation_clarification",
          kind: "clarification",
          handled: true,
          contentChars: 42,
          reason: "attribute_disambiguation",
          mode: "structured_disambiguation_clarification",
          ruleId: "attribute_disambiguation",
          streamed: false,
        },
      },
    ];

    const summary = buildAssistantWorkflowTraceSummary(events);

    expect(summary.outcomes).toEqual([
      expect.objectContaining({
        kind: "structured_artifact",
        handled: true,
        artifactKind: "chart",
        layer: "post_hop.structured_fast_path",
        mode: "structured_tool_output",
        submode: "chart_artifact",
        tool: "get_attribute_data_view",
        streamed: false,
      }),
      expect.objectContaining({
        kind: "clarification",
        handled: true,
        reason: "attribute_disambiguation",
        layer: "in_hop.disambiguation_clarification",
        mode: "structured_disambiguation_clarification",
        ruleId: "attribute_disambiguation",
        streamed: false,
      }),
    ]);
    expect(summary.handledOutcome).toEqual(expect.objectContaining({
      kind: "clarification",
      reason: "attribute_disambiguation",
    }));
  });

  it("preserves clarification workflow comparisons and mismatch tuning signals", () => {
    const events: AssistantWorkflowTraceEvent[] = [
      {
        stage: "clarification.workflow_comparison",
        payload: {
          intent: "table_view",
          expectedRuleIds: ["ambiguous_topic_scope"],
          expectedBlockingRuleIds: ["ambiguous_topic_scope"],
          expectedSuggestedRuleIds: [],
          produced: true,
          observedRuleId: "attribute_disambiguation",
          equivalentRuleIds: ["attribute_disambiguation", "ambiguous_topic_scope"],
          matched: true,
          missingExpectedRuleIds: [],
          unexpectedObservedRuleId: null,
          source: "attribute_disambiguation_runtime",
          layer: "direct_route.attribute_disambiguation",
        },
      },
      {
        stage: "clarification.workflow_comparison",
        payload: {
          intent: "value_lookup",
          expectedRuleIds: ["ambiguous_topic_scope"],
          expectedBlockingRuleIds: ["ambiguous_topic_scope"],
          expectedSuggestedRuleIds: [],
          produced: false,
          observedRuleId: null,
          equivalentRuleIds: [],
          matched: false,
          missingExpectedRuleIds: ["ambiguous_topic_scope"],
          unexpectedObservedRuleId: null,
          source: "attribute_disambiguation_runtime",
          layer: "direct_route.attribute_disambiguation",
          reason: "no_runtime_clarification",
        },
      },
      {
        stage: "assistant_workflow.memory_patch",
        payload: {
          changedSlots: ["preferred_presentation"],
          changedProfileFields: ["preferredPresentation"],
          appliedPatchCount: 1,
          skippedPatchCount: 0,
          appliedPatches: [
            { slotId: "preferred_presentation", operation: "set", changed: true },
          ],
          skippedPatches: [],
          profilePatchEquivalent: false,
          profilePatchComparedFields: ["preferredPresentation"],
          profilePatchMismatchedFields: ["preferredPresentation"],
          profileWriteMode: "guarded",
          profileWriteSource: "legacy_fallback",
          profileWriteReason: "profile_patch_mismatch",
        },
      },
    ];

    const summary = buildAssistantWorkflowTraceSummary(events);
    const candidate = buildAssistantWorkflowTraceEvalCandidate(summary);
    const signals = collectAssistantWorkflowTraceTuningSignals(summary);

    expect(summary.clarificationComparisons).toEqual([
      expect.objectContaining({
        intent: "table_view",
        observedRuleId: "attribute_disambiguation",
        equivalentRuleIds: ["attribute_disambiguation", "ambiguous_topic_scope"],
        matched: true,
        missingExpectedRuleIds: [],
      }),
      expect.objectContaining({
        intent: "value_lookup",
        produced: false,
        matched: false,
        missingExpectedRuleIds: ["ambiguous_topic_scope"],
        reason: "no_runtime_clarification",
      }),
    ]);
    expect(candidate).toBeNull();
    expect(signals).toEqual([
      {
        name: "missing_classifier",
        severity: "info",
        detail: "turn did not emit planner_classifier.done",
      },
      {
        name: "clarification_runtime_mismatch",
        severity: "warning",
        detail: "missing ambiguous_topic_scope",
      },
      {
        name: "workflow_memory_patch_mismatch",
        severity: "warning",
        detail: "preferredPresentation",
      },
    ]);
  });
});
