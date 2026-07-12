import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowRun,
  buildAssistantWorkflowToolInvocationQueue,
  buildAssistantWorkflowToolInvocationQueueTracePayload,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool invocation queue", () => {
  it("builds ordered invocation candidates for ready steps", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const run = buildAssistantWorkflowRun(workflow, {
      classification: {
        intent: "answer_docs",
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      availableToolNames: ["query_docs", "list_docs"],
      availableContext: ["auth", "document-scope"],
    });

    expect(run.toolInvocationQueue).toMatchObject({
      status: "ready",
      skippedStepIds: [],
      blockingReasons: [],
      warnings: [],
    });
    expect(run.toolInvocationQueue.invocations.map((invocation) => ({
      id: invocation.id,
      toolName: invocation.toolName,
      required: invocation.required,
      provider: invocation.provider,
    }))).toEqual([
      { id: "retrieve_docs:query_docs", toolName: "query_docs", required: true, provider: "mcp" },
      { id: "synthesize_answer:list_docs", toolName: "list_docs", required: false, provider: "http" },
    ]);
  });

  it("does not queue invocations for a blocked run by default", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const run = buildAssistantWorkflowRun(workflow, {
      classification: {
        intent: "answer_docs",
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      availableToolNames: ["query_docs", "list_docs"],
      availableContext: ["auth"],
    });

    expect(run.status).toBe("blocked");
    expect(run.toolInvocationQueue).toMatchObject({
      status: "blocked",
      invocations: [],
      skippedStepIds: ["retrieve_docs", "synthesize_answer"],
    });
    expect(run.toolInvocationQueue.blockingReasons).toContain(
      "workflow required tool query_docs missing context: document-scope",
    );
  });

  it("can queue ready required work from a partial run", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      toolBindings: [{
        name: "query_docs",
        provider: "mcp",
        serverId: "docs",
        toolName: "query",
      }],
    });
    const run = buildAssistantWorkflowRun(workflow, {
      classification: {
        intent: "answer_docs",
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      availableToolNames: ["query_docs", "list_docs"],
      availableContext: ["auth", "document-scope"],
    });

    expect(run.status).toBe("partial");
    expect(run.toolInvocationQueue.status).toBe("partial");
    expect(run.toolInvocationQueue.invocations.map((invocation) => invocation.toolName)).toEqual(["query_docs"]);
    expect(run.toolInvocationQueue.warnings).toContain("synthesize_answer optional tool list_docs is missing-binding");

    const requiredOnly = buildAssistantWorkflowToolInvocationQueue(workflow, run, { includeOptional: false });
    expect(requiredOnly.invocations.map((invocation) => invocation.toolName)).toEqual(["query_docs"]);
    expect(buildAssistantWorkflowToolInvocationQueueTracePayload(requiredOnly)).toMatchObject({
      status: "partial",
      invocationCount: 1,
      invocations: [{ id: "retrieve_docs:query_docs", required: true, bindingProvider: "mcp" }],
    });
  });
});

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-invocation-agent",
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
