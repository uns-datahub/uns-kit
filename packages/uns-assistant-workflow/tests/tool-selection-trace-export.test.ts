import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowCurrentSerializedToolSelectionDecisionsFromTraceEvents,
  buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent,
  buildAssistantWorkflowSerializedToolSelectionDecisionsFromTraceEvents,
  buildAssistantWorkflowToolSelectionEvalCasesFromTraceEvents,
  buildAssistantWorkflowToolSelectionTraceEvalCaseExportPayload,
  buildAssistantWorkflowToolSelectionTraceExportPayload,
  defineAssistantWorkflow,
  type AssistantWorkflowTraceEvent,
} from "../src/index.js";

describe("assistant workflow tool selection trace export", () => {
  it("builds serialized tool-selection decisions from workflow comparison trace events", () => {
    const event: AssistantWorkflowTraceEvent = {
      stage: "tool_selection.workflow_comparison",
      timestamp: "2026-06-29T10:00:00.000Z",
      payload: {
        hop: 0,
        selectedReason: "workflow_equivalent",
        intent: "answer_docs",
        matchedIntent: true,
        effectivePresentation: "text",
        workflowSuggestedTools: ["query_docs", "list_docs"],
        workflowSelectionCandidateTools: ["query_docs"],
        workflowSelectionOptionalToolMode: "classifier-confirmed",
        workflowSelectionExcludedOptionalTools: ["list_docs"],
        missingWorkflowSelectionCandidateTools: [],
        selectedOutsideWorkflowSelectionCandidate: [],
        authority: {
          source: "workflow",
          reason: "workflow_equivalent",
          selectedToolNames: ["query_docs"],
          workflowSuggestedToolNames: ["query_docs", "list_docs"],
          workflowStatus: "ready",
        },
      },
    };

    expect(buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent(event)).toMatchObject({
      schemaVersion: 1,
      authority: {
        source: "workflow",
        reason: "workflow_equivalent",
        selectedToolNames: ["query_docs"],
        workflowSuggestedToolNames: ["query_docs", "list_docs"],
        workflowStatus: "ready",
      },
      effectiveToolNames: ["query_docs"],
      effectiveReason: "workflow_equivalent",
      comparisonPayload: {
        intent: "answer_docs",
        workflowSelectionCandidateTools: ["query_docs"],
      },
    });
  });

  it("exports all valid decision events and counts skipped candidates", () => {
    const result = buildAssistantWorkflowSerializedToolSelectionDecisionsFromTraceEvents([
      { stage: "chat.request.start", payload: { message: "Question" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          selectedReason: "intent_pruned",
          workflowSuggestedTools: ["query_docs"],
          workflowSelectionCandidateTools: ["query_docs"],
          authority: {
            source: "legacy-pruner",
            reason: "workflow_differs",
            selectedToolNames: ["query_docs", "list_docs"],
            workflowSuggestedToolNames: ["query_docs"],
            workflowStatus: "ready",
          },
        },
      },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          selectedReason: "intent_pruned",
          authority: {
            source: "unknown",
            reason: "workflow_differs",
            selectedToolNames: ["query_docs"],
            workflowSuggestedToolNames: ["query_docs"],
            workflowStatus: "ready",
          },
        },
      },
    ]);

    expect(result).toMatchObject({
      traceEventCount: 3,
      candidateEventCount: 2,
      decisionCount: 1,
      skippedCandidateEventCount: 1,
      decisions: [{
        authority: {
          source: "legacy-pruner",
          reason: "workflow_differs",
        },
        effectiveToolNames: ["query_docs", "list_docs"],
        effectiveReason: "intent_pruned",
      }],
    });
    expect(buildAssistantWorkflowToolSelectionTraceExportPayload(result)).toEqual({
      traceEventCount: 3,
      candidateEventCount: 2,
      decisionCount: 1,
      skippedCandidateEventCount: 1,
    });
  });

  it("infers legacy authority for older workflow comparison traces without authority payloads", () => {
    const decision = buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent({
      stage: "tool_selection.workflow_comparison",
      payload: {
        selectedReason: "intent_pruned",
        workflowSuggestedTools: ["get_attribute_latest_values"],
        missingWorkflowSuggestedTools: [],
        selectedOutsideWorkflowSuggestions: ["list_uns_tree", "get_server_time"],
      },
    });

    expect(decision).toMatchObject({
      authority: {
        source: "legacy-pruner",
        reason: "workflow_differs",
        selectedToolNames: ["get_attribute_latest_values", "list_uns_tree", "get_server_time"],
        workflowSuggestedToolNames: ["get_attribute_latest_values"],
        workflowStatus: null,
      },
      effectiveToolNames: ["get_attribute_latest_values", "list_uns_tree", "get_server_time"],
      effectiveReason: "intent_pruned",
    });
  });

  it("records a pruning-disabled legacy selection as not exercised", () => {
    const decision = buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent({
      stage: "tool_selection.workflow_comparison",
      payload: {
        pruningEnabled: false,
        selectedReason: "disabled",
        workflowSuggestedTools: ["query_docs"],
        workflowSelectionCandidateTools: ["query_docs"],
        missingWorkflowSelectionCandidateTools: ["query_docs"],
        selectedOutsideWorkflowSelectionCandidate: ["list_docs"],
      },
    });

    expect(decision).toMatchObject({
      authority: {
        source: "legacy-pruner",
        reason: "workflow_selection_not_exercised",
        selectedToolNames: ["list_docs"],
        workflowSuggestedToolNames: ["query_docs"],
        workflowStatus: null,
      },
      effectiveToolNames: ["list_docs"],
      effectiveReason: "disabled",
    });
  });

  it("infers workflow authority for sanitized promoted traces without authority payloads", () => {
    const decision = buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent({
      stage: "tool_selection.workflow_comparison",
      payload: {
        selectedReason: "workflow_authority_enabled",
        selectedToolCount: 2,
        workflowSuggestedTools: [
          "get_instance_journey",
          "get_attribute_data_view",
          "resolve_topic_path",
          "get_api_data_view",
        ],
        workflowSelectionCandidateTools: [
          "get_instance_journey",
          "get_attribute_data_view",
        ],
        selectedOutsideWorkflowSelectionCandidate: [
          "list_uns_tree",
          "get_attribute_data_preview",
        ],
        workflowRun: { status: "ready" },
      },
    });

    expect(decision).toMatchObject({
      authority: {
        source: "workflow",
        reason: "workflow_authority_enabled",
        selectedToolNames: [
          "get_instance_journey",
          "get_attribute_data_view",
        ],
        workflowSuggestedToolNames: [
          "get_instance_journey",
          "get_attribute_data_view",
          "resolve_topic_path",
          "get_api_data_view",
        ],
        workflowStatus: "ready",
      },
      effectiveToolNames: [
        "get_instance_journey",
        "get_attribute_data_view",
      ],
      effectiveReason: "workflow_authority_enabled",
    });
  });

  it("recomputes older trace selections against the current workflow definition", () => {
    const workflow = defineAssistantWorkflow({
      id: "current-selection-replay-agent",
      version: 1,
      intents: [{
        id: "value_lookup",
        description: "Read current values.",
        defaultPresentation: "text",
        toolHints: ["get_attribute_latest_values"],
        toolSelectionProfiles: [{
          id: "follow_up_value_lookup_fallback",
          description: "Expose broad read-only tools on follow-up hops.",
          condition: {
            minHop: 1,
            selectedReason: "intent_pruned",
          },
          toolHints: ["list_uns_tree", "get_server_time"],
        }],
      }],
      tools: [
        capability("get_attribute_latest_values"),
        capability("list_uns_tree"),
        capability("get_server_time"),
      ],
      presentations: [{ id: "text", description: "Text." }],
    });

    const result = buildAssistantWorkflowCurrentSerializedToolSelectionDecisionsFromTraceEvents([
      {
        stage: "planner_classifier.done",
        payload: {
          intent: "value_lookup",
          presentation: "text",
          tools: ["get_attribute_latest_values"],
          confidence: 0.9,
          containers: ["furnace"],
          attributes: ["slab_count"],
          timeWindowHint: "last_values",
        },
      },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          hop: 1,
          selectedMode: "pruned",
          selectedReason: "intent_pruned",
          intent: "value_lookup",
          workflowSuggestedTools: ["get_attribute_latest_values"],
          missingWorkflowSuggestedTools: [],
          selectedOutsideWorkflowSuggestions: ["list_uns_tree", "get_server_time"],
        },
      },
    ], {
      workflow,
      workflowAuthorityIntentIds: ["value_lookup"],
    });

    expect(result).toMatchObject({
      candidateEventCount: 1,
      decisionCount: 1,
      skippedCandidateEventCount: 0,
      decisions: [{
        authority: {
          source: "workflow",
          reason: "workflow_equivalent",
          selectedToolNames: ["get_attribute_latest_values", "list_uns_tree", "get_server_time"],
          workflowStatus: "ready",
        },
        comparisonPayload: {
          workflowSelectionActiveProfileIds: ["follow_up_value_lookup_fallback"],
          workflowSelectionProfileTools: ["list_uns_tree", "get_server_time"],
          workflowSelectionCandidateTools: ["get_attribute_latest_values", "list_uns_tree", "get_server_time"],
          selectedOutsideWorkflowSelectionCandidate: [],
          missingWorkflowSelectionCandidateTools: [],
        },
      }],
    });
  });

  it("builds eval cases from trace prompt plus exported tool-selection decisions", () => {
    const result = buildAssistantWorkflowToolSelectionEvalCasesFromTraceEvents([
      { stage: "chat.request.start", payload: { message: "How do I start the furnace?" } },
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          selectedReason: "workflow_equivalent",
          intent: "rag_documentation",
          effectivePresentation: "text",
          workflowSuggestedTools: ["list_rag_sources", "query_rag_evidence"],
          workflowSelectionCandidateTools: ["list_rag_sources", "query_rag_evidence"],
          plan: {
            stepIds: ["list_sources", "query_evidence"],
            activePlanningStepProfileIds: ["rag_source_listing_context"],
            profileStepIds: ["list_sources"],
          },
          authority: {
            source: "workflow",
            reason: "workflow_equivalent",
            selectedToolNames: ["list_rag_sources", "query_rag_evidence"],
            workflowSuggestedToolNames: ["list_rag_sources", "query_rag_evidence"],
            workflowStatus: "ready",
          },
        },
      },
    ], {
      required: true,
      tags: ["trace-export"],
      source: {
        requestId: "req-1",
        debugId: "debug-1",
        createdAt: "2026-06-29T10:00:00.000Z",
      },
    });

    expect(result).toMatchObject({
      prompt: "How do I start the furnace?",
      decisionCount: 1,
      evalCaseCount: 1,
      missingPromptCount: 0,
      cases: [{
        prompt: "How do I start the furnace?",
        required: true,
        tags: ["trace-export"],
        source: {
          kind: "tool-selection",
          requestId: "req-1",
          debugId: "debug-1",
          createdAt: "2026-06-29T10:00:00.000Z",
        },
        expectations: {
          intent: "rag_documentation",
          presentation: "text",
          planStepIds: ["list_sources", "query_evidence"],
          activePlanningStepProfileIds: ["rag_source_listing_context"],
          profileStepIds: ["list_sources"],
          tools: ["list_rag_sources", "query_rag_evidence"],
          signalNames: ["workflow", "workflow_equivalent"],
        },
        metadata: {
          authoritySource: "workflow",
          authorityReason: "workflow_equivalent",
          traceDecisionIndex: 0,
        },
      }],
    });
    expect(buildAssistantWorkflowToolSelectionTraceEvalCaseExportPayload(result)).toMatchObject({
      decisionCount: 1,
      evalCaseCount: 1,
      missingPromptCount: 0,
    });
  });

  it("skips eval cases when no prompt is available", () => {
    const result = buildAssistantWorkflowToolSelectionEvalCasesFromTraceEvents([
      {
        stage: "tool_selection.workflow_comparison",
        payload: {
          selectedReason: "intent_pruned",
          workflowSuggestedTools: ["query_docs"],
          authority: {
            source: "legacy-pruner",
            reason: "workflow_differs",
            selectedToolNames: ["query_docs"],
            workflowSuggestedToolNames: ["query_docs"],
            workflowStatus: "ready",
          },
        },
      },
    ]);

    expect(result).toMatchObject({
      prompt: null,
      decisionCount: 1,
      evalCaseCount: 0,
      missingPromptCount: 1,
      cases: [],
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
