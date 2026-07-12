import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowDefinitionTuningSuggestions,
  buildAssistantWorkflowDefinitionTuningApplyTracePayload,
  buildAssistantWorkflowDefinitionTuningReportFromSuggestions,
  defineAssistantWorkflow,
  type AssistantWorkflowTraceReportSuggestion,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "support-agent",
  version: 1,
  intents: [
    {
      id: "answer_docs",
      description: "Answer from documentation.",
      toolHints: ["query_docs"],
    },
    {
      id: "change_setting",
      description: "Change an account setting.",
    },
    {
      id: "other",
      description: "Fallback intent.",
    },
  ],
  tools: [
    {
      name: "query_docs",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "safe",
      outputKinds: ["evidence"],
    },
    {
      name: "list_sources",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
    },
    {
      name: "update_setting",
      provider: "local-function",
      effect: "write",
      sideEffectRisk: "high",
      cacheability: "not-cacheable",
      retryClass: "never",
      outputKinds: ["text"],
      requiresConfirmation: true,
    },
  ],
});

describe("assistant workflow definition tuning", () => {
  it("turns repeated unmodeled safe selected tools into intent tool-hint patch previews", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_unmodeled_selected_tool:answer_docs:list_sources",
        kind: "review_unmodeled_selected_tool",
        intent: "answer_docs",
        tool: "list_sources",
        count: 3,
        requestIds: ["req-1", "req-2"],
      }),
    ]);

    expect(report).toMatchObject({
      workflowId: "support-agent",
      workflowVersion: 1,
      sourceSuggestionCount: 1,
      suggestionCount: 1,
      applicableSuggestionCount: 1,
      suggestions: [{
        id: "add_intent_tool_hint:answer_docs:list_sources",
        action: "add_intent_tool_hint",
        severity: "info",
        intentId: "answer_docs",
        toolName: "list_sources",
        count: 3,
        patchPreview: {
          kind: "append_intent_tool_hint",
          intentId: "answer_docs",
          toolName: "list_sources",
        },
      }],
    });
  });

  it("keeps risky selected tools as review-only policy suggestions", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_unmodeled_selected_tool:change_setting:update_setting",
        kind: "review_unmodeled_selected_tool",
        intent: "change_setting",
        tool: "update_setting",
        count: 2,
      }),
    ]);

    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toMatchObject({
      action: "review_tool_selection_policy",
      intentId: "change_setting",
      toolName: "update_setting",
      patchPreview: { kind: "none" },
    });
  });

  it("keeps fallback-like intents as review-only policy suggestions", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_unmodeled_selected_tool:other:list_sources",
        kind: "review_unmodeled_selected_tool",
        intent: "other",
        tool: "list_sources",
      }),
    ]);

    expect(report.suggestions).toHaveLength(1);
    expect(report.suggestions[0]).toMatchObject({
      action: "review_tool_selection_policy",
      intentId: "other",
      toolName: "list_sources",
      patchPreview: { kind: "none" },
    });
  });

  it("allows callers to override ignored fallback intent ids", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_unmodeled_selected_tool:other:list_sources",
        kind: "review_unmodeled_selected_tool",
        intent: "other",
        tool: "list_sources",
      }),
    ], {
      ignoredIntentIds: [],
    });

    expect(report.suggestions[0]).toMatchObject({
      action: "add_intent_tool_hint",
      patchPreview: {
        kind: "append_intent_tool_hint",
        intentId: "other",
        toolName: "list_sources",
      },
    });
  });

  it("suggests registering missing tool capabilities before adding hints", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_missing_required_tool:answer_docs:summarize_docs",
        kind: "review_missing_required_tool",
        severity: "warning",
        intent: "answer_docs",
        tool: "summarize_docs",
      }),
    ]);

    expect(report).toMatchObject({
      suggestionCount: 1,
      applicableSuggestionCount: 1,
      suggestions: [{
        id: "register_tool_capability:answer_docs:summarize_docs",
        action: "register_tool_capability",
        severity: "warning",
        intentId: "answer_docs",
        toolName: "summarize_docs",
        patchPreview: {
          kind: "register_tool_capability",
          toolName: "summarize_docs",
        },
      }],
    });
  });

  it("turns undeclared direct-route strategy reviews into route strategy patch previews", () => {
    const workflow = defineAssistantWorkflow({
      ...WORKFLOW,
      directRoutes: [{
        id: "structured_view",
        description: "Structured view route.",
        effect: "read",
        outcomeRoute: "structured",
        strategies: [{
          id: "explicit_path",
          description: "Resolve an explicit path.",
        }],
      }],
    });
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(workflow, [
      suggestion({
        id: "review_direct_route_strategy:structured_view:structured_last_event_interval",
        kind: "review_direct_route_strategy",
        intent: "structured_view",
        signal: "structured:last_event_interval",
        count: 2,
      }),
    ]);

    expect(report).toMatchObject({
      suggestionCount: 1,
      applicableSuggestionCount: 1,
      suggestions: [{
        id: "add_direct_route_strategy:structured_view:last_event_interval",
        action: "add_direct_route_strategy",
        intentId: "structured_view",
        signal: "structured:last_event_interval",
        count: 2,
        patchPreview: {
          kind: "append_direct_route_strategy",
          routeId: "structured_view",
          strategyId: "last_event_interval",
        },
      }],
    });

    const result = applyAssistantWorkflowDefinitionTuningSuggestions(workflow, report.suggestions);

    expect(result).toMatchObject({
      changed: true,
      appliedCount: 1,
      diff: {
        versionChanged: true,
        directRouteDiffs: [{
          routeId: "structured_view",
          addedStrategyIds: ["last_event_interval"],
        }],
      },
    });
    expect(result.definition.directRoutes?.[0]?.strategies?.map((strategy) => strategy.id)).toEqual([
      "explicit_path",
      "last_event_interval",
    ]);
  });

  it("can suppress low-confidence workflow-selection gap reviews by default", () => {
    const input = [
      suggestion({
        id: "review_workflow_tool_selection_gap:answer_docs:list_sources",
        kind: "review_workflow_tool_selection_gap",
        intent: "answer_docs",
        tool: "list_sources",
      }),
    ];

    expect(buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, input).suggestions)
      .toEqual([]);
    expect(buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, input, {
      includeLowConfidence: true,
    }).suggestions).toHaveLength(1);
  });

  it("applies selected safe tool-hint patch previews immutably and bumps the definition version", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_unmodeled_selected_tool:answer_docs:list_sources",
        kind: "review_unmodeled_selected_tool",
        intent: "answer_docs",
        tool: "list_sources",
      }),
      suggestion({
        id: "review_unmodeled_selected_tool:change_setting:update_setting",
        kind: "review_unmodeled_selected_tool",
        intent: "change_setting",
        tool: "update_setting",
      }),
    ]);
    const result = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, report.suggestions, {
      suggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
    });

    expect(result).toMatchObject({
      changed: true,
      appliedCount: 1,
      skippedCount: 1,
      appliedSuggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
      skippedSuggestions: [{
        id: "review_tool_selection_policy:change_setting:update_setting",
        reason: "not_selected",
      }],
      diff: {
        versionChanged: true,
        intentDiffs: [{
          intentId: "answer_docs",
          addedToolHints: ["list_sources"],
        }],
      },
    });
    expect(result.definition.version).toBe(WORKFLOW.version + 1);
    expect(result.definition.intents.find((intent) => intent.id === "answer_docs")).toMatchObject({
      toolHints: ["query_docs", "list_sources"],
    });
    expect(WORKFLOW.intents.find((intent) => intent.id === "answer_docs")).toMatchObject({
      toolHints: ["query_docs"],
    });
    expect(buildAssistantWorkflowDefinitionTuningApplyTracePayload(result)).toMatchObject({
      changed: true,
      appliedCount: 1,
      skippedCount: 1,
      definition: {
        id: "support-agent",
        version: 2,
        intentCount: 3,
        toolCapabilityCount: 3,
      },
      diff: {
        changed: true,
        intentDiffs: [{
          intentId: "answer_docs",
          addedToolHints: ["list_sources"],
        }],
      },
    });
  });

  it("skips unsupported and duplicate tuning patch previews", () => {
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(WORKFLOW, [
      suggestion({
        id: "review_unmodeled_selected_tool:answer_docs:query_docs",
        kind: "review_unmodeled_selected_tool",
        intent: "answer_docs",
        tool: "query_docs",
      }),
      suggestion({
        id: "review_missing_required_tool:answer_docs:summarize_docs",
        kind: "review_missing_required_tool",
        severity: "warning",
        intent: "answer_docs",
        tool: "summarize_docs",
      }),
    ], {
      includeLowConfidence: true,
    });
    const result = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, report.suggestions);

    expect(result).toMatchObject({
      changed: false,
      appliedCount: 0,
      diff: {
        changed: false,
      },
      skippedSuggestions: expect.arrayContaining([
        {
          id: "review_tool_selection_policy:answer_docs:query_docs",
          reason: "unsupported_patch",
        },
        {
          id: "register_tool_capability:answer_docs:summarize_docs",
          reason: "unsupported_patch",
        },
      ]),
    });
    expect(result.definition).toBe(WORKFLOW);
  });

  it("can limit applied tool hints per intent", () => {
    const workflow = defineAssistantWorkflow({
      ...WORKFLOW,
      tools: [
        ...(WORKFLOW.tools ?? []),
        {
          name: "search_docs",
          provider: "local-function",
          effect: "read",
          sideEffectRisk: "low",
          cacheability: "request-scoped",
          retryClass: "safe",
          outputKinds: ["evidence"],
        },
      ],
    });
    const report = buildAssistantWorkflowDefinitionTuningReportFromSuggestions(workflow, [
      suggestion({
        id: "review_unmodeled_selected_tool:answer_docs:list_sources",
        kind: "review_unmodeled_selected_tool",
        intent: "answer_docs",
        tool: "list_sources",
      }),
      suggestion({
        id: "review_unmodeled_selected_tool:answer_docs:search_docs",
        kind: "review_unmodeled_selected_tool",
        intent: "answer_docs",
        tool: "search_docs",
      }),
    ]);
    const result = applyAssistantWorkflowDefinitionTuningSuggestions(workflow, report.suggestions, {
      maxToolHintsPerIntent: 1,
    });

    expect(result).toMatchObject({
      appliedCount: 1,
      skippedSuggestions: [{
        id: "add_intent_tool_hint:answer_docs:search_docs",
        reason: "intent_apply_limit",
      }],
      diff: {
        intentDiffs: [{
          intentId: "answer_docs",
          addedToolHints: ["list_sources"],
        }],
      },
    });
  });
});

function suggestion(
  input: Partial<AssistantWorkflowTraceReportSuggestion> & Pick<
    AssistantWorkflowTraceReportSuggestion,
    "id" | "kind"
  >,
): AssistantWorkflowTraceReportSuggestion {
  return {
    severity: "info",
    intent: null,
    tool: null,
    signal: null,
    count: 1,
    requestIds: ["req-1"],
    rationale: "trace rationale",
    suggestedAction: "trace action",
    ...input,
  };
}
