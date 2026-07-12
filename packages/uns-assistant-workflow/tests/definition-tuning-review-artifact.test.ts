import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowDefinitionTuningSuggestions,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionTuningReview,
  buildAssistantWorkflowDefinitionTuningReviewArtifact,
  defineAssistantWorkflow,
  parseAssistantWorkflowDefinitionTuningReviewArtifact,
  runAssistantWorkflowDefinitionTuningReplayLines,
  stringifyAssistantWorkflowDefinitionTuningReviewArtifact,
  stringifyAssistantWorkflowDefinitionTuningSuggestionLines,
  type AssistantWorkflowDefinitionPackageSmokeSuiteResult,
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

describe("assistant workflow definition tuning review artifact", () => {
  it("builds a schema-versioned review artifact and parses it back", () => {
    const replay = runAssistantWorkflowDefinitionTuningReplayLines({
      suggestionLines: stringifyAssistantWorkflowDefinitionTuningSuggestionLines([
        suggestion("answer_docs", "list_sources"),
        suggestion("answer_docs", "query_docs"),
        reviewOnlySuggestion("answer_docs", "expected_artifact_missing"),
      ]),
    }, {
      onlyApplicable: false,
    });
    const applyResult = applyAssistantWorkflowDefinitionTuningSuggestions(
      WORKFLOW,
      replay.batch.suggestions,
      { suggestionIds: ["add_intent_tool_hint:answer_docs:list_sources"] },
    );
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([applyResult.definition], {
      packageId: "support-package",
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const smoke = smokeResult();
    const review = buildAssistantWorkflowDefinitionTuningReview(applyResult, smoke);
    const artifact = buildAssistantWorkflowDefinitionTuningReviewArtifact({
      replay,
      applyResult,
      definitionPackage,
      smoke,
      review,
      generatedAt: "2026-06-29T11:00:00.000Z",
      reviewContext: {
        source: "unit-test",
        onlyApplicable: true,
        maxToolHintsPerIntent: 2,
      },
    });

    expect(artifact).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-06-29T11:00:00.000Z",
      workflowId: "support-agent",
      workflowVersion: 2,
      reviewContext: {
        source: "unit-test",
        onlyApplicable: true,
        maxToolHintsPerIntent: 2,
      },
      suggestions: {
        summary: {
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
        applied: [{
          id: "add_intent_tool_hint:answer_docs:list_sources",
          intentId: "answer_docs",
          toolName: "list_sources",
          count: 1,
          requestIds: ["req-1"],
        }],
        skipped: [{
          id: "add_intent_tool_hint:answer_docs:query_docs",
          reason: "not_selected",
          suggestion: {
            id: "add_intent_tool_hint:answer_docs:query_docs",
          },
        }, {
          id: "review_quality_signal:answer_docs:expected_artifact_missing",
          reason: "not_selected",
          suggestion: {
            id: "review_quality_signal:answer_docs:expected_artifact_missing",
          },
        }],
        reviewOnly: [{
          id: "review_quality_signal:answer_docs:expected_artifact_missing",
          action: "review_quality_signal",
        }],
      },
      patchedDefinition: {
        workflowId: "support-agent",
        workflowVersion: 2,
      },
      review: {
        status: "ready",
      },
    });

    const parsed = parseAssistantWorkflowDefinitionTuningReviewArtifact(
      JSON.parse(stringifyAssistantWorkflowDefinitionTuningReviewArtifact(artifact)),
    );

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      workflowId: "support-agent",
      workflowVersion: 2,
      suggestions: {
        summary: {
          appliedCount: 1,
          skippedCount: 2,
          reviewOnlyCount: 1,
        },
        applied: [{
          id: "add_intent_tool_hint:answer_docs:list_sources",
          requestIds: ["req-1"],
        }],
        skipped: [{
          id: "add_intent_tool_hint:answer_docs:query_docs",
          reason: "not_selected",
        }, {
          id: "review_quality_signal:answer_docs:expected_artifact_missing",
          reason: "not_selected",
        }],
        reviewOnly: [{
          id: "review_quality_signal:answer_docs:expected_artifact_missing",
        }],
      },
      review: {
        status: "ready",
      },
    });
  });

  it("rejects malformed review artifacts", () => {
    expect(parseAssistantWorkflowDefinitionTuningReviewArtifact({
      schemaVersion: 999,
    })).toBeNull();
    expect(parseAssistantWorkflowDefinitionTuningReviewArtifact({
      schemaVersion: 1,
      generatedAt: "2026-06-29T11:00:00.000Z",
      workflowId: "support-agent",
      workflowVersion: 2,
      reviewContext: {},
      replay: {},
      apply: {},
      patchedDefinition: null,
      patchedPackage: {},
      smoke: null,
      review: {},
    })).toBeNull();
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
    requestIds: ["req-2"],
    sourceSuggestionIds: ["source-2"],
    rationale: "Quality signal needs review.",
    suggestedAction: "Inspect the affected trace before changing the definition.",
    patchPreview: {
      kind: "none",
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
