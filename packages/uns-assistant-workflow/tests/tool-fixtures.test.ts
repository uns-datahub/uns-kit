import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowFixtureToolExecutor,
  buildAssistantWorkflowRun,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool fixtures", () => {
  it("executes fixture outputs by invocation id or tool name", async () => {
    const queue = readyQueue();
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      buildAssistantWorkflowFixtureToolExecutor({
        "retrieve_docs:query_docs": { status: "success", output: { rows: 2 } },
        list_docs: ["manual", "faq"],
      }),
    );

    expect(report.summary).toMatchObject({
      status: "complete",
      successCount: 2,
      errorCount: 0,
    });
    expect(report.results.map((result) => result.output)).toEqual([
      { rows: 2 },
      ["manual", "faq"],
    ]);
  });

  it("turns error fixtures into tool errors", async () => {
    const queue = readyQueue();
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      buildAssistantWorkflowFixtureToolExecutor({
        query_docs: { status: "error", errorMessage: "docs offline" },
        list_docs: { ok: true },
      }),
    );

    expect(report.summary).toMatchObject({
      status: "failed",
      errorCount: 1,
      skippedCount: 1,
    });
    expect(report.results[0]).toMatchObject({
      invocationId: "retrieve_docs:query_docs",
      status: "error",
      errorMessage: "docs offline",
    });
  });

  it("can produce deterministic default outputs for missing fixtures", async () => {
    const queue = readyQueue();
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      buildAssistantWorkflowFixtureToolExecutor({}, {
        missingFixture: "default-output",
      }),
    );

    expect(report.summary).toMatchObject({
      status: "complete",
      successCount: 2,
    });
    expect(report.results[0]?.output).toEqual({
      invocationId: "retrieve_docs:query_docs",
      toolName: "query_docs",
    });
  });
});

function readyQueue() {
  const workflow = defineAssistantWorkflow(baseWorkflow());
  return buildAssistantWorkflowRun(workflow, {
    classification: { intent: "answer_docs" },
    availableToolNames: ["query_docs", "list_docs"],
    availableContext: ["document-scope", "auth"],
  }).toolInvocationQueue;
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-fixture-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      planningSteps: ["retrieve_docs", "synthesize_answer"],
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
      requiredContext: ["auth"],
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
    }, {
      id: "synthesize_answer",
      description: "Synthesize answer.",
      kind: "synthesize",
      toolHints: ["list_docs"],
    }],
  };
}
