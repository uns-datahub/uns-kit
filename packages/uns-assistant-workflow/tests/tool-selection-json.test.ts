import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowToolSelectionDecision,
  defineAssistantWorkflow,
  parseAssistantWorkflowSerializedToolSelectionDecisionBatch,
  parseAssistantWorkflowSerializedToolSelectionDecision,
  parseAssistantWorkflowSerializedToolSelectionDecisionLines,
  serializeAssistantWorkflowToolSelectionDecision,
  serializeAssistantWorkflowToolSelectionDecisions,
  stringifyAssistantWorkflowToolSelectionDecision,
  stringifyAssistantWorkflowToolSelectionDecisions,
  stringifyAssistantWorkflowToolSelectionDecisionLines,
  stringifyAssistantWorkflowSerializedToolSelectionDecisionLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool selection JSON", () => {
  it("serializes and parses a tool-selection decision", () => {
    const decision = buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.9,
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedMode: "pruned",
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    });

    const serialized = serializeAssistantWorkflowToolSelectionDecision(decision);
    const json = stringifyAssistantWorkflowToolSelectionDecision(decision, 2);

    expect(serialized).toMatchObject({
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
        selectedReason: "workflow_equivalent",
        workflowSelectionCandidateTools: ["query_docs"],
      },
    });
    expect(parseAssistantWorkflowSerializedToolSelectionDecision(JSON.parse(json))).toEqual(serialized);
  });

  it("rejects values that are not serialized tool-selection decisions", () => {
    expect(parseAssistantWorkflowSerializedToolSelectionDecision(null)).toBeNull();
    expect(parseAssistantWorkflowSerializedToolSelectionDecision({ schemaVersion: 2 })).toBeNull();
    expect(parseAssistantWorkflowSerializedToolSelectionDecision({
      schemaVersion: 1,
      authority: {
        source: "workflow",
        reason: "workflow_equivalent",
        selectedToolNames: ["query_docs"],
        workflowSuggestedToolNames: [],
        workflowStatus: null,
      },
      effectiveToolNames: ["query_docs"],
      effectiveReason: "workflow_equivalent",
      comparisonPayload: { invalid: Number.NaN },
    })).toBeNull();
  });

  it("writes and parses serialized tool-selection decision lines", () => {
    const workflowDefinition = defineAssistantWorkflow(workflow());
    const workflowDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
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
    const unavailableDecision = buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: null,
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
    });

    const lines = stringifyAssistantWorkflowToolSelectionDecisionLines(
      [workflowDecision, unavailableDecision],
      { trailingNewline: true },
    );
    const serializedLines = stringifyAssistantWorkflowSerializedToolSelectionDecisionLines(
      [workflowDecision, unavailableDecision].map(serializeAssistantWorkflowToolSelectionDecision),
      { trailingNewline: true },
    );
    const parsed = parseAssistantWorkflowSerializedToolSelectionDecisionLines([
      lines.trimEnd(),
      "{invalid",
      JSON.stringify({ schemaVersion: 1 }),
      "",
    ].join("\n"));

    expect(lines.endsWith("\n")).toBe(true);
    expect(serializedLines).toBe(lines);
    expect(parsed).toMatchObject({
      lineCount: 4,
      decisionCount: 2,
      errorCount: 2,
      decisions: [{
        authority: { source: "workflow" },
      }, {
        authority: { reason: "workflow_unavailable" },
        comparisonPayload: null,
      }],
      errors: [{
        lineNumber: 3,
        reason: "invalid_json",
      }, {
        lineNumber: 4,
        reason: "invalid_tool_selection",
      }],
    });
  });

  it("serializes decision batches with aggregate summary and onlyInteresting filtering", () => {
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
      availableToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedReason: "intent_pruned",
      hop: 1,
      availableContext: ["document-scope"],
    });

    const batch = serializeAssistantWorkflowToolSelectionDecisions([workflowDecision, legacyDecision], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyInteresting: true,
    });
    const json = stringifyAssistantWorkflowToolSelectionDecisions([workflowDecision, legacyDecision], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyInteresting: true,
    }, 2);

    expect(batch).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceDecisionCount: 2,
      decisionCount: 1,
      summary: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceDecisionCount: 2,
        decisionCount: 1,
        interestingDecisionCount: 1,
        workflowAuthorityCount: 0,
        legacyAuthorityCount: 1,
        authoritySourceCounts: [{
          key: "legacy-pruner",
          count: 1,
        }],
        authorityReasonCounts: [{
          key: "workflow_differs",
          count: 1,
        }],
        workflowStatusCounts: [{
          key: "ready",
          count: 1,
        }],
        effectiveReasonCounts: [{
          key: "intent_pruned",
          count: 1,
        }],
        optionalToolModeCounts: [{
          key: "classifier-confirmed",
          count: 1,
        }],
        workflowSelectionProfileCounts: [{
          key: "follow_up_retrieval",
          count: 1,
        }],
        workflowSelectionProfileToolCounts: [{
          key: "list_docs",
          count: 1,
        }],
        effectiveToolCounts: [{
          key: "list_docs",
          count: 1,
        }, {
          key: "query_docs",
          count: 1,
        }, {
          key: "search_docs",
          count: 1,
        }],
        workflowSuggestedToolCounts: [{
          key: "list_docs",
          count: 1,
        }, {
          key: "query_docs",
          count: 1,
        }],
        workflowSelectionCandidateToolCounts: [{
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
    });
    expect(parseAssistantWorkflowSerializedToolSelectionDecisionBatch(JSON.parse(json))).toEqual(batch);
  });

  it("rejects values that are not serialized tool-selection decision batches", () => {
    expect(parseAssistantWorkflowSerializedToolSelectionDecisionBatch({ schemaVersion: 1 })).toBeNull();
    expect(parseAssistantWorkflowSerializedToolSelectionDecisionBatch({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceDecisionCount: 1,
      decisionCount: 2,
      summary: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceDecisionCount: 1,
        decisionCount: 2,
        interestingDecisionCount: 0,
        workflowAuthorityCount: 0,
        legacyAuthorityCount: 0,
        authoritySourceCounts: [],
        authorityReasonCounts: [],
        workflowStatusCounts: [],
        effectiveReasonCounts: [],
        optionalToolModeCounts: [],
        workflowSelectionProfileCounts: [],
        workflowSelectionProfileToolCounts: [],
        effectiveToolCounts: [],
        workflowSuggestedToolCounts: [],
        workflowSelectionCandidateToolCounts: [],
      },
      decisions: [],
    })).toBeNull();
    expect(parseAssistantWorkflowSerializedToolSelectionDecisionBatch({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceDecisionCount: 1,
      decisionCount: 0,
      summary: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceDecisionCount: 1,
        decisionCount: 0,
        interestingDecisionCount: 0,
        workflowAuthorityCount: 0,
        legacyAuthorityCount: 0,
        authoritySourceCounts: [{ key: "legacy-pruner", count: Number.NaN }],
        authorityReasonCounts: [],
        workflowStatusCounts: [],
        effectiveReasonCounts: [],
        optionalToolModeCounts: [],
        workflowSelectionProfileCounts: [],
        workflowSelectionProfileToolCounts: [],
        effectiveToolCounts: [],
        workflowSuggestedToolCounts: [],
        workflowSelectionCandidateToolCounts: [],
      },
      decisions: [],
    })).toBeNull();
  });
});

function workflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-selection-json-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs", "query_docs"],
      toolSelectionProfiles: [{
        id: "follow_up_retrieval",
        description: "Expose broader retrieval tools after first-hop pruning.",
        condition: {
          minHop: 1,
          selectedReason: "intent_pruned",
        },
        toolHints: ["list_docs"],
      }],
      planningSteps: ["retrieve_docs"],
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence", "text"],
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
    presentations: [{ id: "text", description: "Text answer." }],
  };
}
