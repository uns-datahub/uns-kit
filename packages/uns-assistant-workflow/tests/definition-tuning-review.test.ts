import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowDefinitionTuningSuggestions,
  buildAssistantWorkflowDefinitionTuningReview,
  buildAssistantWorkflowDefinitionTuningReviewTracePayload,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinitionPackageSmokeSuiteResult,
  type AssistantWorkflowDefinitionTuningSuggestion,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "support-agent",
  version: 1,
  intents: [{
    id: "answer_docs",
    description: "Answer from documentation.",
    defaultPresentation: "text",
    toolHints: ["query_docs"],
  }, {
    id: "inspect_account",
    description: "Inspect account state.",
  }],
  tools: [{
    name: "query_docs",
    provider: "local-function",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "request-scoped",
    retryClass: "safe",
    outputKinds: ["evidence"],
  }, {
    name: "list_sources",
    provider: "local-function",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "cacheable",
    retryClass: "safe",
    outputKinds: ["catalog"],
  }, {
    name: "list_accounts",
    provider: "local-function",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "cacheable",
    retryClass: "safe",
    outputKinds: ["catalog"],
  }, {
    name: "render_chart",
    provider: "local-function",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "request-scoped",
    retryClass: "safe",
    outputKinds: ["chart"],
  }],
  presentations: [{
    id: "text",
    description: "Text answer.",
  }],
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

describe("assistant workflow definition tuning review", () => {
  it("marks a small applied tuning with passing smoke as ready", () => {
    const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, [
      suggestion("answer_docs", "list_sources"),
    ]);
    const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, smokeResult({
      caseCount: 1,
      passCount: 1,
    }));

    expect(review).toMatchObject({
      status: "ready",
      workflowId: "support-agent",
      workflowVersion: 2,
      summary: {
        changed: true,
        appliedCount: 1,
        changedIntentCount: 1,
        addedToolHintCount: 1,
        maxAddedToolHintsPerIntent: 1,
        changedIntents: [{
          intentId: "answer_docs",
          addedToolHintCount: 1,
          addedToolHints: ["list_sources"],
        }],
        smoke: {
          caseCount: 1,
          passCount: 1,
          failCount: 0,
          requiredFailCount: 0,
        },
      },
      reasons: [],
    });
    expect(buildAssistantWorkflowDefinitionTuningReviewTracePayload(review)).toMatchObject({
      status: "ready",
      summary: {
        appliedCount: 1,
      },
    });
  });

  it("blocks no-change reviews and required smoke failures", () => {
    const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, [
      suggestion("answer_docs", "query_docs"),
    ]);
    const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, smokeResult({
      caseCount: 1,
      failCount: 1,
      requiredFailCount: 1,
      failedCaseIds: ["definition-tuning-answer_docs"],
      requiredFailedCaseIds: ["definition-tuning-answer_docs"],
    }));

    expect(review.status).toBe("blocked");
    expect(review.reasons.map((reason) => reason.code)).toEqual([
      "no_change",
      "smoke_required_failures",
    ]);
  });

  it("warns when the review exceeds configured size thresholds or smoke was not run", () => {
    const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, [
      suggestion("answer_docs", "list_sources"),
      suggestion("inspect_account", "list_accounts"),
    ]);
    const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, null, {
      maxAppliedSuggestions: 1,
      maxChangedIntents: 1,
    });

    expect(review.status).toBe("warning");
    expect(review.reasons.map((reason) => reason.code)).toEqual([
      "too_many_applied_suggestions",
      "too_many_changed_intents",
      "smoke_not_run",
    ]);
  });

  it("summarizes applied direct-route strategy metadata changes", () => {
    const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, [
      routeStrategySuggestion("structured_view", "last_event_interval"),
    ]);
    const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, smokeResult({
      caseCount: 1,
      passCount: 1,
    }));

    expect(review).toMatchObject({
      status: "ready",
      summary: {
        changed: true,
        appliedCount: 1,
        changedIntentCount: 0,
        changedDirectRouteCount: 1,
        addedToolHintCount: 0,
        addedDirectRouteStrategyCount: 1,
        changedDirectRoutes: [{
          routeId: "structured_view",
          addedStrategyCount: 1,
          addedStrategyIds: ["last_event_interval"],
        }],
      },
    });
    expect(buildAssistantWorkflowDefinitionTuningReviewTracePayload(review)).toMatchObject({
      status: "ready",
      summary: {
        changedDirectRouteCount: 1,
        addedDirectRouteStrategyCount: 1,
        changedDirectRoutes: [{
          routeId: "structured_view",
          addedStrategyIds: ["last_event_interval"],
        }],
      },
    });
  });

  it("warns when an applied tool hint only produces an incompatible presentation output", () => {
    const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(WORKFLOW, [
      suggestion("answer_docs", "render_chart"),
    ]);
    const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, smokeResult({
      caseCount: 1,
      passCount: 1,
    }));

    expect(review.status).toBe("warning");
    expect(review.reasons).toMatchObject([{
      severity: "warning",
      code: "tool_output_presentation_mismatch",
      details: {
        intentId: "answer_docs",
        toolName: "render_chart",
        defaultPresentation: "text",
        outputKinds: ["chart"],
      },
    }]);
    expect(buildAssistantWorkflowDefinitionTuningReview(applyResult, smokeResult({
      caseCount: 1,
      passCount: 1,
    }), {
      checkToolCompatibility: false,
    }).status).toBe("ready");
  });
});

function suggestion(
  intentId: string,
  toolName: string,
): AssistantWorkflowDefinitionTuningSuggestion {
  return {
    id: `add_intent_tool_hint:${intentId}:${toolName}`,
    action: "add_intent_tool_hint",
    severity: "info",
    intentId,
    toolName,
    signal: "test",
    count: 1,
    requestIds: [],
    sourceSuggestionIds: [],
    rationale: "Test suggestion.",
    suggestedAction: "Add tool hint.",
    patchPreview: {
      kind: "append_intent_tool_hint",
      intentId,
      toolName,
    },
  };
}

function routeStrategySuggestion(
  routeId: string,
  strategyId: string,
): AssistantWorkflowDefinitionTuningSuggestion {
  return {
    id: `add_direct_route_strategy:${routeId}:${strategyId}`,
    action: "add_direct_route_strategy",
    severity: "info",
    intentId: routeId,
    toolName: null,
    signal: `structured:${strategyId}`,
    count: 1,
    requestIds: [],
    sourceSuggestionIds: [],
    rationale: "Test route strategy suggestion.",
    suggestedAction: "Add route strategy metadata.",
    patchPreview: {
      kind: "append_direct_route_strategy",
      routeId,
      strategyId,
      description: `Observed runtime strategy ${strategyId}.`,
    },
  };
}

function smokeResult(summary: {
  caseCount: number;
  passCount?: number;
  failCount?: number;
  requiredFailCount?: number;
  failedCaseIds?: string[];
  requiredFailedCaseIds?: string[];
}): AssistantWorkflowDefinitionPackageSmokeSuiteResult {
  const failCount = summary.failCount ?? 0;
  return {
    summary: {
      caseCount: summary.caseCount,
      runCaseCount: summary.caseCount,
      executionCaseCount: 0,
      passCount: summary.passCount ?? summary.caseCount - failCount,
      failCount,
      requiredFailCount: summary.requiredFailCount ?? 0,
      failedCaseIds: summary.failedCaseIds ?? [],
      requiredFailedCaseIds: summary.requiredFailedCaseIds ?? [],
    },
    cases: [],
  };
}
