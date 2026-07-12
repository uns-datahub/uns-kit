import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowDefinitionTuningSuggestions,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionTuningPromotion,
  buildAssistantWorkflowDefinitionTuningPromotionBrief,
  buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload,
  buildAssistantWorkflowDefinitionTuningPromotionTracePayload,
  buildAssistantWorkflowDefinitionTuningReview,
  buildAssistantWorkflowDefinitionTuningReviewArtifact,
  defineAssistantWorkflow,
  runAssistantWorkflowDefinitionTuningReplayLines,
  stringifyAssistantWorkflowDefinitionTuningSuggestionLines,
  type AssistantWorkflowDefinitionPackageSmokeSuiteResult,
  type AssistantWorkflowDefinitionTuningReviewArtifact,
  type AssistantWorkflowDefinitionTuningSuggestion,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "support-agent",
  version: 1,
  intents: [{
    id: "answer_docs",
    description: "Answer from docs.",
    toolHints: ["query_docs"],
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

describe("assistant workflow definition tuning promotion", () => {
  it("marks ready changed artifacts with passing smoke as promotable", () => {
    const promotion = buildAssistantWorkflowDefinitionTuningPromotion(artifact());

    expect(promotion).toMatchObject({
      status: "promotable",
      summary: {
        workflowId: "support-agent",
        workflowVersion: 2,
        reviewStatus: "ready",
        changed: true,
        fromVersion: 1,
        toVersion: 2,
        appliedCount: 1,
        smokeCaseCount: 1,
        smokeFailCount: 0,
        smokeRequiredFailCount: 0,
        patchedDefinitionValid: true,
        appliedSuggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
        appliedSuggestionCount: 1,
      },
      reasons: [],
    });
    expect(buildAssistantWorkflowDefinitionTuningPromotionTracePayload(promotion)).toMatchObject({
      status: "promotable",
      summary: {
        workflowId: "support-agent",
        reviewStatus: "ready",
      },
    });

    expect(buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(
      buildAssistantWorkflowDefinitionTuningPromotionBrief(artifact(), promotion),
    )).toMatchObject({
      status: "promotable",
      changedIntentCount: 1,
      addedToolHintCount: 1,
      appliedSuggestionCount: 1,
      changes: [{
        intentId: "answer_docs",
        addedToolHints: ["list_sources"],
        appliedSuggestions: [{
          id: "add_intent_tool_hint:answer_docs:list_sources",
          toolName: "list_sources",
          requestIds: ["req-1"],
          approved: null,
        }],
      }],
    });
  });

  it("blocks promotion until applied suggestions are explicitly approved when requested", () => {
    const unapproved = buildAssistantWorkflowDefinitionTuningPromotion(artifact(), {
      requireApprovedSuggestions: true,
    });

    expect(unapproved).toMatchObject({
      status: "blocked",
      reasons: [{
        severity: "blocked",
        code: "unapproved_suggestions",
        details: {
          unapprovedSuggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
          approvedSuggestionIds: [],
        },
      }],
    });

    const approved = buildAssistantWorkflowDefinitionTuningPromotion(artifact(), {
      requireApprovedSuggestions: true,
      approvedSuggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
    });
    const brief = buildAssistantWorkflowDefinitionTuningPromotionBrief(artifact(), approved);

    expect(approved.status).toBe("promotable");
    expect(buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(brief)).toMatchObject({
      changes: [{
        appliedSuggestions: [{
          id: "add_intent_tool_hint:answer_docs:list_sources",
          approved: true,
        }],
      }],
    });
  });

  it("keeps non-tool-hint intent diff fields in the promotion brief", () => {
    const baseArtifact = artifact();
    const profileArtifact: AssistantWorkflowDefinitionTuningReviewArtifact = {
      ...baseArtifact,
      apply: {
        ...baseArtifact.apply,
        diff: {
          ...(baseArtifact.apply["diff"] as Record<string, unknown>),
          intentDiffs: [{
            intentId: "answer_docs",
            addedToolHints: [],
            addedPlanningSteps: ["fetch_instance_journey"],
            addedToolSelectionProfileIds: ["follow_up_retrieval"],
            addedPlanningStepProfileIds: ["last_event_lifecycle_context"],
            changed: true,
          }],
        },
      },
      suggestions: {
        ...baseArtifact.suggestions,
        applied: [],
      },
    };

    expect(buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(
      buildAssistantWorkflowDefinitionTuningPromotionBrief(profileArtifact),
    )).toMatchObject({
      changedIntentCount: 1,
      addedToolHintCount: 0,
      changes: [{
        intentId: "answer_docs",
        addedToolHints: [],
        addedPlanningSteps: ["fetch_instance_journey"],
        addedToolSelectionProfileIds: ["follow_up_retrieval"],
        addedPlanningStepProfileIds: ["last_event_lifecycle_context"],
      }],
    });
  });

  it("keeps direct-route strategy diffs in the promotion brief", () => {
    const routeArtifact = artifact({
      suggestions: [routeStrategySuggestion("structured_view", "last_event_interval")],
    });
    const promotion = buildAssistantWorkflowDefinitionTuningPromotion(routeArtifact);

    expect(promotion.status).toBe("promotable");
    expect(buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(
      buildAssistantWorkflowDefinitionTuningPromotionBrief(routeArtifact, promotion),
    )).toMatchObject({
      changedIntentCount: 0,
      changedDirectRouteCount: 1,
      addedToolHintCount: 0,
      addedDirectRouteStrategyCount: 1,
      directRouteChanges: [{
        routeId: "structured_view",
        addedStrategyIds: ["last_event_interval"],
        appliedSuggestions: [{
          id: "add_direct_route_strategy:structured_view:last_event_interval",
          action: "add_direct_route_strategy",
          intentId: "structured_view",
          toolName: null,
          approved: null,
        }],
      }],
    });
  });

  it("keeps deferred suggestion evidence in the promotion brief", () => {
    const reviewArtifact = artifact({
      suggestions: [
        suggestion("answer_docs", "list_sources"),
        suggestion("answer_docs", "query_docs"),
        reviewOnlySuggestion("answer_docs", "expected_artifact_missing"),
      ],
      onlyApplicable: false,
      suggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
    });
    const brief = buildAssistantWorkflowDefinitionTuningPromotionBrief(reviewArtifact);

    expect(buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(brief)).toMatchObject({
      suggestionSummary: {
        appliedCount: 1,
        skippedCount: 2,
        reviewOnlyCount: 1,
        skipReasonCounts: [{
          key: "not_selected",
          count: 2,
        }],
        reviewOnlyActionCounts: [{
          key: "review_quality_signal",
          count: 1,
        }],
        reviewOnlySignalCounts: [{
          key: "expected_artifact_missing",
          count: 1,
        }],
      },
      skippedSuggestions: [{
        id: "add_intent_tool_hint:answer_docs:query_docs",
        reason: "not_selected",
        suggestion: {
          id: "add_intent_tool_hint:answer_docs:query_docs",
          action: "add_intent_tool_hint",
        },
      }, {
        id: "review_quality_signal:answer_docs:expected_artifact_missing",
        reason: "not_selected",
        suggestion: {
          id: "review_quality_signal:answer_docs:expected_artifact_missing",
          action: "review_quality_signal",
        },
      }],
      reviewOnlySuggestions: [{
        id: "review_quality_signal:answer_docs:expected_artifact_missing",
        action: "review_quality_signal",
        signal: "expected_artifact_missing",
        count: 2,
      }],
    });
  });

  it("requires review when applied suggestions share an intent with deferred review signals", () => {
    const reviewArtifact = artifact({
      suggestions: [
        suggestion("answer_docs", "list_sources"),
        reviewOnlySuggestion("answer_docs", "expected_artifact_missing"),
      ],
      onlyApplicable: false,
      suggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"],
    });

    expect(buildAssistantWorkflowDefinitionTuningPromotion(reviewArtifact)).toMatchObject({
      status: "needs_review",
      reasons: [{
        severity: "warning",
        code: "deferred_review_signals",
        details: {
          intents: [{
            intentId: "answer_docs",
            signals: ["expected_artifact_missing"],
          }],
        },
      }],
    });
    expect(buildAssistantWorkflowDefinitionTuningPromotion(reviewArtifact, {
      allowReviewWarnings: true,
    })).toMatchObject({
      status: "promotable",
    });
  });

  it("keeps warning reviews out of automatic promotion unless explicitly allowed", () => {
    const warningArtifact = {
      ...artifact(),
      review: {
        status: "warning",
        summary: {
          changedIntentCount: 1,
        },
        reasons: [{
          severity: "warning",
          code: "tool_output_presentation_mismatch",
          message: "Tool output does not fit presentation.",
          details: {
            intentId: "answer_docs",
            toolName: "list_sources",
          },
        }],
      },
    };

    expect(buildAssistantWorkflowDefinitionTuningPromotion(warningArtifact)).toMatchObject({
      status: "needs_review",
      reasons: [{
        severity: "warning",
        code: "review_warning",
      }],
    });
    expect(buildAssistantWorkflowDefinitionTuningPromotion(warningArtifact, {
      allowReviewWarnings: true,
    })).toMatchObject({
      status: "promotable",
      reasons: [],
    });
    expect(buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(
      buildAssistantWorkflowDefinitionTuningPromotionBrief(warningArtifact),
    )).toMatchObject({
      reviewReasons: [{
        code: "tool_output_presentation_mismatch",
        details: {
          intentId: "answer_docs",
          toolName: "list_sources",
        },
      }],
    });
  });

  it("blocks mismatched or failing artifacts", () => {
    const promotion = buildAssistantWorkflowDefinitionTuningPromotion(artifact({
      smoke: smokeResult({
        failCount: 1,
        requiredFailCount: 1,
      }),
    }), {
      expectedWorkflowId: "other-agent",
      expectedFromVersion: 7,
      expectedToVersion: 8,
    });

    expect(promotion.status).toBe("blocked");
    expect(promotion.reasons.map((reason) => reason.code)).toEqual([
      "workflow_id_mismatch",
      "workflow_version_mismatch",
      "workflow_version_mismatch",
      "review_blocked",
      "smoke_required_failures",
    ]);
  });

  it("blocks artifacts without smoke when smoke is required", () => {
    const blocked = buildAssistantWorkflowDefinitionTuningPromotion(artifact({
      smoke: null,
    }));
    expect(blocked.status).toBe("blocked");
    expect(blocked.reasons.map((reason) => reason.code)).toEqual([
      "review_warning",
      "missing_smoke",
    ]);
    expect(buildAssistantWorkflowDefinitionTuningPromotion(artifact({
      smoke: null,
    }), {
      requireSmoke: false,
      allowReviewWarnings: true,
    })).toMatchObject({
      status: "promotable",
    });
  });
});

function artifact(options: {
  smoke?: AssistantWorkflowDefinitionPackageSmokeSuiteResult | null;
  suggestions?: AssistantWorkflowDefinitionTuningSuggestion[];
  suggestionIds?: string[];
  onlyApplicable?: boolean;
} = {}): AssistantWorkflowDefinitionTuningReviewArtifact {
  const replay = runAssistantWorkflowDefinitionTuningReplayLines({
    suggestionLines: stringifyAssistantWorkflowDefinitionTuningSuggestionLines([
      ...(options.suggestions ?? [suggestion("answer_docs", "list_sources")]),
    ]),
  }, {
    onlyApplicable: options.onlyApplicable ?? true,
  });
  const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(
    WORKFLOW,
    replay.batch.suggestions,
    options.suggestionIds ? { suggestionIds: options.suggestionIds } : {},
  );
  const definitionPackage = buildAssistantWorkflowDefinitionPackage([applyResult.definition], {
    packageId: "support-package",
    generatedAt: "2026-06-29T10:00:00.000Z",
  });
  const smoke = options.smoke === undefined ? smokeResult() : options.smoke;
  const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, smoke);

  return buildAssistantWorkflowDefinitionTuningReviewArtifact({
    replay,
    applyResult,
    definitionPackage,
    smoke,
    review,
    generatedAt: "2026-06-29T11:00:00.000Z",
  });
}

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
    requestIds: ["req-1"],
    sourceSuggestionIds: ["source-1"],
    rationale: "Test suggestion.",
    suggestedAction: "Add tool hint.",
    patchPreview: {
      kind: "append_intent_tool_hint",
      intentId,
      toolName,
    },
  };
}

function reviewOnlySuggestion(
  intentId: string,
  signal: string,
): AssistantWorkflowDefinitionTuningSuggestion {
  return {
    id: `review_quality_signal:${intentId}:${signal}`,
    action: "review_quality_signal",
    severity: "warning",
    intentId,
    toolName: null,
    signal,
    count: 2,
    requestIds: ["req-review"],
    sourceSuggestionIds: ["source-review"],
    rationale: "Quality signal needs semantic review.",
    suggestedAction: "Inspect the affected traces before changing runtime behavior.",
    patchPreview: {
      kind: "none",
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
    requestIds: ["req-2"],
    sourceSuggestionIds: ["source-2"],
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

function smokeResult(options: {
  failCount?: number;
  requiredFailCount?: number;
} = {}): AssistantWorkflowDefinitionPackageSmokeSuiteResult {
  const failCount = options.failCount ?? 0;
  const requiredFailCount = options.requiredFailCount ?? 0;
  return {
    summary: {
      caseCount: 1,
      runCaseCount: 1,
      executionCaseCount: 0,
      passCount: failCount > 0 ? 0 : 1,
      failCount,
      requiredFailCount,
      failedCaseIds: failCount > 0 ? ["definition-tuning-answer_docs"] : [],
      requiredFailedCaseIds: requiredFailCount > 0 ? ["definition-tuning-answer_docs"] : [],
    },
    cases: [],
  };
}
