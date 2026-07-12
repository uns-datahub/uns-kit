import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDecision,
  buildAssistantWorkflowToolSelectionAuthority,
  buildAssistantWorkflowToolSelectionCandidate,
  buildAssistantWorkflowToolSelectionComparisonPayload,
  buildAssistantWorkflowToolSelectionDecision,
  buildAssistantWorkflowToolSelectionProfileKey,
  buildAssistantWorkflowToolSelectionSegmentKey,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("buildAssistantWorkflowToolSelectionCandidate", () => {
  it("requires classifier confirmation before optional workflow tool hints become selection candidates", () => {
    const workflow = defineAssistantWorkflow({
      id: "selection-policy-test",
      version: 1,
      intents: [{
        id: "answer_docs",
        description: "Answer from docs.",
        requiredToolHints: ["list_docs", "query_docs"],
        toolHints: ["list_docs", "query_docs", "guided_answer"],
      }],
      tools: [
        capability("list_docs"),
        capability("query_docs"),
        capability("guided_answer"),
      ],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["list_docs", "query_docs"],
        entities: {},
      },
      ["list_docs", "query_docs", "guided_answer"],
    );

    expect(buildAssistantWorkflowToolSelectionCandidate({ workflow, decision })).toEqual({
      optionalToolSelectionMode: "classifier-confirmed",
      toolNames: ["list_docs", "query_docs"],
      classifierToolNames: ["list_docs", "query_docs"],
      requiredToolNames: ["list_docs", "query_docs"],
      optionalToolNames: ["guided_answer"],
      excludedOptionalToolNames: ["guided_answer"],
      activeProfileIds: [],
      profileToolNames: [],
      profileExcludedToolNames: [],
    });
  });

  it("includes optional hints when an intent opts into workflow-suggested optional tools", () => {
    const workflow = defineAssistantWorkflow({
      id: "selection-policy-test",
      version: 1,
      intents: [{
        id: "generate_report",
        description: "Generate a report.",
        optionalToolSelectionMode: "workflow-suggested",
        requiredToolHints: ["load_data"],
        toolHints: ["load_data", "render_report"],
      }],
      tools: [
        capability("load_data"),
        capability("render_report"),
      ],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "generate_report",
        toolsToExpose: ["load_data"],
        entities: {},
      },
      ["load_data", "render_report"],
    );

    expect(buildAssistantWorkflowToolSelectionCandidate({ workflow, decision })).toMatchObject({
      optionalToolSelectionMode: "workflow-suggested",
      toolNames: ["load_data", "render_report"],
      optionalToolNames: ["render_report"],
      excludedOptionalToolNames: [],
    });
  });

  it("activates conditional selection profiles without changing execution dependencies", () => {
    const workflow = defineAssistantWorkflow({
      id: "selection-profile-test",
      version: 1,
      intents: [{
        id: "answer_docs",
        description: "Answer from docs.",
        requiredToolHints: ["query_docs"],
        toolHints: ["query_docs"],
        toolSelectionProfiles: [{
          id: "follow_up_fallback",
          description: "Expose broad retrieval tools on follow-up turns.",
          condition: {
            minHop: 1,
            selectedReason: "intent_pruned",
          },
          toolHints: ["list_docs", "search_docs"],
        }],
      }],
      tools: [
        capability("query_docs"),
        capability("list_docs"),
        capability("search_docs"),
      ],
      toolBindings: [
        {
          name: "query_docs",
          provider: "local-function",
          handlerId: "query_docs",
        },
        {
          name: "list_docs",
          provider: "local-function",
          handlerId: "list_docs",
        },
        {
          name: "search_docs",
          provider: "local-function",
          handlerId: "search_docs",
        },
      ],
      presentations: [{ id: "text", description: "Text response." }],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      ["query_docs", "list_docs", "search_docs"],
    );

    expect(decision.requiredToolHints).toEqual(["query_docs"]);
    expect(decision.toolHints).toEqual(["query_docs"]);

    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision,
      availableToolNames: ["query_docs", "list_docs", "search_docs"],
      hop: 0,
      selectedReason: "intent_pruned",
    })).toMatchObject({
      toolNames: ["query_docs"],
      activeProfileIds: [],
      profileToolNames: [],
    });

    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision,
      availableToolNames: ["query_docs", "list_docs", "search_docs"],
      hop: 1,
      selectedReason: "intent_pruned",
    })).toMatchObject({
      toolNames: ["query_docs", "list_docs", "search_docs"],
      activeProfileIds: ["follow_up_fallback"],
      profileToolNames: ["list_docs", "search_docs"],
    });
  });

  it("uses active selection profile tools for authority equivalence", () => {
    const workflow = defineAssistantWorkflow({
      id: "selection-profile-authority-test",
      version: 1,
      intents: [{
        id: "answer_docs",
        description: "Answer from docs.",
        defaultPresentation: "text",
        requiredToolHints: ["query_docs"],
        toolSelectionProfiles: [{
          id: "follow_up_fallback",
          description: "Expose broad retrieval tools on follow-up turns.",
          condition: {
            minHop: 1,
            selectedReason: "intent_pruned",
          },
          toolHints: ["list_docs", "search_docs"],
        }],
      }],
      tools: [
        capability("query_docs"),
        capability("list_docs"),
        capability("search_docs"),
      ],
      toolBindings: [
        localBinding("query_docs"),
        localBinding("list_docs"),
        localBinding("search_docs"),
      ],
      presentations: [{ id: "text", description: "Text response." }],
    });

    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedReason: "intent_pruned",
      hop: 1,
    });

    expect(decision.authority).toMatchObject({
      source: "workflow",
      reason: "workflow_equivalent",
    });
    expect(decision.comparisonPayload).toMatchObject({
      workflowSelectionCandidateTools: ["query_docs", "list_docs", "search_docs"],
      workflowSelectionActiveProfileIds: ["follow_up_fallback"],
      workflowSelectionProfileTools: ["list_docs", "search_docs"],
      selectedOutsideWorkflowSelectionCandidate: [],
    });
  });

  it("activates profile tools only when the host reports the matching resolved-scope fact", () => {
    const workflow = defineAssistantWorkflow({
      id: "resolved-scope-profile-test",
      version: 1,
      intents: [{
        id: "table",
        description: "Build a table.",
        toolHints: ["read_data"],
        toolSelectionProfiles: [{
          id: "resolve_untrusted_scope",
          description: "Resolve an untrusted scope before reading data.",
          condition: { resolvedScope: false },
          toolHints: ["resolve_scope"],
        }],
      }],
      tools: [capability("read_data"), capability("resolve_scope")],
      toolBindings: [localBinding("read_data"), localBinding("resolve_scope")],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      { intent: "table", toolsToExpose: ["read_data"], entities: {} },
      ["read_data", "resolve_scope"],
    );

    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision,
      availableToolNames: ["read_data", "resolve_scope"],
      resolvedScope: false,
    })).toMatchObject({
      toolNames: ["read_data", "resolve_scope"],
      activeProfileIds: ["resolve_untrusted_scope"],
      profileToolNames: ["resolve_scope"],
    });
    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision,
      availableToolNames: ["read_data", "resolve_scope"],
      resolvedScope: true,
    })).toMatchObject({
      toolNames: ["read_data"],
      activeProfileIds: [],
      profileToolNames: [],
    });
  });

  it("activates a profile only when the host reports enough attributes and classifier-confirmed tools", () => {
    const workflow = defineAssistantWorkflow({
      id: "attribute-count-profile-test",
      version: 1,
      intents: [{
        id: "table",
        description: "Build a table.",
        toolHints: ["read_data"],
        toolSelectionProfiles: [{
          id: "multi_attribute_discovery",
          description: "Add discovery for multiple table columns.",
          condition: {
            minAttributeCount: 2,
            requiredClassifierTools: ["batch_data"],
          },
          toolHints: ["search_data"],
        }],
      }],
      tools: [capability("read_data"), capability("search_data"), capability("batch_data")],
      toolBindings: [localBinding("read_data"), localBinding("search_data"), localBinding("batch_data")],
    });
    const withoutBatchDecision = buildAssistantWorkflowDecision(
      workflow,
      { intent: "table", toolsToExpose: ["read_data"], entities: {} },
      ["read_data", "search_data", "batch_data"],
    );
    const withBatchDecision = buildAssistantWorkflowDecision(
      workflow,
      { intent: "table", toolsToExpose: ["read_data", "batch_data"], entities: {} },
      ["read_data", "search_data", "batch_data"],
    );

    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision: withoutBatchDecision,
      availableToolNames: ["read_data", "search_data", "batch_data"],
      attributeCount: 1,
    })).toMatchObject({ activeProfileIds: [], profileToolNames: [] });
    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision: withoutBatchDecision,
      availableToolNames: ["read_data", "search_data", "batch_data"],
      attributeCount: 2,
    })).toMatchObject({ activeProfileIds: [], profileToolNames: [] });
    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision: withBatchDecision,
      availableToolNames: ["read_data", "search_data", "batch_data"],
      attributeCount: 2,
    })).toMatchObject({
      activeProfileIds: ["multi_attribute_discovery"],
      profileToolNames: ["search_data"],
    });
  });

  it("lets an active profile exclude incompatible classifier tools declaratively", () => {
    const workflow = defineAssistantWorkflow({
      id: "profile-exclusion-test",
      version: 1,
      intents: [{
        id: "table",
        description: "Build a multi-column table.",
        toolHints: ["read_data", "batch_data"],
        toolSelectionProfiles: [{
          id: "multi_attribute_batch",
          description: "Use the batch reader instead of a single-reader tool.",
          condition: {
            minAttributeCount: 2,
            requiredClassifierTools: ["batch_data"],
          },
          toolHints: ["search_data"],
          toolExclusions: ["read_data"],
          optionalToolSelectionMode: "workflow-suggested",
        }],
      }],
      tools: [capability("read_data"), capability("batch_data"), capability("search_data")],
      toolBindings: [localBinding("read_data"), localBinding("batch_data"), localBinding("search_data")],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      { intent: "table", toolsToExpose: ["read_data", "batch_data"], entities: {} },
      ["read_data", "batch_data", "search_data"],
    );

    expect(buildAssistantWorkflowToolSelectionCandidate({
      workflow,
      decision,
      availableToolNames: ["read_data", "batch_data", "search_data"],
      attributeCount: 2,
    })).toMatchObject({
      toolNames: ["batch_data", "search_data"],
      activeProfileIds: ["multi_attribute_batch"],
      profileToolNames: ["search_data"],
      profileExcludedToolNames: ["read_data"],
    });
  });

  it("enables authority only for an exact active profile combination", () => {
    const workflow = defineAssistantWorkflow({
      id: "profile-authority-test",
      version: 1,
      intents: [{
        id: "table",
        description: "Build a table.",
        toolHints: ["read_data"],
        toolSelectionProfiles: [{
          id: "resolve_untrusted_scope",
          description: "Resolve the scope before reading it.",
          condition: { resolvedScope: false },
          toolHints: ["resolve_scope"],
        }],
      }],
      tools: [capability("read_data"), capability("resolve_scope")],
      toolBindings: [localBinding("read_data"), localBinding("resolve_scope")],
    });
    const profileKey = buildAssistantWorkflowToolSelectionProfileKey({
      intentId: "table",
      profileIds: ["resolve_untrusted_scope"],
    });

    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "table",
        toolsToExpose: ["read_data"],
        entities: {},
      },
      availableToolNames: ["read_data", "resolve_scope"],
      selectedToolNames: ["read_data"],
      workflowAuthorityIntentIds: [],
      workflowAuthoritySegmentKeys: [],
      workflowAuthorityProfileKeys: [profileKey!],
    });

    expect(profileKey).toBe("table|profiles:resolve_untrusted_scope");
    expect(decision.authority).toMatchObject({
      source: "workflow",
      reason: "workflow_authority_enabled",
      selectedToolNames: ["read_data", "resolve_scope"],
    });
    expect(decision.comparisonPayload).toMatchObject({
      workflowAuthorityProfileKey: profileKey,
      workflowAuthorityProfileKeys: [profileKey],
    });
  });

  it("marks workflow unavailable without a comparison payload", () => {
    expect(buildAssistantWorkflowToolSelectionAuthority({
      selectedToolNames: ["query_docs"],
      workflowAvailable: false,
    })).toEqual({
      source: "legacy-pruner",
      reason: "workflow_unavailable",
      selectedToolNames: ["query_docs"],
      workflowSuggestedToolNames: [],
      workflowStatus: null,
    });
  });

  it("keeps legacy authority when workflow execution is blocked", () => {
    expect(buildAssistantWorkflowToolSelectionAuthority({
      selectedToolNames: ["query_docs"],
      workflowAvailable: true,
      workflowSuggestedToolNames: ["query_docs"],
      workflowSelectionCandidateToolNames: ["query_docs"],
      workflowStatus: "blocked",
    })).toMatchObject({
      source: "legacy-pruner",
      reason: "workflow_blocked",
      workflowStatus: "blocked",
    });
  });

  it("uses policy-filtered workflow candidate tools for authority equivalence", () => {
    expect(buildAssistantWorkflowToolSelectionAuthority({
      selectedToolNames: ["list_docs", "query_docs"],
      workflowAvailable: true,
      workflowSuggestedToolNames: ["list_docs", "query_docs", "guided_answer"],
      workflowSelectionCandidateToolNames: ["list_docs", "query_docs"],
      workflowStatus: "ready",
    })).toEqual({
      source: "workflow",
      reason: "workflow_equivalent",
      selectedToolNames: ["list_docs", "query_docs"],
      workflowSuggestedToolNames: ["list_docs", "query_docs", "guided_answer"],
      workflowStatus: "ready",
    });
  });

  it("keeps legacy authority when selected tools differ from the workflow candidate", () => {
    expect(buildAssistantWorkflowToolSelectionAuthority({
      selectedToolNames: ["search_docs"],
      workflowAvailable: true,
      workflowSuggestedToolNames: ["query_docs"],
      workflowSelectionCandidateToolNames: ["query_docs"],
      workflowStatus: "ready",
    })).toMatchObject({
      source: "legacy-pruner",
      reason: "workflow_differs",
      selectedToolNames: ["search_docs"],
      workflowSuggestedToolNames: ["query_docs"],
      workflowStatus: "ready",
    });
  });

  it("uses the workflow candidate when workflow authority is explicitly enabled", () => {
    expect(buildAssistantWorkflowToolSelectionAuthority({
      selectedToolNames: ["search_docs"],
      workflowAvailable: true,
      workflowSuggestedToolNames: ["query_docs", "list_docs"],
      workflowSelectionCandidateToolNames: ["query_docs"],
      workflowStatus: "ready",
      workflowAuthorityEnabled: true,
    })).toEqual({
      source: "workflow",
      reason: "workflow_authority_enabled",
      selectedToolNames: ["query_docs"],
      workflowSuggestedToolNames: ["query_docs", "list_docs"],
      workflowStatus: "ready",
    });
  });

  it("builds a generic workflow-vs-selected-tool comparison payload", () => {
    const workflow = defineAssistantWorkflow(comparisonWorkflow());

    const payload = buildAssistantWorkflowToolSelectionComparisonPayload({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.91,
        entities: {},
      },
      availableToolNames: ["list_docs", "query_docs", "extra_lookup"],
      selectedToolNames: ["query_docs", "extra_lookup"],
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      hop: 0,
      pruningEnabled: true,
      availableContext: ["document-scope"],
    });

    expect(payload).toMatchObject({
      hop: 0,
      pruningEnabled: true,
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      selectedToolCount: 2,
      intent: "answer_docs",
      matchedIntent: true,
      workflowSuggestedTools: ["query_docs", "list_docs"],
      workflowSelectionCandidateTools: ["query_docs"],
      workflowSelectionExcludedOptionalTools: ["list_docs"],
      missingWorkflowSuggestedTools: ["list_docs"],
      missingWorkflowSelectionCandidateTools: [],
      selectedOutsideWorkflowSuggestions: ["extra_lookup"],
      selectedOutsideWorkflowSelectionCandidate: ["extra_lookup"],
      workflowRun: expect.objectContaining({
        status: "ready",
      }),
      executionPlan: expect.objectContaining({
        status: "ready",
        readyToolNames: ["query_docs", "list_docs"],
      }),
      selectedToolCapabilitySummary: expect.objectContaining({
        toolCount: 2,
      }),
      workflowSelectionCandidateToolCapabilitySummary: expect.objectContaining({
        toolCount: 1,
      }),
    });
  });

  it("builds the generic tool-selection decision with authority and effective reason", () => {
    const workflow = defineAssistantWorkflow(comparisonWorkflow());

    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.91,
        entities: {},
      },
      availableToolNames: ["list_docs", "query_docs"],
      selectedToolNames: ["query_docs"],
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    });

    expect(decision.authority).toEqual({
      source: "workflow",
      reason: "workflow_equivalent",
      selectedToolNames: ["query_docs"],
      workflowSuggestedToolNames: ["query_docs", "list_docs"],
      workflowStatus: "ready",
    });
    expect(decision.effectiveToolNames).toEqual(["query_docs"]);
    expect(decision.effectiveReason).toBe("workflow_equivalent");
    expect(decision.comparisonPayload).toMatchObject({
      selectedReason: "workflow_equivalent",
      selectedToolCount: 1,
      authority: {
        source: "workflow",
        reason: "workflow_equivalent",
      },
      workflowSelectionCandidateTools: ["query_docs"],
      workflowSelectionExcludedOptionalTools: ["list_docs"],
    });
  });

  it("keeps equivalent workflow selections in shadow mode when the intent is not enabled for authority", () => {
    const workflow = defineAssistantWorkflow(comparisonWorkflow());

    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.91,
        entities: {},
      },
      availableToolNames: ["list_docs", "query_docs"],
      selectedToolNames: ["query_docs"],
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      workflowAuthorityIntentIds: ["value_lookup"],
    });

    expect(decision.authority).toEqual({
      source: "legacy-pruner",
      reason: "workflow_authority_not_enabled",
      selectedToolNames: ["query_docs"],
      workflowSuggestedToolNames: ["query_docs", "list_docs"],
      workflowStatus: "ready",
    });
    expect(decision.effectiveToolNames).toEqual(["query_docs"]);
    expect(decision.effectiveReason).toBe("intent_pruned");
    expect(decision.comparisonPayload).toMatchObject({
      selectedReason: "intent_pruned",
      workflowAuthorityIntentIds: ["value_lookup"],
      authority: {
        source: "legacy-pruner",
        reason: "workflow_authority_not_enabled",
      },
      workflowSelectionCandidateTools: ["query_docs"],
    });
  });

  it("allows workflow authority for an enabled segment without enabling the whole intent", () => {
    const workflow = defineAssistantWorkflow(comparisonWorkflow());
    const segmentKey = buildAssistantWorkflowToolSelectionSegmentKey({
      intentId: "answer_docs",
      hop: 1,
      selectedReason: "intent_pruned",
    });

    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.91,
        entities: {},
      },
      availableToolNames: ["list_docs", "query_docs"],
      selectedToolNames: ["query_docs"],
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      hop: 1,
      workflowAuthorityIntentIds: ["value_lookup"],
      workflowAuthoritySegmentKeys: [segmentKey],
    });

    expect(decision.authority).toMatchObject({
      source: "workflow",
      reason: "workflow_equivalent",
    });
    expect(decision.effectiveReason).toBe("workflow_equivalent");
    expect(decision.comparisonPayload).toMatchObject({
      workflowId: "selection-comparison-test",
      workflowVersion: 1,
      workflowAuthorityIntentIds: ["value_lookup"],
      workflowAuthoritySegmentKey: segmentKey,
      workflowAuthoritySegmentKeys: [segmentKey],
      authority: {
        source: "workflow",
        reason: "workflow_equivalent",
      },
    });
  });

  it("uses workflow candidate tools for an enabled segment even when legacy selected more tools", () => {
    const workflow = defineAssistantWorkflow(comparisonWorkflow());
    const segmentKey = buildAssistantWorkflowToolSelectionSegmentKey({
      intentId: "answer_docs",
      hop: 1,
      selectedReason: "intent_pruned",
    });

    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.91,
        entities: {},
      },
      availableToolNames: ["list_docs", "query_docs", "extra_lookup"],
      selectedToolNames: ["query_docs", "extra_lookup"],
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      hop: 1,
      workflowAuthoritySegmentKeys: [segmentKey],
    });

    expect(decision.authority).toEqual({
      source: "workflow",
      reason: "workflow_authority_enabled",
      selectedToolNames: ["query_docs"],
      workflowSuggestedToolNames: ["query_docs", "list_docs"],
      workflowStatus: "ready",
    });
    expect(decision.effectiveToolNames).toEqual(["query_docs"]);
    expect(decision.effectiveReason).toBe("workflow_authority_enabled");
    expect(decision.comparisonPayload).toMatchObject({
      selectedReason: "workflow_authority_enabled",
      selectedToolCount: 1,
      workflowAuthoritySegmentKey: segmentKey,
      workflowAuthoritySegmentKeys: [segmentKey],
      authority: {
        source: "workflow",
        reason: "workflow_authority_enabled",
      },
    });
  });

  it("builds a legacy fallback decision when no classification is available", () => {
    const workflow = defineAssistantWorkflow(comparisonWorkflow());

    expect(buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: null,
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
    })).toEqual({
      comparisonPayload: null,
      authority: {
        source: "legacy-pruner",
        reason: "workflow_unavailable",
        selectedToolNames: ["query_docs"],
        workflowSuggestedToolNames: [],
        workflowStatus: null,
      },
      effectiveToolNames: ["query_docs"],
      effectiveReason: "intent_pruned",
    });
  });
});

function capability(name: string) {
  return {
    name,
    provider: "local-function" as const,
    effect: "read" as const,
    sideEffectRisk: "low" as const,
    cacheability: "request-scoped" as const,
    retryClass: "safe" as const,
    outputKinds: ["text"] as const,
  };
}

function localBinding(name: string) {
  return {
    name,
    provider: "local-function" as const,
    handlerId: name,
  };
}

function comparisonWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "selection-comparison-test",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs", "query_docs"],
      planningSteps: ["retrieve_docs"],
    }],
    tools: [{
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
    }, {
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence", "text"],
      requiredContext: ["document-scope"],
    }, {
      name: "extra_lookup",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "safe",
      outputKinds: ["text"],
    }],
    toolBindings: [{
      name: "list_docs",
      provider: "http",
      path: "/docs",
    }, {
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }, {
      name: "extra_lookup",
      provider: "local-function",
      handlerId: "extra.lookup",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
    }],
    presentations: [{ id: "text", description: "Text answer." }],
  };
}
