import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowDefinitionTuningSuggestions,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionTuningPromotion,
  buildAssistantWorkflowDefinitionTuningReview,
  buildAssistantWorkflowDefinitionTuningReviewArtifact,
  buildAssistantWorkflowDefinitionTuningSourcePatchArtifact,
  buildAssistantWorkflowDefinitionTuningSourcePatchTracePayload,
  defineAssistantWorkflow,
  parseAssistantWorkflowDefinitionTuningSourcePatchArtifact,
  runAssistantWorkflowDefinitionTuningReplayLines,
  stringifyAssistantWorkflowDefinitionTuningSourcePatchArtifact,
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
});

describe("assistant workflow definition tuning source patch", () => {
  it("builds a ready source patch artifact from a promotable review artifact", () => {
    const reviewArtifact = artifact();
    const promotion = buildAssistantWorkflowDefinitionTuningPromotion(reviewArtifact);
    const patch = buildAssistantWorkflowDefinitionTuningSourcePatchArtifact(reviewArtifact, promotion, {
      generatedAt: "2026-06-29T12:00:00.000Z",
      suggestedFileName: "support-agent.workflow.json",
    });

    expect(patch).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-06-29T12:00:00.000Z",
      workflowId: "support-agent",
      fromVersion: 1,
      toVersion: 2,
      status: "ready",
      target: {
        kind: "serialized_definition_file",
        suggestedFileName: "support-agent.workflow.json",
      },
      reasons: [],
      operations: [{
        kind: "replace_workflow_definition",
        workflowId: "support-agent",
        fromVersion: 1,
        toVersion: 2,
        format: "assistant_workflow_serialized_definition_json",
        definition: {
          workflowId: "support-agent",
          workflowVersion: 2,
          summary: {
            valid: true,
          },
        },
      }],
    });
    expect(buildAssistantWorkflowDefinitionTuningSourcePatchTracePayload(patch)).toMatchObject({
      status: "ready",
      operationCount: 1,
      operations: [{
        kind: "replace_workflow_definition",
        definitionSummary: {
          workflowVersion: 2,
          valid: true,
        },
      }],
    });

    const parsed = parseAssistantWorkflowDefinitionTuningSourcePatchArtifact(
      JSON.parse(stringifyAssistantWorkflowDefinitionTuningSourcePatchArtifact(patch)),
    );

    expect(parsed).toMatchObject({
      status: "ready",
      operations: [{
        definition: {
          workflowVersion: 2,
        },
      }],
    });
  });

  it("blocks source patch operations when promotion is not promotable", () => {
    const reviewArtifact = artifact({ smoke: null });
    const promotion = buildAssistantWorkflowDefinitionTuningPromotion(reviewArtifact);
    const patch = buildAssistantWorkflowDefinitionTuningSourcePatchArtifact(reviewArtifact, promotion);

    expect(patch).toMatchObject({
      status: "blocked",
      operations: [],
      reasons: [{
        code: "promotion_not_promotable",
        details: {
          promotionStatus: "blocked",
          reasonCodes: ["review_warning", "missing_smoke"],
        },
      }],
    });
  });
});

function artifact(options: {
  smoke?: AssistantWorkflowDefinitionPackageSmokeSuiteResult | null;
} = {}): AssistantWorkflowDefinitionTuningReviewArtifact {
  const replay = runAssistantWorkflowDefinitionTuningReplayLines({
    suggestionLines: stringifyAssistantWorkflowDefinitionTuningSuggestionLines([
      suggestion("answer_docs", "list_sources"),
    ]),
  }, {
    onlyApplicable: true,
  });
  const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(
    WORKFLOW,
    replay.batch.suggestions,
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

function smokeResult(): AssistantWorkflowDefinitionPackageSmokeSuiteResult {
  return {
    summary: {
      caseCount: 1,
      runCaseCount: 1,
      executionCaseCount: 0,
      passCount: 1,
      failCount: 0,
      requiredFailCount: 0,
      failedCaseIds: [],
      requiredFailedCaseIds: [],
    },
    cases: [],
  };
}
