import { describe, expect, it } from "vitest";
import {
  assistantWorkflowToolError,
  assistantWorkflowToolSkipped,
  assistantWorkflowToolSuccess,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowToolResultsTracePayload,
  defineAssistantWorkflow,
  summarizeAssistantWorkflowToolResults,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool results", () => {
  it("summarizes complete successful tool results", () => {
    const queue = readyQueue();
    const results = queue.invocations.map((invocation) =>
      assistantWorkflowToolSuccess({
        invocationId: invocation.id,
        toolName: invocation.toolName,
        stepId: invocation.stepId,
        provider: invocation.provider,
        output: { ok: true },
        durationMs: 12.9,
      }),
    );

    expect(summarizeAssistantWorkflowToolResults(queue, results)).toEqual({
      status: "complete",
      totalInvocations: 2,
      resultCount: 2,
      successCount: 2,
      errorCount: 0,
      skippedCount: 0,
      retryableErrorCount: 0,
      providerSummaries: [{
        provider: "http",
        resultCount: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
      }, {
        provider: "mcp",
        resultCount: 1,
        successCount: 1,
        errorCount: 0,
        skippedCount: 0,
      }],
      missingResultInvocationIds: [],
      unexpectedResultInvocationIds: [],
    });
    expect(results[0]?.durationMs).toBe(12);
  });

  it("marks failed and retryable tool results", () => {
    const queue = readyQueue();
    const firstInvocation = queue.invocations[0];
    if (!firstInvocation) throw new Error("expected invocation");

    const result = assistantWorkflowToolError({
      invocationId: firstInvocation.id,
      toolName: firstInvocation.toolName,
      stepId: firstInvocation.stepId,
      provider: firstInvocation.provider,
      errorMessage: "timeout",
      retryable: true,
    });

    expect(summarizeAssistantWorkflowToolResults(queue, [result])).toMatchObject({
      status: "failed",
      totalInvocations: 2,
      resultCount: 1,
      errorCount: 1,
      retryableErrorCount: 1,
      missingResultInvocationIds: ["synthesize_answer:list_docs"],
    });
    expect(buildAssistantWorkflowToolResultsTracePayload(queue, [result])).toMatchObject({
      status: "failed",
      results: [{
        invocationId: "retrieve_docs:query_docs",
        provider: "mcp",
        status: "error",
        hasOutput: false,
        errorMessage: "timeout",
        retryable: true,
      }],
    });
  });

  it("tracks skipped and unexpected results", () => {
    const queue = readyQueue();
    const firstInvocation = queue.invocations[0];
    if (!firstInvocation) throw new Error("expected invocation");

    const skipped = assistantWorkflowToolSkipped({
      invocationId: firstInvocation.id,
      toolName: firstInvocation.toolName,
      stepId: firstInvocation.stepId,
      provider: firstInvocation.provider,
      errorMessage: "guarded by policy",
    });
    const unexpected = assistantWorkflowToolSuccess({
      invocationId: "extra:tool",
      toolName: "extra_tool",
      stepId: "extra",
      provider: "local-function",
      output: "unexpected",
    });

    expect(summarizeAssistantWorkflowToolResults(queue, [skipped, unexpected])).toMatchObject({
      status: "partial",
      skippedCount: 1,
      missingResultInvocationIds: ["synthesize_answer:list_docs"],
      unexpectedResultInvocationIds: ["extra:tool"],
    });
  });

  it("rejects blank required result fields", () => {
    expect(() =>
      assistantWorkflowToolSuccess({
        invocationId: " ",
        toolName: "query_docs",
        stepId: "retrieve_docs",
        provider: "mcp",
      }),
    ).toThrow("Assistant workflow tool result invocationId is required.");
    expect(() =>
      assistantWorkflowToolError({
        invocationId: "retrieve_docs:query_docs",
        toolName: "query_docs",
        stepId: "retrieve_docs",
        provider: "mcp",
        errorMessage: " ",
      }),
    ).toThrow("Assistant workflow tool result errorMessage is required.");
    expect(() =>
      assistantWorkflowToolSuccess({
        invocationId: "retrieve_docs:query_docs",
        toolName: "query_docs",
        stepId: "retrieve_docs",
        provider: "invalid-provider" as "mcp",
      }),
    ).toThrow("Assistant workflow tool result provider is invalid.");
  });
});

function readyQueue() {
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
  return run.toolInvocationQueue;
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-result-agent",
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
