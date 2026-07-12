import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowMemoryPatchReadiness,
  buildAssistantWorkflowIntentMemoryPolicyReadiness,
  buildAssistantWorkflowSerializedRunReportsFromTraceReport,
  buildAssistantWorkflowToolSelectionMetricReadiness,
  buildAssistantWorkflowTraceReport,
  serializeAssistantWorkflowSerializedRunReports,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowTraceReportSourceRow,
} from "../src/index.js";

describe("assistant workflow trace report", () => {
  it("scopes all report output to recorded workflow identity and version", () => {
    const traceEvents = (
      workflowId: string | null,
      workflowVersion: number | null,
      qualityFlagged = false,
    ) => [
      { stage: "planner_classifier.done", payload: { intent: "table_view" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "table_view",
          ...(workflowId && workflowVersion
            ? { workflowRun: { workflowId, workflowVersion } }
          : {}),
        },
      },
      ...(qualityFlagged
        ? [{ stage: "quality.signals.flagged", payload: { triggered: ["expected_artifact_missing"] } }]
        : []),
    ];
    const report = buildAssistantWorkflowTraceReport([
      { requestId: "req-v1", traceEvents: traceEvents("support-agent", 1, true) },
      { requestId: "req-v2", traceEvents: traceEvents("support-agent", 2) },
      { requestId: "req-untracked", traceEvents: traceEvents(null, null) },
    ], {
      workflowIds: ["support-agent"],
      workflowVersions: [2],
    });

    expect(report).toMatchObject({
      workflowIds: ["support-agent"],
      workflowVersions: [2],
      sourceRowCount: 3,
      scopedSourceRowCount: 1,
      rowCount: 1,
      qualityFlaggedRowCount: 0,
      suggestions: [],
    });
    expect(report.rows.map((row) => row.requestId)).toEqual(["req-v2"]);
  });

  it("does not suggest definition changes from an unpruned full tool catalog", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-full-catalog",
      traceEvents: [
        {
          stage: "planner_classifier.done",
          payload: { intent: "table_view" },
        },
        {
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
        },
      ],
    }]);

    expect(report.tuningSignalCounts).toEqual([]);
    expect(report.suggestions).toEqual([]);
  });

  it("proposes tool hints only for unmodeled tools that were actually invoked", () => {
    const workflowTrace = (requestId: string, tool: string) => ({
      requestId,
      traceEvents: [
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
        { stage: "tool.call", payload: { tool } },
      ],
    });
    const report = buildAssistantWorkflowTraceReport([
      workflowTrace("req-modeled", "get_attribute_data_view"),
      workflowTrace("req-unmodeled", "search_uns_nodes"),
    ]);

    expect(report.tuningSignalCounts).toEqual([
      { name: "selected_outside_workflow", severity: "info", count: 1 },
    ]);
    expect(report.suggestions).toEqual([
      expect.objectContaining({
        kind: "review_unmodeled_selected_tool",
        intent: "table_view",
        tool: "search_uns_nodes",
        requestIds: ["req-unmodeled"],
      }),
    ]);
  });

  it("aggregates actual provider tool costs by intent and runtime authority segment", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-value-1",
      traceEvents: [
        { stage: "planner_classifier.done", payload: { intent: "value_lookup" } },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "value_lookup",
            authority: { source: "workflow", reason: "workflow_equivalent" },
          },
        },
        {
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
        },
      ],
    }, {
      requestId: "req-value-2",
      traceEvents: [
        { stage: "planner_classifier.done", payload: { intent: "value_lookup" } },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "value_lookup",
            authority: { source: "workflow", reason: "workflow_equivalent" },
          },
        },
        {
          stage: "tools.selected",
          payload: {
            hop: 1,
            mode: "full",
            reason: "workflow_equivalent",
            toolPruningEnabled: false,
            toolCount: 1,
            totalToolCount: 29,
            schemaCostSource: "effective_selected_tool_definitions_v1",
            approxSchemaChars: 701,
            approxSavedChars: 32120,
            tools: ["get_attribute_latest_values"],
          },
        },
      ],
    }]);

    expect(report.effectiveToolSelectionModeCounts).toEqual([{ key: "full", count: 2 }]);
    expect(report.effectiveToolSelectionReasonCounts).toEqual([{ key: "workflow_equivalent", count: 2 }]);
    expect(report.effectiveToolSelectionToolCounts).toEqual([{ key: "get_attribute_latest_values", count: 2 }]);
    expect(report.effectiveToolSelectionSegments).toEqual([expect.objectContaining({
      segmentKey: "workflow_id:unknown|workflow_version:unknown|workflow_profile:none|intent:value_lookup|hop:1|mode:full|reason:workflow_equivalent|pruning:false|tools:get_attribute_latest_values|schema_cost:effective_selected_tool_definitions_v1|authority:workflow|authority_reason:workflow_equivalent",
      workflowId: null,
      workflowVersion: null,
      workflowProfileKey: null,
      toolSignature: "get_attribute_latest_values",
      toolNames: ["get_attribute_latest_values"],
      selectionCount: 2,
      toolCountObservationCount: 2,
      toolCountTotal: 2,
      averageToolCount: 1,
      totalToolCountObservationCount: 2,
      totalToolCountTotal: 58,
      averageTotalToolCount: 29,
      schemaCostSource: "effective_selected_tool_definitions_v1",
      schemaCharsObservationCount: 2,
      schemaCharsTotal: 1382,
      averageSchemaChars: 691,
      savedCharsObservationCount: 2,
      savedCharsTotal: 64260,
      averageSavedChars: 32130,
    })]);
  });

  it("does not mix unmarked historical schema costs with versioned runtime measurements", () => {
    const traceEvents = (schemaCostSource: string | null, approxSchemaChars: number) => [
      { stage: "planner_classifier.done", payload: { intent: "value_lookup" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "value_lookup",
          authority: { source: "workflow", reason: "workflow_authority_enabled" },
        },
      },
      {
        stage: "tools.selected",
        payload: {
          hop: 1,
          mode: "full",
          reason: "workflow_authority_enabled",
          toolPruningEnabled: false,
          toolCount: 1,
          totalToolCount: 29,
          ...(schemaCostSource ? { schemaCostSource } : {}),
          approxSchemaChars,
          approxSavedChars: 0,
          tools: ["get_attribute_latest_values"],
        },
      },
    ];
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-historical",
      traceEvents: traceEvents(null, 32097),
    }, {
      requestId: "req-versioned",
      traceEvents: traceEvents("effective_selected_tool_definitions_v1", 681),
    }]);

    expect(report.effectiveToolSelectionSegments).toEqual(expect.arrayContaining([
      expect.objectContaining({
        schemaCostSource: null,
        schemaCharsTotal: 32097,
        selectionCount: 1,
      }),
      expect.objectContaining({
        schemaCostSource: "effective_selected_tool_definitions_v1",
        schemaCharsTotal: 681,
        selectionCount: 1,
      }),
    ]));
    expect(report.effectiveToolSelectionSegments).toHaveLength(2);
  });

  it("keeps tool-selection evidence separate for distinct actual provider tool sets", () => {
    const traceEvents = (toolNames: string[]) => [
      { stage: "planner_classifier.done", payload: { intent: "chart_compare_multi" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "chart_compare_multi",
          authority: { source: "workflow", reason: "workflow_authority_enabled" },
        },
      },
      {
        stage: "tools.selected",
        payload: {
          hop: 1,
          mode: "full",
          reason: "workflow_authority_enabled",
          toolPruningEnabled: false,
          toolCount: toolNames.length,
          totalToolCount: 29,
          schemaCostSource: "effective_selected_tool_definitions_v1",
          approxSchemaChars: 4_990,
          approxSavedChars: 27_107,
          tools: toolNames,
        },
      },
    ];
    const report = buildAssistantWorkflowTraceReport([
      { requestId: "req-series-1", traceEvents: traceEvents(["get_multi_attribute_data_series", "resolve_topic_path"]) },
      { requestId: "req-series-2", traceEvents: traceEvents(["resolve_topic_path", "get_multi_attribute_data_series"]) },
      { requestId: "req-series-3", traceEvents: traceEvents(["get_multi_attribute_data_series", "resolve_topic_path"]) },
      { requestId: "req-batch-1", traceEvents: traceEvents(["get_batch_comparison_chart", "resolve_topic_path"]) },
    ]);
    const readiness = buildAssistantWorkflowToolSelectionMetricReadiness(report, {
      intentIds: ["chart_compare_multi"],
      schemaCostSource: "effective_selected_tool_definitions_v1",
      minSelectionCount: 3,
    });

    expect(readiness).toMatchObject({
      status: "insufficient_evidence",
      readySegmentCount: 1,
      insufficientEvidenceSegmentCount: 1,
      segments: expect.arrayContaining([
        expect.objectContaining({
          toolSignature: "get_multi_attribute_data_series,resolve_topic_path",
          selectionCount: 3,
          status: "ready_for_review",
        }),
        expect.objectContaining({
          toolSignature: "get_batch_comparison_chart,resolve_topic_path",
          selectionCount: 1,
          status: "insufficient_evidence",
        }),
      ]),
    });
  });

  it("requires clean, versioned actual tool-selection evidence before policy review", () => {
    const traceEvents = (options: {
      schemaCostSource?: string;
      qualityFlagged?: boolean;
      unavailable?: boolean;
    } = {}) => [
      { stage: "planner_classifier.done", payload: { intent: "value_lookup" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "value_lookup",
          authority: { source: "workflow", reason: "workflow_authority_enabled" },
        },
      },
      {
        stage: "tools.selected",
        payload: {
          hop: 1,
          mode: "full",
          reason: "workflow_authority_enabled",
          toolPruningEnabled: false,
          toolCount: 1,
          totalToolCount: 29,
          ...(options.schemaCostSource ? { schemaCostSource: options.schemaCostSource } : {}),
          approxSchemaChars: 681,
          approxSavedChars: 31416,
          tools: ["get_attribute_latest_values"],
        },
      },
      ...(options.qualityFlagged
        ? [{ stage: "quality.signals.flagged", payload: { triggered: ["expected_artifact_missing"] } }]
        : []),
      ...(options.unavailable
        ? [{
            stage: "assistant_workflow.outcome",
            payload: {
              kind: "unavailable",
              handled: true,
              artifactKind: "chart",
              reason: "no_series_data",
            },
          }]
        : []),
    ];
    const versionedSource = "effective_selected_tool_definitions_v1";
    const cleanReport = buildAssistantWorkflowTraceReport([
      { requestId: "req-clean-1", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      { requestId: "req-clean-2", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      { requestId: "req-clean-3", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      { requestId: "req-historical", traceEvents: traceEvents() },
    ]);
    const cleanReadiness = buildAssistantWorkflowToolSelectionMetricReadiness(cleanReport, {
      intentIds: ["value_lookup"],
      schemaCostSource: versionedSource,
      minSelectionCount: 3,
    });

    expect(cleanReadiness).toMatchObject({
      status: "ready_for_review",
      readyForReview: true,
      evaluatedSelectionCount: 3,
      readySegmentCount: 1,
      ignoredSchemaCostSourceSelectionCount: 1,
      ignoredSchemaCostSourceCounts: [{ key: "unknown", count: 1 }],
      segments: [{
        selectionCount: 3,
        qualityFlaggedSelectionCount: 0,
        errorSelectionCount: 0,
        badFeedbackSelectionCount: 0,
        unavailableOutcomeSelectionCount: 0,
        status: "ready_for_review",
      }],
    });

    const blockedReport = buildAssistantWorkflowTraceReport([
      { requestId: "req-blocked-1", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      { requestId: "req-blocked-2", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      {
        requestId: "req-blocked-quality",
        traceEvents: traceEvents({ schemaCostSource: versionedSource, qualityFlagged: true }),
      },
    ]);
    const blockedReadiness = buildAssistantWorkflowToolSelectionMetricReadiness(blockedReport, {
      intentIds: ["value_lookup"],
      schemaCostSource: versionedSource,
      minSelectionCount: 3,
    });

    expect(blockedReadiness).toMatchObject({
      status: "blocked",
      readyForReview: false,
      blockedSegmentCount: 1,
      segments: [expect.objectContaining({
        qualityFlaggedSelectionCount: 1,
        status: "blocked",
        blockingReasons: ["quality_flagged_selection_count_exceeds_maximum:1/0"],
      })],
    });

    const unavailableReport = buildAssistantWorkflowTraceReport([
      { requestId: "req-unavailable-1", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      { requestId: "req-unavailable-2", traceEvents: traceEvents({ schemaCostSource: versionedSource }) },
      {
        requestId: "req-unavailable-terminal",
        traceEvents: traceEvents({ schemaCostSource: versionedSource, unavailable: true }),
      },
    ]);
    const unavailableReadiness = buildAssistantWorkflowToolSelectionMetricReadiness(unavailableReport, {
      intentIds: ["value_lookup"],
      schemaCostSource: versionedSource,
      minSelectionCount: 3,
    });

    expect(unavailableReadiness).toMatchObject({
      status: "blocked",
      readyForReview: false,
      blockedSegmentCount: 1,
      segments: [expect.objectContaining({
        unavailableOutcomeSelectionCount: 1,
        status: "blocked",
        blockingReasons: ["unavailable_outcome_selection_count_exceeds_maximum:1/0"],
      })],
    });
  });

  it("can scope tool-selection evidence to a workflow revision", () => {
    const traceEvents = (workflowVersion: number, qualityFlagged = false) => [
      { stage: "planner_classifier.done", payload: { intent: "table_view" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "table_view",
          workflowRun: {
            workflowId: "support-agent",
            workflowVersion,
          },
          authority: { source: "workflow", reason: "workflow_authority_enabled" },
        },
      },
      {
        stage: "tools.selected",
        payload: {
          hop: 1,
          mode: "full",
          reason: "workflow_authority_enabled",
          toolPruningEnabled: false,
          toolCount: 2,
          totalToolCount: 29,
          schemaCostSource: "effective_selected_tool_definitions_v1",
          approxSchemaChars: 2_211,
          approxSavedChars: 30_039,
          tools: ["resolve_topic_path", "get_attribute_data_view"],
        },
      },
      ...(qualityFlagged
        ? [{ stage: "quality.signals.flagged", payload: { triggered: ["expected_artifact_missing"] } }]
        : []),
    ];
    const report = buildAssistantWorkflowTraceReport([
      { requestId: "req-v1-quality", traceEvents: traceEvents(1, true) },
      { requestId: "req-v2-clean-1", traceEvents: traceEvents(2) },
      { requestId: "req-v2-clean-2", traceEvents: traceEvents(2) },
      { requestId: "req-v2-clean-3", traceEvents: traceEvents(2) },
    ]);

    const readiness = buildAssistantWorkflowToolSelectionMetricReadiness(report, {
      workflowIds: ["support-agent"],
      workflowVersions: [2],
      intentIds: ["table_view"],
      schemaCostSource: "effective_selected_tool_definitions_v1",
      minSelectionCount: 3,
    });

    expect(readiness).toMatchObject({
      status: "ready_for_review",
      readyForReview: true,
      workflowIds: ["support-agent"],
      workflowVersions: [2],
      evaluatedSelectionCount: 3,
      segments: [expect.objectContaining({
        workflowId: "support-agent",
        workflowVersion: 2,
        selectionCount: 3,
        qualityFlaggedSelectionCount: 0,
        status: "ready_for_review",
      })],
    });
  });

  it("keeps tool-selection metrics separate for exact active profile combinations", () => {
    const traceEvents = (profileIds: string[], authoritySource = "workflow") => [
      { stage: "planner_classifier.done", payload: { intent: "table_view" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          intent: "table_view",
          workflowRun: {
            workflowId: "support-agent",
            workflowVersion: 3,
          },
          workflowSelectionActiveProfileIds: profileIds,
          authority: { source: authoritySource, reason: "workflow_authority_enabled" },
        },
      },
      {
        stage: "tools.selected",
        payload: {
          hop: 1,
          mode: "full",
          reason: "workflow_authority_enabled",
          toolPruningEnabled: false,
          toolCount: 2,
          totalToolCount: 29,
          schemaCostSource: "effective_selected_tool_definitions_v1",
          approxSchemaChars: 2_211,
          approxSavedChars: 30_039,
          tools: ["resolve_topic_path", "get_attribute_data_view"],
        },
      },
    ];
    const locationProfileKey = "table_view|profiles:unresolved_scope_resolver";
    const report = buildAssistantWorkflowTraceReport([
      { requestId: "req-location-1", traceEvents: traceEvents(["unresolved_scope_resolver"]) },
      { requestId: "req-location-2", traceEvents: traceEvents(["unresolved_scope_resolver"]) },
      { requestId: "req-location-3", traceEvents: traceEvents(["unresolved_scope_resolver"]) },
      {
        requestId: "req-batch",
        traceEvents: traceEvents(["unresolved_scope_resolver", "multi_attribute_table_discovery"]),
      },
      {
        requestId: "req-legacy-location",
        traceEvents: traceEvents(["unresolved_scope_resolver"], "legacy-pruner"),
      },
    ]);

    const readiness = buildAssistantWorkflowToolSelectionMetricReadiness(report, {
      workflowIds: ["support-agent"],
      workflowVersions: [3],
      workflowProfileKeys: [locationProfileKey],
      authoritySources: ["workflow"],
      intentIds: ["table_view"],
      schemaCostSource: "effective_selected_tool_definitions_v1",
      minSelectionCount: 3,
    });

    expect(readiness).toMatchObject({
      status: "ready_for_review",
      workflowProfileKeys: [locationProfileKey],
      authoritySources: ["workflow"],
      evaluatedSelectionCount: 3,
      segments: [expect.objectContaining({
        workflowProfileKey: locationProfileKey,
        selectionCount: 3,
        status: "ready_for_review",
      })],
    });
  });

  it("does not treat a direct route without provider tools as tool-selection evidence", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-direct-table",
      traceEvents: [
        { stage: "planner_classifier.done", payload: { intent: "table_view" } },
        {
          stage: "assistant_workflow.outcome",
          payload: {
            kind: "direct_route",
            handled: true,
            route: "structured",
          },
        },
      ],
    }]);
    const readiness = buildAssistantWorkflowToolSelectionMetricReadiness(report, {
      intentIds: ["table_view"],
      schemaCostSource: "effective_selected_tool_definitions_v1",
      minSelectionCount: 3,
    });

    expect(readiness).toMatchObject({
      status: "insufficient_evidence",
      readyForReview: false,
      evaluatedSelectionCount: 0,
      readySegmentCount: 0,
      blockingReasons: ["no_tool_selection_segments_in_scope"],
    });
  });

  it("aggregates conditional planning profile counts separately from tool-selection profiles", () => {
    const sourceRows: AssistantWorkflowTraceReportSourceRow[] = [{
      requestId: "req-chart",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "Show latest event chart." } },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "chart_single",
            workflowSuggestedTools: ["get_attribute_data_view", "get_instance_journey"],
            workflowSelectionActiveProfileIds: ["follow_up_chart_tools"],
            workflowSelectionProfileTools: ["get_instance_journey"],
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
            intent: "value_lookup",
            route: "value",
            enabled: true,
            reason: "enabled",
            policyRouteIds: ["value"],
          },
        },
        {
          stage: "direct.value.route.done",
          payload: {
            reason: "handled",
            strategy: "attribute_intent",
            topic: "factory/line-1/temperature",
            tool: "get_attribute_latest_values",
            mode: "tool_text",
            contentChars: 120,
            tookMs: 35,
          },
        },
        {
          stage: "direct.instance_journey.route.skip",
          payload: {
            reason: "tool_did_not_return_structured_content",
            tool: "get_instance_journey",
          },
        },
        {
          stage: "direct.structured.route.recovered",
          payload: {
            reason: "container_hint_disambiguation",
            strategy: "last_event_interval",
            topic: "factory/line-1/zone-1/temperature",
          },
        },
        {
          stage: "direct.structured.route.error",
          payload: {
            reason: "tool_failed",
            strategy: "last_event_interval",
            topic: "factory/line-1/zone-1/temperature",
            tool: "get_attribute_data_view",
          },
        },
        {
          stage: "assistant_workflow.direct_route_policy",
          payload: {
            intent: "unit_conversion",
            route: "unit",
            enabled: false,
            reason: "runtime_disabled",
            policyRouteIds: ["unit"],
          },
        },
        {
          stage: "assistant_workflow.direct_route_gap",
          payload: {
            handlerId: "direct_unit_conversion",
            layer: "direct_route.unit_conversion",
            route: "unit",
            reason: "Unit conversion is a follow-up transformation.",
          },
        },
        {
          stage: "direct.unit.route.skip",
          payload: {
            reason: "runtime_policy_disabled",
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
      ],
    }];

    const report = buildAssistantWorkflowTraceReport(sourceRows);

    expect(report.workflowSelectionActiveProfileCounts).toEqual([
      { key: "follow_up_chart_tools", count: 1 },
    ]);
    expect(report.workflowSelectionProfileToolCounts).toEqual([
      { key: "get_instance_journey", count: 1 },
    ]);
    expect(report.activePlanningStepProfileCounts).toEqual([
      { key: "last_event_lifecycle_context", count: 1 },
    ]);
    expect(report.profileStepCounts).toEqual([
      { key: "fetch_instance_journey", count: 1 },
    ]);
    expect(report.directRoutePolicyEnabledCounts).toEqual([
      { key: "value", count: 1 },
    ]);
    expect(report.directRoutePolicyDisabledReasonCounts).toEqual([
      { key: "unit:runtime_disabled", count: 1 },
    ]);
    expect(report.directRouteGapReasonCounts).toEqual([
      { key: "unit:Unit conversion is a follow-up transformation.", count: 1 },
    ]);
    expect(report.directRouteObservedStrategyCounts).toEqual([
      { key: "structured:last_event_interval", count: 2 },
      { key: "value:attribute_intent", count: 1 },
    ]);
    expect(report.directRouteUndeclaredStrategyCounts).toEqual([]);
    expect(report.directRouteDoneCounts).toEqual([
      { key: "value", count: 1 },
    ]);
    expect(report.directRouteRecoveredCounts).toEqual([
      { key: "structured", count: 1 },
    ]);
    expect(report.directRouteErrorCounts).toEqual([
      { key: "structured", count: 1 },
    ]);
    expect(report.directRouteSkipReasonCounts).toEqual([
      { key: "instance_journey:tool_did_not_return_structured_content", count: 1 },
    ]);
    expect(report.memoryChangedSlotCounts).toEqual([
      { key: "preferred_presentation", count: 1 },
      { key: "topic_of_interest", count: 1 },
    ]);
    expect(report.memoryChangedProfileFieldCounts).toEqual([
      { key: "preferredPresentation", count: 1 },
      { key: "topicOfInterest", count: 1 },
    ]);
    expect(report.memorySkippedPatchReasonCounts).toEqual([
      { key: "artifact_context:set:unknown-slot", count: 1 },
    ]);
    expect(report.memoryPatchEquivalenceCounts).toEqual([
      { key: "equivalent", count: 1 },
    ]);
    expect(report.memoryPatchDerivationCounts).toEqual([
      { key: "classification", count: 1 },
    ]);
    expect(report.memoryPatchMismatchedProfileFieldCounts).toEqual([]);
    expect(report.memoryPatchWriteSourceCounts).toEqual([
      { key: "shadow:legacy_accumulator", count: 1 },
    ]);
    expect(report.memoryPatchWriteReasonCounts).toEqual([
      { key: "shadow_mode", count: 1 },
    ]);
    expect(report.memoryIntentWritePolicyIntentCounts).toEqual([
      { key: "chart_single", count: 1 },
    ]);
    expect(report.memoryIntentWritePolicyEquivalenceCounts).toEqual([
      { key: "mismatch", count: 1 },
    ]);
    expect(report.memoryIntentWritePolicySkippedPatchReasonCounts).toEqual([
      { key: "preferred_time_window:set:write-not-allowed", count: 1 },
    ]);
    expect(report.memoryIntentWritePolicyMismatchedProfileFieldCounts).toEqual([
      { key: "preferredTimeWindow", count: 1 },
    ]);
    expect(report.threadProfileWriteChangedFieldCounts).toEqual([
      { key: "preferredPresentation", count: 1 },
      { key: "topicOfInterest", count: 1 },
    ]);
    expect(report.threadProfileWriteSourceCounts).toEqual([
      { key: "shadow:legacy_accumulator", count: 1 },
    ]);
    expect(report.threadProfileWriteReasonCounts).toEqual([
      { key: "shadow_mode", count: 1 },
    ]);
    expect(buildAssistantWorkflowMemoryPatchReadiness(report)).toMatchObject({
      status: "ready",
      ready: true,
      minEquivalentPatchCount: 1,
      equivalentPatchCount: 1,
      mismatchPatchCount: 0,
      unknownPatchCount: 0,
      totalPatchCount: 1,
      guardedWorkflowWriteCount: 0,
      workflowModePatchWriteCount: 0,
      minWorkflowModePatchWriteCount: 0,
      workflowPatchWriteCount: 0,
      minWorkflowPatchWriteCount: 0,
      guardedLegacyFallbackCount: 0,
      patchDerivationCounts: [{ key: "classification", count: 1 }],
      requiredPatchDerivationCounts: [],
      blockingReasons: [],
    });
    expect(buildAssistantWorkflowMemoryPatchReadiness(report, {
      minPatchDerivationCounts: [{ key: "classification", minCount: 1 }],
    })).toMatchObject({
      status: "ready",
      requiredPatchDerivationCounts: [{ key: "classification", count: 1 }],
      blockingReasons: [],
    });
    expect(buildAssistantWorkflowMemoryPatchReadiness(report, {
      minPatchDerivationCounts: [{ key: "classification", minCount: 2 }],
    })).toMatchObject({
      status: "insufficient_evidence",
      ready: false,
      blockingReasons: ["patch_derivation_count_below_minimum:classification:1/2"],
    });
    expect(report.rows[0]?.summary.directRoutes).toEqual([
      expect.objectContaining({
        stage: "direct.value.route.done",
        route: "value",
        outcome: "done",
        strategy: "attribute_intent",
        topic: "factory/line-1/temperature",
        tool: "get_attribute_latest_values",
        tookMs: 35,
      }),
      expect.objectContaining({
        stage: "direct.instance_journey.route.skip",
        route: "instance_journey",
        outcome: "skip",
        reason: "tool_did_not_return_structured_content",
      }),
      expect.objectContaining({
        stage: "direct.structured.route.recovered",
        route: "structured",
        outcome: "recovered",
        reason: "container_hint_disambiguation",
        strategy: "last_event_interval",
        topic: "factory/line-1/zone-1/temperature",
      }),
      expect.objectContaining({
        stage: "direct.structured.route.error",
        route: "structured",
        outcome: "error",
        reason: "tool_failed",
        strategy: "last_event_interval",
        topic: "factory/line-1/zone-1/temperature",
        tool: "get_attribute_data_view",
      }),
      expect.objectContaining({
        stage: "direct.unit.route.skip",
        route: "unit",
        outcome: "skip",
        reason: "runtime_policy_disabled",
      }),
    ]);
    expect(report.rows[0]?.summary.directRouteGaps).toEqual([
      expect.objectContaining({
        handlerId: "direct_unit_conversion",
        layer: "direct_route.unit_conversion",
        route: "unit",
        reason: "Unit conversion is a follow-up transformation.",
      }),
    ]);
    expect(report.rows[0]?.summary.memoryPatches).toEqual([
      expect.objectContaining({
        changedSlots: ["topic_of_interest", "preferred_presentation"],
        changedProfileFields: ["topicOfInterest", "preferredPresentation"],
        appliedPatchCount: 2,
        skippedPatchCount: 1,
        profilePatchEquivalent: true,
        profilePatchComparedFields: ["topicOfInterest", "preferredPresentation"],
        profilePatchMismatchedFields: [],
        patchDerivation: "classification",
        profileWriteMode: "shadow",
        profileWriteSource: "legacy_accumulator",
        profileWriteReason: "shadow_mode",
      }),
    ]);
    expect(report.rows[0]?.summary.threadProfileWrites).toEqual([
      expect.objectContaining({
        changed: true,
        changedFields: ["topicOfInterest", "preferredPresentation"],
        writeMode: "shadow",
        writeSource: "legacy_accumulator",
        writeReason: "shadow_mode",
      }),
    ]);
    expect(report.rows[0]?.evalCandidate).toMatchObject({
      expectedActivePlanningStepProfileIds: ["last_event_lifecycle_context"],
      expectedProfileStepIds: ["fetch_instance_journey"],
    });
  });

  it("compares observed direct-route strategies with workflow route definitions", () => {
    const workflow: AssistantWorkflowDefinition = {
      id: "test-workflow",
      version: 1,
      intents: [],
      directRoutes: [{
        id: "structured_view",
        description: "Structured view route.",
        effect: "read",
        outcomeRoute: "structured",
        strategies: [{
          id: "last_event_interval",
          description: "Fetch the interval around a lifecycle event.",
        }],
      }],
    };

    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-route-strategies",
      traceEvents: [
        {
          stage: "direct.structured.route.done",
          payload: {
            strategy: "last_event_interval",
            reason: "handled",
          },
        },
        {
          stage: "direct.structured.route.done",
          payload: {
            strategy: "new_runtime_strategy",
            reason: "handled",
          },
        },
        {
          stage: "direct.ad_hoc.route.done",
          payload: {
            strategy: "fast_path",
            reason: "handled",
          },
        },
      ],
    }], { workflow });

    expect(report.directRouteObservedStrategyCounts).toEqual([
      { key: "ad_hoc:fast_path", count: 1 },
      { key: "structured:last_event_interval", count: 1 },
      { key: "structured:new_runtime_strategy", count: 1 },
    ]);
    expect(report.directRouteUndeclaredStrategyCounts).toEqual([
      { key: "ad_hoc:fast_path", count: 1 },
      { key: "structured:new_runtime_strategy", count: 1 },
    ]);
    expect(report.rows[0]?.directRouteStrategies).toEqual([
      {
        route: "structured",
        strategy: "last_event_interval",
        definitionRouteId: "structured_view",
        declared: true,
        status: "declared",
      },
      {
        route: "structured",
        strategy: "new_runtime_strategy",
        definitionRouteId: "structured_view",
        declared: false,
        status: "strategy_not_declared",
      },
      {
        route: "ad_hoc",
        strategy: "fast_path",
        definitionRouteId: null,
        declared: false,
        status: "route_not_declared",
      },
    ]);
    expect(report.suggestions).toEqual([
      expect.objectContaining({
        id: "review_direct_route_strategy:ad_hoc:ad_hoc_fast_path",
        kind: "review_direct_route_strategy",
        intent: "ad_hoc",
        signal: "ad_hoc:fast_path",
      }),
      expect.objectContaining({
        id: "review_direct_route_strategy:structured_view:structured_new_runtime_strategy",
        kind: "review_direct_route_strategy",
        intent: "structured_view",
        signal: "structured:new_runtime_strategy",
      }),
    ]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report);
    const batch = serializeAssistantWorkflowSerializedRunReports(serialized, {
      generatedAt: "2026-06-30T10:00:00.000Z",
    });

    expect(serialized[0]?.run["directRouteStrategies"]).toEqual(report.rows[0]?.directRouteStrategies);
    expect(serialized[0]?.evaluation["directRouteObservedStrategies"]).toEqual([
      "structured:last_event_interval",
      "structured:new_runtime_strategy",
      "ad_hoc:fast_path",
    ]);
    expect(serialized[0]?.evaluation["directRouteUndeclaredStrategies"]).toEqual([
      "structured:new_runtime_strategy",
      "ad_hoc:fast_path",
    ]);
    expect(batch.summary).toMatchObject({
      directRouteObservedStrategyCounts: [
        { key: "ad_hoc:fast_path", count: 1 },
        { key: "structured:last_event_interval", count: 1 },
        { key: "structured:new_runtime_strategy", count: 1 },
      ],
      directRouteUndeclaredStrategyCounts: [
        { key: "ad_hoc:fast_path", count: 1 },
        { key: "structured:new_runtime_strategy", count: 1 },
      ],
    });
  });

  it("exports trace-derived serialized run reports for planning-profile replay", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-clean-chart",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "Show latest event chart." } },
        {
          stage: "planner_classifier.done",
          payload: { intent: "chart_single", presentation: "chart", confidence: 0.92 },
        },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "chart_single",
            effectivePresentation: "chart",
            workflowSelectionCandidateTools: ["get_attribute_data_view", "get_instance_journey"],
            plan: {
              stepIds: ["resolve_topic", "fetch_instance_journey", "build_chart"],
              activePlanningStepProfileIds: ["last_event_lifecycle_context"],
              profileStepIds: ["fetch_instance_journey"],
              missingPlanningSteps: [],
              missingToolHints: [],
              missingRequiredToolHints: [],
              executionHints: { producesArtifact: true },
            },
            authority: {
              source: "workflow",
              reason: "workflow_equivalent",
              selectedToolNames: ["get_attribute_data_view", "get_instance_journey"],
              workflowSuggestedToolNames: ["get_attribute_data_view", "get_instance_journey"],
              workflowStatus: "ready",
            },
          },
        },
        { stage: "tool.call", payload: { tool: "get_attribute_data_view", hop: 0, success: true } },
      ],
    }, {
      requestId: "req-error-chart",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "Broken latest event chart." } },
        {
          stage: "planner_classifier.done",
          payload: { intent: "chart_single", presentation: "chart", confidence: 0.7 },
        },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "chart_single",
            effectivePresentation: "chart",
            workflowSelectionCandidateTools: ["get_attribute_data_view", "get_instance_journey"],
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
        { stage: "tool.call.error", payload: { tool: "get_instance_journey", hop: 0 } },
      ],
    }]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report, {
      workflowId: "uns-assistant-default",
      workflowVersion: 1,
    });

    expect(serialized).toMatchObject([{
      workflowId: "uns-assistant-default",
      workflowVersion: 1,
      status: "completed",
      run: {
        source: "trace_report",
        requestId: "req-clean-chart",
      },
      evaluation: {
        intent: "chart_single",
        activePlanningStepProfileIds: ["last_event_lifecycle_context"],
        profileStepIds: ["fetch_instance_journey"],
        warningCount: 0,
      },
    }, {
      status: "failed",
      evaluation: {
        intent: "chart_single",
        activePlanningStepProfileIds: ["last_event_lifecycle_context"],
        profileStepIds: ["fetch_instance_journey"],
        warningCount: 2,
        signals: [{
          name: "run_failed",
          severity: "warning",
          detail: "tool.call.error",
        }, {
          name: "tool_execution_failed",
          severity: "warning",
          detail: "tool.call.error",
        }],
      },
    }]);
  });

  it("exports direct-route evidence into serialized run-report replay summaries", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-direct-current-value",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "What is the current temperature?" } },
        {
          stage: "planner_classifier.done",
          payload: { intent: "value_lookup", presentation: "text", confidence: 0.94 },
        },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "value_lookup",
            effectivePresentation: "text",
            workflowSelectionCandidateTools: ["get_attribute_latest_values"],
            authority: {
              source: "workflow",
              reason: "workflow_authority_enabled",
              selectedToolNames: ["get_attribute_latest_values"],
              workflowSuggestedToolNames: ["get_attribute_latest_values"],
              workflowStatus: "ready",
            },
          },
        },
        {
          stage: "direct.value.route.done",
          payload: {
            reason: "handled",
            strategy: "attribute_intent",
            topic: "factory/line-1/temperature",
            tool: "get_attribute_latest_values",
            mode: "tool_text",
            handled: true,
            contentChars: 180,
            tookMs: 42,
          },
        },
        {
          stage: "assistant_workflow.outcome",
          payload: {
            source: "direct_route_dispatch",
            layer: "direct_route.value_lookup",
            skipEvent: "direct.value.route.skip",
            kind: "direct_route",
            handled: true,
            contentChars: 180,
            reason: "handled",
            route: "value",
          },
        },
        {
          stage: "direct.structured.route.skip",
          payload: {
            reason: "not_last_event_chart",
            tool: "get_attribute_data_view",
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
          stage: "direct.structured.route.recovered",
          payload: {
            reason: "container_hint_disambiguation",
            strategy: "last_event_interval",
            topic: "factory/line-1/zone-1/temperature",
          },
        },
        {
          stage: "direct.unit.route.skip",
          payload: {
            reason: "runtime_policy_disabled",
          },
        },
        {
          stage: "assistant_workflow.memory_patch",
          payload: {
            changedSlots: ["topic_of_interest"],
            changedProfileFields: ["topicOfInterest"],
            appliedPatchCount: 1,
            skippedPatchCount: 1,
            appliedPatches: [
              { slotId: "topic_of_interest", operation: "set", changed: true },
            ],
            skippedPatches: [
              { slotId: "preferred_presentation", operation: "set", reason: "missing-value" },
            ],
            profilePatchEquivalent: false,
            profilePatchComparedFields: ["topicOfInterest", "preferredPresentation"],
            profilePatchMismatchedFields: ["preferredPresentation"],
            patchDerivation: "classification",
            profileWriteMode: "guarded",
            profileWriteSource: "legacy_fallback",
            profileWriteReason: "profile_patch_mismatch",
          },
        },
        {
          stage: "thread.profile.updated",
          payload: {
            changed: true,
            changedFields: ["topicOfInterest"],
            writeMode: "guarded",
            writeSource: "legacy_fallback",
            writeReason: "profile_patch_mismatch",
          },
        },
      ],
    }]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report, {
      workflowId: "uns-assistant-default",
      workflowVersion: 1,
    });
    const batch = serializeAssistantWorkflowSerializedRunReports(serialized, {
      generatedAt: "2026-06-30T10:00:00.000Z",
    });

    expect(report.tuningSignalCounts).toEqual([
      { name: "workflow_memory_patch_mismatch", severity: "warning", count: 1 },
    ]);
    expect(report.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "review_memory_patch_equivalence",
        severity: "warning",
        signal: "preferredPresentation",
        count: 1,
        requestIds: ["req-direct-current-value"],
      }),
    ]));
    expect(buildAssistantWorkflowMemoryPatchReadiness(report)).toMatchObject({
      status: "blocked",
      ready: false,
      equivalentPatchCount: 0,
      mismatchPatchCount: 1,
      unknownPatchCount: 0,
      totalPatchCount: 1,
      guardedWorkflowWriteCount: 0,
      guardedLegacyFallbackCount: 1,
      mismatchedProfileFieldCounts: [{ key: "preferredPresentation", count: 1 }],
      blockingReasons: [
        "equivalent_patch_count_below_minimum:0/1",
        "profile_patch_mismatch:1",
        "guarded_legacy_fallback:1",
      ],
    });
    expect(serialized[0]).toMatchObject({
      status: "completed",
      evaluation: {
        intent: "value_lookup",
        invokedToolCount: 0,
        directRouteDoneRoutes: ["value"],
        directRouteRecoveredRoutes: ["structured"],
        directRouteErrorRoutes: [],
        directRouteSkipReasons: ["structured:not_last_event_chart"],
        directRouteGapReasons: ["structured:Structured view spans multiple intents."],
        memoryChangedSlots: ["topic_of_interest"],
        memoryChangedProfileFields: ["topicOfInterest"],
        memorySkippedPatchReasons: ["preferred_presentation:set:missing-value"],
        memoryPatchEquivalence: ["mismatch"],
        memoryPatchDerivations: ["classification"],
        memoryPatchMismatchedProfileFields: ["preferredPresentation"],
        memoryPatchWriteSources: ["guarded:legacy_fallback"],
        memoryPatchWriteReasons: ["profile_patch_mismatch"],
        threadProfileWriteSources: ["guarded:legacy_fallback"],
        threadProfileWriteReasons: ["profile_patch_mismatch"],
        threadProfileWriteChangedFields: ["topicOfInterest"],
        warningCount: 0,
      },
      outcome: {
        kind: "direct_route",
        handled: true,
        reason: "handled",
        route: "value",
        contentChars: 180,
        source: "direct_route_dispatch",
        layer: "direct_route.value_lookup",
      },
    });
    expect(serialized[0]?.run["outcomes"]).toEqual([
      expect.objectContaining({
        kind: "direct_route",
        handled: true,
        route: "value",
        source: "direct_route_dispatch",
      }),
    ]);
    expect(serialized[0]?.run["directRoutes"]).toEqual(expect.arrayContaining([expect.objectContaining({
      route: "value",
      outcome: "done",
      strategy: "attribute_intent",
      topic: "factory/line-1/temperature",
      tool: "get_attribute_latest_values",
      mode: "tool_text",
      handled: true,
      contentChars: 180,
      tookMs: 42,
    }), expect.objectContaining({
      route: "structured",
      outcome: "skip",
      reason: "not_last_event_chart",
      tool: "get_attribute_data_view",
    }), expect.objectContaining({
      route: "unit",
      outcome: "skip",
      reason: "runtime_policy_disabled",
    })]));
    expect(serialized[0]?.run["directRouteGaps"]).toEqual([
      expect.objectContaining({
        handlerId: "direct_structured_view",
        layer: "direct_route.structured_view",
        route: "structured",
        reason: "Structured view spans multiple intents.",
      }),
    ]);
    expect(serialized[0]?.run["memoryPatches"]).toEqual([
      {
        changedSlots: ["topic_of_interest"],
        changedProfileFields: ["topicOfInterest"],
        appliedPatchCount: 1,
        skippedPatchCount: 1,
        appliedPatches: [
          { slotId: "topic_of_interest", operation: "set", changed: true },
        ],
        skippedPatches: [
          { slotId: "preferred_presentation", operation: "set", reason: "missing-value" },
        ],
        profilePatchEquivalent: false,
        profilePatchComparedFields: ["topicOfInterest", "preferredPresentation"],
        profilePatchMismatchedFields: ["preferredPresentation"],
        patchDerivation: "classification",
        profileWriteMode: "guarded",
        profileWriteSource: "legacy_fallback",
        profileWriteReason: "profile_patch_mismatch",
        intentWritePolicy: null,
      },
    ]);
    expect(serialized[0]?.run["threadProfileWrites"]).toEqual([
      {
        changed: true,
        changedFields: ["topicOfInterest"],
        writeMode: "guarded",
        writeSource: "legacy_fallback",
        writeReason: "profile_patch_mismatch",
      },
    ]);
    expect(batch.summary).toMatchObject({
      directRouteDoneCounts: [{ key: "value", count: 1 }],
      directRouteRecoveredCounts: [{ key: "structured", count: 1 }],
      directRouteErrorCounts: [],
      directRouteSkipReasonCounts: [{ key: "structured:not_last_event_chart", count: 1 }],
      directRouteGapReasonCounts: [{ key: "structured:Structured view spans multiple intents.", count: 1 }],
      memoryChangedSlotCounts: [{ key: "topic_of_interest", count: 1 }],
      memoryChangedProfileFieldCounts: [{ key: "topicOfInterest", count: 1 }],
      memorySkippedPatchReasonCounts: [{ key: "preferred_presentation:set:missing-value", count: 1 }],
      threadProfileWriteSourceCounts: [{ key: "guarded:legacy_fallback", count: 1 }],
      threadProfileWriteReasonCounts: [{ key: "profile_patch_mismatch", count: 1 }],
      threadProfileWriteChangedFieldCounts: [{ key: "topicOfInterest", count: 1 }],
    });
  });

  it("uses handled workflow outcome traces even when no workflow decision was recorded", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-direct-only",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "Current voltage?" } },
        {
          stage: "assistant_workflow.outcome",
          payload: {
            source: "direct_route_dispatch",
            layer: "direct_route.value_lookup",
            skipEvent: "direct.value.route.skip",
            kind: "direct_route",
            handled: true,
            contentChars: 20,
            reason: "handled",
            route: "value",
          },
        },
      ],
    }]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report);

    expect(report.outcomeKindCounts).toEqual([
      { key: "direct_route", count: 1 },
    ]);
    expect(report.handledOutcomeKindCounts).toEqual([
      { key: "direct_route", count: 1 },
    ]);
    expect(serialized[0]).toMatchObject({
      status: "completed",
      outcome: {
        kind: "direct_route",
        handled: true,
        route: "value",
      },
      evaluation: {
        outcomeKind: "direct_route",
        handled: true,
        warningCount: 0,
      },
    });
  });

  it("blocks memory patch readiness when equivalence evidence is missing", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-legacy-memory-patch",
      traceEvents: [{
        stage: "assistant_workflow.memory_patch",
        payload: {
          changedSlots: ["topic_of_interest"],
          changedProfileFields: ["topicOfInterest"],
          appliedPatchCount: 1,
          skippedPatchCount: 0,
        },
      }],
    }]);

    expect(report.memoryPatchEquivalenceCounts).toEqual([
      { key: "unknown", count: 1 },
    ]);
    expect(buildAssistantWorkflowMemoryPatchReadiness(report, {
      minEquivalentPatchCount: 2,
    })).toMatchObject({
      status: "blocked",
      ready: false,
      minEquivalentPatchCount: 2,
      equivalentPatchCount: 0,
      mismatchPatchCount: 0,
      unknownPatchCount: 1,
      totalPatchCount: 1,
      guardedWorkflowWriteCount: 0,
      workflowPatchWriteCount: 0,
      guardedLegacyFallbackCount: 0,
      blockingReasons: [
        "equivalent_patch_count_below_minimum:0/2",
        "profile_patch_equivalence_unknown:1",
      ],
    });
  });

  it("distinguishes ready, insufficient, and blocked intent memory-policy evidence", () => {
    const readyReport = buildAssistantWorkflowTraceReport([
      policyTraceRow("req-policy-1", true),
      policyTraceRow("req-policy-2", true),
      policyTraceRow("req-policy-3", true),
    ]);

    expect(buildAssistantWorkflowIntentMemoryPolicyReadiness(readyReport)).toMatchObject({
      status: "ready",
      ready: true,
      observedPolicyCount: 3,
      equivalentPolicyCount: 3,
      mismatchPolicyCount: 0,
      unknownPolicyCount: 0,
      writeNotAllowedCount: 0,
      intentCounts: [{ key: "chart_single", count: 3 }],
      blockingReasons: [],
    });
    expect(buildAssistantWorkflowIntentMemoryPolicyReadiness(
      buildAssistantWorkflowTraceReport([policyTraceRow("req-policy-limited", true)]),
    )).toMatchObject({
      status: "insufficient_evidence",
      observedPolicyCount: 1,
      equivalentPolicyCount: 1,
      blockingReasons: [
        "intent_write_policy_observed_count_below_minimum:1/3",
        "intent_write_policy_equivalent_count_below_minimum:1/3",
      ],
    });
    expect(buildAssistantWorkflowIntentMemoryPolicyReadiness(
      buildAssistantWorkflowTraceReport([policyTraceRow("req-policy-mismatch", false, false)]),
      { minObservedPolicyCount: 1, minEquivalentPolicyCount: 0 },
    )).toMatchObject({
      status: "blocked",
      mismatchPolicyCount: 1,
      blockingReasons: ["intent_write_policy_mismatch:1/0"],
    });
    expect(buildAssistantWorkflowIntentMemoryPolicyReadiness(
      buildAssistantWorkflowTraceReport([policyTraceRow("req-policy-denied", true, true)]),
      { minObservedPolicyCount: 1, minEquivalentPolicyCount: 1 },
    )).toMatchObject({
      status: "blocked",
      writeNotAllowedCount: 1,
      blockingReasons: ["intent_write_policy_write_not_allowed:1/0"],
    });
  });

  it("scopes memory policy readiness to the active workflow definition", () => {
    const report = buildAssistantWorkflowTraceReport([
      policyTraceRow("req-policy-v4-mismatch", false, false, 4),
      policyTraceRow("req-policy-v5-1", true, false, 5),
      policyTraceRow("req-policy-v5-2", true, false, 5),
      policyTraceRow("req-policy-v5-3", true, false, 5),
    ]);

    expect(buildAssistantWorkflowIntentMemoryPolicyReadiness(report)).toMatchObject({
      status: "blocked",
      mismatchPolicyCount: 1,
    });
    expect(buildAssistantWorkflowIntentMemoryPolicyReadiness(report, {
      workflowIds: ["memory-policy-test"],
      workflowVersions: [5],
    })).toMatchObject({
      status: "ready",
      ready: true,
      workflowIds: ["memory-policy-test"],
      workflowVersions: [5],
      scopedRowCount: 3,
      observedPolicyCount: 3,
      equivalentPolicyCount: 3,
      mismatchPolicyCount: 0,
      blockingReasons: [],
    });
    expect(buildAssistantWorkflowMemoryPatchReadiness(report, {
      workflowIds: ["memory-policy-test"],
      workflowVersions: [5],
      minEquivalentPatchCount: 3,
    })).toMatchObject({
      status: "ready",
      ready: true,
      workflowIds: ["memory-policy-test"],
      workflowVersions: [5],
      scopedRowCount: 3,
      equivalentPatchCount: 3,
      mismatchPatchCount: 0,
      blockingReasons: [],
    });
  });

  it("requires guarded workflow writes when configured for cutover readiness", () => {
    const shadowReport = buildAssistantWorkflowTraceReport([{
      requestId: "req-shadow-memory-patch",
      traceEvents: [{
        stage: "assistant_workflow.memory_patch",
        payload: {
          changedSlots: ["topic_of_interest"],
          changedProfileFields: ["topicOfInterest"],
          appliedPatchCount: 1,
          skippedPatchCount: 0,
          profilePatchEquivalent: true,
          profileWriteMode: "shadow",
          profileWriteSource: "legacy_accumulator",
          profileWriteReason: "shadow_mode",
        },
      }],
    }]);

    expect(buildAssistantWorkflowMemoryPatchReadiness(shadowReport, {
      minEquivalentPatchCount: 1,
      minGuardedWorkflowWriteCount: 1,
    })).toMatchObject({
      status: "insufficient_evidence",
      ready: false,
      equivalentPatchCount: 1,
      guardedWorkflowWriteCount: 0,
      workflowPatchWriteCount: 0,
      guardedLegacyFallbackCount: 0,
      blockingReasons: ["guarded_workflow_write_count_below_minimum:0/1"],
    });

    const guardedReport = buildAssistantWorkflowTraceReport([{
      requestId: "req-guarded-memory-patch",
      traceEvents: [{
        stage: "assistant_workflow.memory_patch",
        payload: {
          changedSlots: ["topic_of_interest"],
          changedProfileFields: ["topicOfInterest"],
          appliedPatchCount: 1,
          skippedPatchCount: 0,
          profilePatchEquivalent: true,
          profileWriteMode: "guarded",
          profileWriteSource: "workflow_patch",
          profileWriteReason: "profile_patch_equivalent",
        },
      }],
    }]);

    expect(buildAssistantWorkflowMemoryPatchReadiness(guardedReport, {
      minEquivalentPatchCount: 1,
      minGuardedWorkflowWriteCount: 1,
    })).toMatchObject({
      status: "ready",
      ready: true,
      equivalentPatchCount: 1,
      guardedWorkflowWriteCount: 1,
      workflowPatchWriteCount: 1,
      guardedLegacyFallbackCount: 0,
      blockingReasons: [],
    });

    const workflowModeReport = buildAssistantWorkflowTraceReport([{
      requestId: "req-workflow-mode-memory-patch",
      traceEvents: [{
        stage: "assistant_workflow.memory_patch",
        payload: {
          changedSlots: ["topic_of_interest"],
          changedProfileFields: ["topicOfInterest"],
          appliedPatchCount: 1,
          skippedPatchCount: 0,
          profilePatchEquivalent: true,
          profileWriteMode: "workflow",
          profileWriteSource: "workflow_patch",
          profileWriteReason: "workflow_mode",
        },
      }],
    }]);

    expect(buildAssistantWorkflowMemoryPatchReadiness(workflowModeReport, {
      minEquivalentPatchCount: 1,
      minWorkflowPatchWriteCount: 1,
    })).toMatchObject({
      status: "ready",
      ready: true,
      equivalentPatchCount: 1,
      guardedWorkflowWriteCount: 0,
      workflowModePatchWriteCount: 1,
      workflowPatchWriteCount: 1,
      blockingReasons: [],
    });
    expect(buildAssistantWorkflowMemoryPatchReadiness(workflowModeReport, {
      minEquivalentPatchCount: 1,
      minWorkflowModePatchWriteCount: 1,
    })).toMatchObject({
      status: "ready",
      ready: true,
      workflowModePatchWriteCount: 1,
      minWorkflowModePatchWriteCount: 1,
      workflowPatchWriteCount: 1,
      blockingReasons: [],
    });
    expect(buildAssistantWorkflowMemoryPatchReadiness(workflowModeReport, {
      minEquivalentPatchCount: 1,
      minWorkflowModePatchWriteCount: 2,
    })).toMatchObject({
      status: "insufficient_evidence",
      ready: false,
      workflowModePatchWriteCount: 1,
      minWorkflowModePatchWriteCount: 2,
      blockingReasons: ["workflow_mode_patch_write_count_below_minimum:1/2"],
    });
    expect(buildAssistantWorkflowMemoryPatchReadiness(workflowModeReport, {
      minEquivalentPatchCount: 1,
      minGuardedWorkflowWriteCount: 1,
    })).toMatchObject({
      status: "insufficient_evidence",
      ready: false,
      guardedWorkflowWriteCount: 0,
      workflowPatchWriteCount: 1,
      blockingReasons: ["guarded_workflow_write_count_below_minimum:0/1"],
    });
  });

  it("serializes structured-artifact and clarification outcome evidence", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-structured-then-clarify",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "temperature" } },
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
      ],
    }]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report);

    expect(report.outcomeKindCounts).toEqual([
      { key: "clarification", count: 1 },
      { key: "structured_artifact", count: 1 },
    ]);
    expect(report.handledOutcomeKindCounts).toEqual([
      { key: "clarification", count: 1 },
      { key: "structured_artifact", count: 1 },
    ]);
    expect(serialized[0]).toMatchObject({
      status: "clarification",
      outcome: {
        kind: "clarification",
        handled: true,
        reason: "attribute_disambiguation",
        source: "final_answer",
        layer: "in_hop.disambiguation_clarification",
        mode: "structured_disambiguation_clarification",
        ruleId: "attribute_disambiguation",
        streamed: false,
      },
      evaluation: {
        outcomeKind: "clarification",
        handled: true,
      },
    });
    expect(serialized[0]?.run["outcomes"]).toEqual([
      expect.objectContaining({
        kind: "structured_artifact",
        handled: true,
        artifactKind: "chart",
        source: "final_answer",
        mode: "structured_tool_output",
        submode: "chart_artifact",
        tool: "get_attribute_data_view",
        streamed: false,
      }),
      expect.objectContaining({
        kind: "clarification",
        handled: true,
        reason: "attribute_disambiguation",
        source: "final_answer",
        mode: "structured_disambiguation_clarification",
        ruleId: "attribute_disambiguation",
        streamed: false,
      }),
    ]);
  });

  it("aggregates clarification workflow comparisons in trace reports and exports", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-clarification-matched",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "temperature" } },
        {
          stage: "planner_classifier.done",
          payload: { intent: "table_view", presentation: "table", confidence: 0.88 },
        },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "table_view",
            clarificationPolicy: {
              ruleIds: ["ambiguous_topic_scope"],
              blockingRuleIds: ["ambiguous_topic_scope"],
              needsClarification: true,
            },
          },
        },
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
          },
        },
      ],
    }, {
      requestId: "req-clarification-mismatch",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "current value" } },
        {
          stage: "planner_classifier.done",
          payload: { intent: "value_lookup", presentation: "text", confidence: 0.91 },
        },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "value_lookup",
            effectivePresentation: "text",
            workflowSelectionCandidateTools: ["get_attribute_latest_values"],
            clarificationPolicy: {
              ruleIds: ["needs_container"],
              blockingRuleIds: ["needs_container"],
              needsClarification: true,
            },
          },
        },
        {
          stage: "clarification.workflow_comparison",
          payload: {
            intent: "value_lookup",
            expectedRuleIds: ["needs_container"],
            expectedBlockingRuleIds: ["needs_container"],
            expectedSuggestedRuleIds: [],
            produced: true,
            observedRuleId: "attribute_disambiguation",
            equivalentRuleIds: ["attribute_disambiguation"],
            matched: false,
            missingExpectedRuleIds: ["needs_container"],
            unexpectedObservedRuleId: "attribute_disambiguation",
            source: "attribute_disambiguation_runtime",
            layer: "direct_route.attribute_disambiguation",
          },
        },
      ],
    }]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report, {
      workflowId: "uns-assistant-default",
      workflowVersion: 1,
    });

    expect(report.clarificationComparisonMatchedCounts).toEqual([
      { key: "attribute_disambiguation", count: 1 },
    ]);
    expect(report.clarificationComparisonMissingRuleCounts).toEqual([
      { key: "needs_container", count: 1 },
    ]);
    expect(report.clarificationComparisonUnexpectedRuleCounts).toEqual([
      { key: "attribute_disambiguation", count: 1 },
    ]);
    expect(report.tuningSignalCounts).toEqual([
      { name: "clarification_runtime_mismatch", severity: "warning", count: 1 },
    ]);
    expect(report.suggestions.map((suggestion) => suggestion.id)).not.toContain(
      "review_clarification_policy:table_view:ambiguous_topic_scope",
    );
    expect(report.suggestions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "review_clarification_policy:value_lookup:needs_container",
        kind: "review_clarification_policy",
        intent: "value_lookup",
        signal: "needs_container",
      }),
      expect.objectContaining({
        id: "review_clarification_policy:value_lookup:attribute_disambiguation",
        kind: "review_clarification_policy",
        intent: "value_lookup",
        signal: "attribute_disambiguation",
      }),
    ]));
    expect(serialized).toMatchObject([{
      status: "clarification",
      run: {
        clarificationComparisons: [{
          intent: "table_view",
          observedRuleId: "attribute_disambiguation",
          equivalentRuleIds: ["attribute_disambiguation", "ambiguous_topic_scope"],
          matched: true,
        }],
      },
      evaluation: {
        clarificationMatchedRules: ["attribute_disambiguation"],
        clarificationMissingRules: [],
        clarificationUnexpectedRules: [],
        warningCount: 0,
      },
    }, {
      status: "degraded",
      evaluation: {
        clarificationMatchedRules: [],
        clarificationMissingRules: ["needs_container"],
        clarificationUnexpectedRules: ["attribute_disambiguation"],
        warningCount: 1,
        signals: [{
          name: "clarification_policy_mismatch",
          severity: "warning",
          detail: "missing needs_container",
        }],
      },
    }]);
  });

  it("preserves classifier planning profiles when a later tool-selection event omits the plan", () => {
    const report = buildAssistantWorkflowTraceReport([{
      requestId: "req-real-chart",
      traceEvents: [
        { stage: "chat.request.start", payload: { message: "Nariši graf za zadnji dogodek." } },
        {
          stage: "planner_classifier.workflow_decision",
          payload: {
            intent: "chart_single",
            effectivePresentation: "chart",
            confidence: 0.95,
            toolsToExpose: ["get_instance_journey", "get_attribute_data_view"],
            plan: {
              stepIds: ["classify_intent", "resolve_topic", "fetch_attribute_history", "fetch_instance_journey", "build_chart", "synthesize_answer"],
              activePlanningStepProfileIds: ["last_event_lifecycle_context"],
              profileStepIds: ["fetch_instance_journey"],
              missingPlanningSteps: [],
              missingToolHints: [],
              missingRequiredToolHints: [],
              executionHints: { producesArtifact: true, needsSynthesis: true },
            },
          },
        },
        {
          stage: "tool_selection.workflow_comparison",
          payload: {
            intent: "chart_single",
            effectivePresentation: "chart",
            workflowSelectionCandidateTools: ["get_instance_journey", "get_attribute_data_view"],
            authority: {
              source: "workflow",
              reason: "workflow_authority_enabled",
              selectedToolNames: ["get_instance_journey", "get_attribute_data_view"],
              workflowSuggestedToolNames: ["get_instance_journey", "get_attribute_data_view", "resolve_topic_path", "get_api_data_view"],
              workflowStatus: "ready",
            },
          },
        },
        { stage: "tool.call", payload: { tool: "get_attribute_data_view", hop: 1, success: true } },
        {
          stage: "quality.signals.ok",
          payload: {
            intent: "chart_single",
            presentation: "chart",
            passed: ["expected_artifact_missing", "prose_reproduction", "multi_topic_single_call"],
          },
        },
      ],
    }]);

    expect(report.activePlanningStepProfileCounts).toEqual([
      { key: "last_event_lifecycle_context", count: 1 },
    ]);

    const serialized = buildAssistantWorkflowSerializedRunReportsFromTraceReport(report, {
      workflowId: "uns-assistant-default",
      workflowVersion: 1,
    });

    expect(serialized[0]).toMatchObject({
      status: "completed",
      run: {
        decision: {
          plan: {
            activePlanningStepProfileIds: ["last_event_lifecycle_context"],
            profileStepIds: ["fetch_instance_journey"],
          },
          authority: {
            source: "workflow",
            reason: "workflow_authority_enabled",
          },
        },
      },
      evaluation: {
        activePlanningStepProfileIds: ["last_event_lifecycle_context"],
        profileStepIds: ["fetch_instance_journey"],
        warningCount: 0,
      },
    });
  });
});

function policyTraceRow(
  requestId: string,
  equivalent: boolean,
  writeNotAllowed = false,
  workflowVersion?: number,
): AssistantWorkflowTraceReportSourceRow {
  return {
    requestId,
    traceEvents: [
      ...(workflowVersion === undefined ? [] : [{
        stage: "planner_classifier.workflow_decision",
        payload: {
          workflowId: "memory-policy-test",
          workflowVersion,
          intent: "chart_single",
        },
      }]),
      {
        stage: "assistant_workflow.memory_patch",
        payload: {
          profilePatchEquivalent: equivalent,
          profilePatchMismatchedFields: equivalent ? [] : ["preferredTimeWindow"],
          intentWritePolicy: {
            intentId: "chart_single",
            profilePatchEquivalent: equivalent,
            profilePatchMismatchedFields: equivalent ? [] : ["preferredTimeWindow"],
            skippedPatches: writeNotAllowed ? [{
              slotId: "preferred_time_window",
              operation: "set",
              reason: "write-not-allowed",
            }] : [],
          },
        },
      },
    ],
  };
}
