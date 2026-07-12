import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowToolSelectionDecision,
  buildAssistantWorkflowToolSelectionReplayLinesTracePayload,
  defineAssistantWorkflow,
  runAssistantWorkflowToolSelectionReplayLines,
  stringifyAssistantWorkflowToolSelectionDecisionLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool selection replay", () => {
  it("builds decision batches from serialized decision lines", () => {
    const workflowDefinition = defineAssistantWorkflow(workflow());
    const workflowDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    });
    const legacyDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs", "list_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    });

    const result = runAssistantWorkflowToolSelectionReplayLines({
      decisionLines: stringifyAssistantWorkflowToolSelectionDecisionLines([workflowDecision, legacyDecision]),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyInteresting: true,
      currentAuthorityIntentIds: ["value_lookup"],
    });

    expect(result).toMatchObject({
      decisionParse: {
        lineCount: 2,
        decisionCount: 2,
        errorCount: 0,
      },
      parseErrorCount: 0,
      batch: {
        schemaVersion: 1,
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceDecisionCount: 2,
        decisionCount: 1,
        summary: {
          decisionCount: 1,
          interestingDecisionCount: 1,
          legacyAuthorityCount: 1,
          authorityReasonCounts: [{
            key: "workflow_differs",
            count: 1,
          }],
          effectiveToolCounts: [{
            key: "list_docs",
            count: 1,
          }, {
            key: "query_docs",
            count: 1,
          }],
        },
        decisions: [{
          authority: {
            source: "legacy-pruner",
          reason: "workflow_differs",
        },
      }],
      },
      evaluation: {
        sourceDecisionCount: 1,
        rowCount: 1,
        warningRowCount: 0,
        signalCounts: [{
          name: "legacy_authority",
          severity: "info",
          count: 1,
        }, {
          name: "selected_outside_workflow_candidate",
          severity: "info",
          count: 1,
        }, {
          name: "selected_policy_excluded_optional_tool",
          severity: "info",
          count: 1,
        }, {
          name: "workflow_differs",
          severity: "info",
          count: 1,
        }],
      },
      migration: {
        suggestedAuthorityIntentIds: [],
        reviewCandidates: expect.arrayContaining([
          expect.objectContaining({
            intentId: "answer_docs",
            blockingReasons: ["workflow_differs"],
          }),
        ]),
      },
      migrationProposal: {
        currentAuthorityIntentIds: ["value_lookup"],
        addIntentIds: [],
        keepIntentIds: ["value_lookup"],
        proposedAuthorityIntentIds: ["value_lookup"],
        reviewIntentIds: ["answer_docs"],
        canApplyAdditions: false,
      },
    });
  });

  it("keeps parse errors and summarizes valid decision lines", () => {
    const workflowDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    });

    const result = runAssistantWorkflowToolSelectionReplayLines({
      decisionLines: [
        stringifyAssistantWorkflowToolSelectionDecisionLines([workflowDecision]),
        "{invalid",
        JSON.stringify({ schemaVersion: 1 }),
      ].join("\n"),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(result).toMatchObject({
      decisionParse: {
        lineCount: 3,
        decisionCount: 1,
        errorCount: 2,
        errors: [{
          lineNumber: 2,
          reason: "invalid_json",
        }, {
          lineNumber: 3,
          reason: "invalid_tool_selection",
        }],
      },
      parseErrorCount: 2,
      batch: {
        sourceDecisionCount: 1,
        decisionCount: 1,
        summary: {
          workflowAuthorityCount: 1,
          legacyAuthorityCount: 0,
          authoritySourceCounts: [{
            key: "workflow",
            count: 1,
          }],
        },
      },
      evaluation: {
        sourceDecisionCount: 1,
        rowCount: 1,
        warningRowCount: 0,
      },
      migration: {
        suggestedAuthorityIntentIds: [],
      },
    });
  });

  it("builds a compact replay trace payload", () => {
    const unavailableDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: null,
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
    });
    const result = runAssistantWorkflowToolSelectionReplayLines({
      decisionLines: stringifyAssistantWorkflowToolSelectionDecisionLines([unavailableDecision]),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(buildAssistantWorkflowToolSelectionReplayLinesTracePayload(result)).toMatchObject({
      decisionParse: {
        decisionCount: 1,
        errorCount: 0,
      },
      parseErrorCount: 0,
      batch: {
        sourceDecisionCount: 1,
        decisionCount: 1,
        summary: {
          legacyAuthorityCount: 1,
          authorityReasonCounts: [{
            key: "workflow_unavailable",
            count: 1,
          }],
        },
      },
      evaluation: {
        sourceDecisionCount: 1,
        rowCount: 1,
        warningRowCount: 1,
        signalCounts: [{
          name: "workflow_unavailable",
        }, {
          name: "legacy_authority",
        }],
      },
      migration: {
        reviewCandidates: [{
          blockingReasons: expect.arrayContaining(["workflow_unavailable"]),
        }, {
          blockingReasons: expect.arrayContaining(["workflow_unavailable"]),
        }],
      },
      migrationProposal: {
        addIntentIds: [],
        addSegmentKeys: [],
        canApplyAdditions: false,
        reviewIntentIds: ["unknown"],
        reviewSegmentKeys: ["unknown|hop:unknown|unknown"],
      },
    });
  });

  it("surfaces migration proposal additions in replay payloads", () => {
    const readyDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["value_lookup"],
    });

    const result = runAssistantWorkflowToolSelectionReplayLines({
      decisionLines: stringifyAssistantWorkflowToolSelectionDecisionLines([readyDecision]),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      currentAuthorityIntentIds: ["value_lookup"],
      currentAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned"],
      migrationReviewTitle: "Replay migration review",
      migrationReviewPatchTargets: ["src/default-workflow.ts"],
      migrationReviewRequiredTestIds: ["pnpm test"],
    });

    expect(result.migrationReviewArtifact).toMatchObject({
      title: "Replay migration review",
      status: "ready_for_runtime_change",
      recommendedAction: "apply_authority_allow_list_update",
      patchTargets: ["src/default-workflow.ts"],
      requiredTestIds: ["pnpm test"],
      runtimeChange: {
        addIntentIds: ["answer_docs"],
        addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      },
    });
    expect(result.migrationProposal).toMatchObject({
      currentAuthorityIntentIds: ["value_lookup"],
      currentAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned"],
      suggestedAuthorityIntentIds: ["answer_docs"],
      suggestedAuthoritySegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      addIntentIds: ["answer_docs"],
      addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      keepIntentIds: ["value_lookup"],
      keepSegmentKeys: ["value_lookup|hop:1|intent_pruned"],
      proposedAuthorityIntentIds: ["value_lookup", "answer_docs"],
      proposedAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned", "answer_docs|hop:unknown|intent_pruned"],
      canApplyAdditions: true,
    });
    expect(buildAssistantWorkflowToolSelectionReplayLinesTracePayload(result)).toMatchObject({
      migrationProposal: {
        addIntentIds: ["answer_docs"],
        addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
        proposedAuthorityIntentIds: ["value_lookup", "answer_docs"],
        proposedAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned", "answer_docs|hop:unknown|intent_pruned"],
        canApplyAdditions: true,
      },
      migrationReviewArtifact: {
        status: "ready_for_runtime_change",
        runtimeChange: {
          addIntentIds: ["answer_docs"],
          addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
        },
      },
    });
  });
});

function workflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-selection-replay-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      planningSteps: ["retrieve_docs"],
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
      requiredContext: ["document-scope"],
    }, {
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }, {
      name: "list_docs",
      provider: "http",
      path: "/docs",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
    }],
    presentations: [{
      id: "text",
      description: "Text response.",
    }],
  };
}
