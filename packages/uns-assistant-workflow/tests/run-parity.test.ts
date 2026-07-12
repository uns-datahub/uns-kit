import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowRun,
  compareAssistantWorkflowRunParity,
  defineAssistantWorkflow,
} from "../src/index.js";
import { buildAssistantWorkflowRunParitySummary } from "../src/run-parity.js";

const workflow = defineAssistantWorkflow({
  id: "parity-agent",
  version: 1,
  intents: [{
    id: "answer",
    description: "Answer with evidence.",
    planningSteps: ["retrieve", "synthesize"],
  }],
  planningSteps: [{
    id: "retrieve",
    description: "Retrieve evidence.",
    kind: "retrieve",
    toolHints: ["query"],
  }, {
    id: "synthesize",
    description: "Synthesize the answer.",
    kind: "synthesize",
  }],
  tools: [{
    name: "query",
    provider: "mcp",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "request-scoped",
    retryClass: "safe",
    outputKinds: ["evidence"],
  }],
  toolBindings: [{ name: "query", provider: "mcp", serverId: "docs", toolName: "query" }],
});

describe("assistant workflow run parity", () => {
  it("builds a stable trace-safe run summary", () => {
    const run = buildAssistantWorkflowRun(workflow, {
      classification: { intent: "answer", confidence: 1 },
      availableToolNames: ["query"],
    });
    expect(buildAssistantWorkflowRunParitySummary(run)).toEqual({
      workflowId: "parity-agent",
      workflowVersion: 1,
      intent: "answer",
      runStatus: "ready",
      stepIds: ["retrieve", "synthesize"],
      readyToolNames: ["query"],
      invocationToolNames: ["query"],
      blockingReasonCount: 0,
      warningCount: 0,
    });
  });

  it("reports field-level differences without run payloads", () => {
    const expected = buildAssistantWorkflowRunParitySummary(buildAssistantWorkflowRun(workflow, {
      classification: { intent: "answer", confidence: 1 },
      availableToolNames: ["query"],
    }));
    const actual = { ...expected, runStatus: "partial" as const, invocationToolNames: [] };
    expect(compareAssistantWorkflowRunParity(expected, actual)).toEqual({
      matches: false,
      differences: [{ field: "runStatus", expected: "ready", actual: "partial" }, {
        field: "invocationToolNames",
        expected: ["query"],
        actual: [],
      }],
    });
  });
});
