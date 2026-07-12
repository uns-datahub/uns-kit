import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionTuningApprovalArtifact,
  buildAssistantWorkflowDefinitionTuningApprovalTemplateFromReview,
  buildAssistantWorkflowDefinitionTuningApprovalTracePayload,
  type AssistantWorkflowDefinitionTuningReviewArtifact,
  parseAssistantWorkflowDefinitionTuningApprovalArtifact,
  readApprovedAssistantWorkflowDefinitionTuningSuggestionIds,
  stringifyAssistantWorkflowDefinitionTuningApprovalArtifact,
} from "../src/index.js";

describe("assistant workflow definition tuning approval artifact", () => {
  it("builds, serializes, parses, and summarizes approval decisions", () => {
    const artifact = buildAssistantWorkflowDefinitionTuningApprovalArtifact([
      {
        suggestionId: "add_intent_tool_hint:value_lookup:get_instance_journey",
        decision: "approved",
        note: "Matches latest-value support workflow.",
        decidedBy: "reviewer",
        decidedAt: "2026-06-29T10:00:00.000Z",
      },
      {
        suggestionId: "add_intent_tool_hint:value_lookup:get_batch_comparison_chart",
        decision: "rejected",
        note: "Chart-only tool does not fit value lookup.",
      },
      {
        suggestionId: "add_intent_tool_hint:instance_journey_query:get_instance_journey",
        decision: "pending",
      },
    ], {
      generatedAt: "2026-06-29T11:00:00.000Z",
      workflowId: "uns-assistant-default",
      workflowVersion: 2,
      sourceReviewArtifactGeneratedAt: "2026-06-29T10:30:00.000Z",
    });

    expect(artifact).toMatchObject({
      schemaVersion: 1,
      workflowId: "uns-assistant-default",
      workflowVersion: 2,
      decisions: [{
        suggestionId: "add_intent_tool_hint:instance_journey_query:get_instance_journey",
        decision: "pending",
      }, {
        suggestionId: "add_intent_tool_hint:value_lookup:get_batch_comparison_chart",
        decision: "rejected",
      }, {
        suggestionId: "add_intent_tool_hint:value_lookup:get_instance_journey",
        decision: "approved",
      }],
    });
    expect(readApprovedAssistantWorkflowDefinitionTuningSuggestionIds(artifact)).toEqual([
      "add_intent_tool_hint:value_lookup:get_instance_journey",
    ]);
    expect(buildAssistantWorkflowDefinitionTuningApprovalTracePayload(artifact)).toMatchObject({
      decisionCount: 3,
      pendingCount: 1,
      approvedCount: 1,
      rejectedCount: 1,
      pendingSuggestionIds: ["add_intent_tool_hint:instance_journey_query:get_instance_journey"],
      approvedSuggestionIds: ["add_intent_tool_hint:value_lookup:get_instance_journey"],
      rejectedSuggestionIds: ["add_intent_tool_hint:value_lookup:get_batch_comparison_chart"],
    });

    const parsed = parseAssistantWorkflowDefinitionTuningApprovalArtifact(
      JSON.parse(stringifyAssistantWorkflowDefinitionTuningApprovalArtifact(artifact)),
    );

    expect(parsed).toMatchObject({
      schemaVersion: 1,
      workflowId: "uns-assistant-default",
      decisions: [{
        decision: "pending",
      }, {
        decision: "rejected",
      }, {
        decision: "approved",
      }],
    });
  });

  it("uses the last decision for duplicate suggestion ids", () => {
    const artifact = buildAssistantWorkflowDefinitionTuningApprovalArtifact([
      {
        suggestionId: "suggestion-a",
        decision: "approved",
      },
      {
        suggestionId: "suggestion-a",
        decision: "rejected",
      },
    ]);

    expect(artifact.decisions).toEqual([{
      suggestionId: "suggestion-a",
      decision: "rejected",
    }]);
  });

  it("builds a pending approval template from review artifact applied suggestions", () => {
    const artifact = buildAssistantWorkflowDefinitionTuningApprovalTemplateFromReview(
      minimalReviewArtifact(),
      {
        generatedAt: "2026-06-29T12:00:00.000Z",
        decidedBy: "semantic-review",
      },
    );

    expect(artifact).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-06-29T12:00:00.000Z",
      workflowId: "uns-assistant-default",
      workflowVersion: 2,
      sourceReviewArtifactGeneratedAt: "2026-06-29T11:30:00.000Z",
      decisions: [{
        suggestionId: "add_intent_tool_hint:instance_journey_query:get_batch_comparison_chart",
        decision: "pending",
        note: "Review required: tool_output_presentation_mismatch.",
        decidedBy: "semantic-review",
      }, {
        suggestionId: "add_intent_tool_hint:value_lookup:get_instance_journey",
        decision: "pending",
        note: "Pending semantic review.",
        decidedBy: "semantic-review",
      }],
    });
    expect(readApprovedAssistantWorkflowDefinitionTuningSuggestionIds(artifact)).toEqual([]);
    expect(buildAssistantWorkflowDefinitionTuningApprovalTracePayload(artifact)).toMatchObject({
      decisionCount: 2,
      pendingCount: 2,
      approvedCount: 0,
      pendingSuggestionIds: [
        "add_intent_tool_hint:instance_journey_query:get_batch_comparison_chart",
        "add_intent_tool_hint:value_lookup:get_instance_journey",
      ],
    });
  });

  it("adds approval notes for applied suggestions with deferred review-only signals", () => {
    const artifact = minimalReviewArtifact();
    artifact.suggestions.applied = [{
      schemaVersion: 1,
      id: "add_intent_tool_hint:chart_single:list_measured_attributes",
      action: "add_intent_tool_hint",
      severity: "info",
      intentId: "chart_single",
      toolName: "list_measured_attributes",
      signal: null,
      count: 5,
      requestIds: ["request-chart"],
      sourceSuggestionIds: ["source-chart"],
      rationale: "Chart traces selected measured attributes.",
      suggestedAction: "Add list_measured_attributes after review.",
      patchPreview: {
        kind: "append_intent_tool_hint",
        intentId: "chart_single",
        toolName: "list_measured_attributes",
      },
    }];
    artifact.suggestions.reviewOnly = [{
      schemaVersion: 1,
      id: "review_quality_signal:chart_single:expected_artifact_missing",
      action: "review_quality_signal",
      severity: "warning",
      intentId: "chart_single",
      toolName: null,
      signal: "expected_artifact_missing",
      count: 20,
      requestIds: ["request-quality"],
      sourceSuggestionIds: ["source-quality"],
      rationale: "Chart response missed an expected artifact.",
      suggestedAction: "Inspect chart artifact traces before promotion.",
      patchPreview: {
        kind: "none",
      },
    }, {
      schemaVersion: 1,
      id: "review_clarification_rule:chart_single:ambiguous_topic_scope",
      action: "review_clarification_rule",
      severity: "warning",
      intentId: "chart_single",
      toolName: null,
      signal: "ambiguous_topic_scope",
      count: 1,
      requestIds: ["request-clarification"],
      sourceSuggestionIds: ["source-clarification"],
      rationale: "Chart request had ambiguous topic scope.",
      suggestedAction: "Review clarification policy.",
      patchPreview: {
        kind: "none",
      },
    }];
    artifact.review = {
      status: "ready",
      reasons: [],
    };

    const approval = buildAssistantWorkflowDefinitionTuningApprovalTemplateFromReview(artifact);

    expect(approval.decisions).toMatchObject([{
      suggestionId: "add_intent_tool_hint:chart_single:list_measured_attributes",
      decision: "pending",
      note: "Review required: deferred_review_signals (ambiguous_topic_scope, expected_artifact_missing).",
    }]);
  });

  it("rejects malformed approval artifacts", () => {
    expect(parseAssistantWorkflowDefinitionTuningApprovalArtifact({
      schemaVersion: 999,
    })).toBeNull();
    expect(parseAssistantWorkflowDefinitionTuningApprovalArtifact({
      schemaVersion: 1,
      generatedAt: "2026-06-29T11:00:00.000Z",
      workflowId: null,
      workflowVersion: null,
      sourceReviewArtifactGeneratedAt: null,
      decisions: [{
        suggestionId: "suggestion-a",
        decision: "maybe",
      }],
    })).toBeNull();
  });
});

function minimalReviewArtifact(): AssistantWorkflowDefinitionTuningReviewArtifact {
  return {
    schemaVersion: 1,
    generatedAt: "2026-06-29T11:30:00.000Z",
    workflowId: "uns-assistant-default",
    workflowVersion: 2,
    reviewContext: {},
    suggestions: {
      summary: {
        appliedCount: 2,
        skippedCount: 0,
        reviewOnlyCount: 0,
        skipReasonCounts: [],
        reviewOnlyActionCounts: [],
        reviewOnlySignalCounts: [],
      },
      applied: [{
        schemaVersion: 1,
        id: "add_intent_tool_hint:value_lookup:get_instance_journey",
        action: "add_intent_tool_hint",
        severity: "info",
        intentId: "value_lookup",
        toolName: "get_instance_journey",
        signal: "tool_used_after_intent",
        count: 3,
        requestIds: ["request-a"],
        sourceSuggestionIds: ["source-a"],
        rationale: "Value lookups often inspect journeys.",
        suggestedAction: "Add get_instance_journey as a tool hint.",
        patchPreview: {
          kind: "append_intent_tool_hint",
          intentId: "value_lookup",
          toolName: "get_instance_journey",
        },
      }, {
        schemaVersion: 1,
        id: "add_intent_tool_hint:instance_journey_query:get_batch_comparison_chart",
        action: "add_intent_tool_hint",
        severity: "warning",
        intentId: "instance_journey_query",
        toolName: "get_batch_comparison_chart",
        signal: "tool_used_after_intent",
        count: 1,
        requestIds: ["request-b"],
        sourceSuggestionIds: ["source-b"],
        rationale: "Journey traces sometimes produce charts.",
        suggestedAction: "Review chart output compatibility.",
        patchPreview: {
          kind: "append_intent_tool_hint",
          intentId: "instance_journey_query",
          toolName: "get_batch_comparison_chart",
        },
      }],
      skipped: [],
      reviewOnly: [],
    },
    replay: {},
    apply: {},
    patchedDefinition: {
      schemaVersion: 1,
      id: "uns-assistant-default",
      version: 2,
      intents: [],
      tools: [],
      memory: [],
      planning: [],
      policies: [],
      prompts: [],
      evaluations: [],
    },
    patchedPackage: {},
    smoke: null,
    review: {
      status: "warning",
      reasons: [{
        severity: "warning",
        code: "tool_output_presentation_mismatch",
        message: "Chart tool added to a table presentation intent.",
        details: {
          intentId: "instance_journey_query",
          toolName: "get_batch_comparison_chart",
        },
      }],
    },
  } as unknown as AssistantWorkflowDefinitionTuningReviewArtifact;
}
