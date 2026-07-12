import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowRun,
  buildAssistantWorkflowToolExecutionEventTracePayload,
  buildAssistantWorkflowToolExecutionTracePayload,
  createAssistantWorkflowToolProviderExecutor,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool executor", () => {
  it("routes queue invocations through provider-specific executors", async () => {
    const queue = readyQueue();
    const executor = createAssistantWorkflowToolProviderExecutor({
      mcp: (invocation, context) =>
        `mcp:${invocation.binding.toolName}:${context.args["query"]}`,
      http: (invocation, context) =>
        `http:${invocation.binding.path}:${context.args["limit"]}`,
    });

    const report = await executeAssistantWorkflowToolInvocationQueue(queue, executor, {
      argsByInvocationId: {
        "retrieve_docs:query_docs": { query: "manual" },
        "synthesize_answer:list_docs": { limit: 5 },
      },
    });

    expect(report.results.map((result) => result.output)).toEqual([
      "mcp:query:manual",
      "http:/docs:5",
    ]);
    await expect(
      createAssistantWorkflowToolProviderExecutor({})(queue.invocations[0]!, {
        invocationIndex: 0,
        queueStatus: "ready",
        args: {},
      }),
    ).rejects.toThrow("No executor configured for assistant workflow tool provider: mcp.");

    await expect(executor({
      ...queue.invocations[0]!,
      binding: queue.invocations[1]!.binding,
    }, {
      invocationIndex: 0,
      queueStatus: "ready",
      args: {},
    })).rejects.toThrow("Assistant workflow invocation provider mcp does not match binding provider http.");
  });

  it("executes queued invocations and wraps outputs as successful results", async () => {
    const queue = readyQueue();
    let tick = 100;
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      (invocation, context) => ({
        toolName: invocation.toolName,
        invocationIndex: context.invocationIndex,
      }),
      { now: () => tick += 7 },
    );

    expect(report.summary).toMatchObject({
      status: "complete",
      totalInvocations: 2,
      successCount: 2,
      errorCount: 0,
    });
    expect(report.results.map((result) => ({
      invocationId: result.invocationId,
      status: result.status,
      durationMs: result.durationMs,
      output: result.output,
    }))).toEqual([
      {
        invocationId: "retrieve_docs:query_docs",
        status: "success",
        durationMs: 7,
        output: { toolName: "query_docs", invocationIndex: 0 },
      },
      {
        invocationId: "synthesize_answer:list_docs",
        status: "success",
        durationMs: 7,
        output: { toolName: "list_docs", invocationIndex: 1 },
      },
    ]);
  });

  it("passes each executor a shallow frozen argument snapshot", async () => {
    const queue = readyQueue();
    const sourceArgs = { query: "manual" };
    const observedArgs: Readonly<Record<string, unknown>>[] = [];

    await executeAssistantWorkflowToolInvocationQueue(
      queue,
      (_invocation, context) => {
        observedArgs.push(context.args);
        return null;
      },
      {
        continueOnError: true,
        argsByInvocationId: {
          "retrieve_docs:query_docs": sourceArgs,
        },
      },
    );

    expect(observedArgs).toEqual([{ query: "manual" }, {}]);
    expect(Object.isFrozen(observedArgs[0])).toBe(true);
    expect(Object.isFrozen(observedArgs[1])).toBe(true);
    expect(Object.isFrozen(sourceArgs)).toBe(false);
  });

  it("stops on error by default and skips remaining invocations", async () => {
    const queue = readyQueue();
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      (invocation) => {
        if (invocation.toolName === "query_docs") {
          throw new Error("docs unavailable");
        }
        return "should not run";
      },
      { retryableOnError: true },
    );

    expect(report.summary).toMatchObject({
      status: "failed",
      totalInvocations: 2,
      resultCount: 2,
      errorCount: 1,
      skippedCount: 1,
      retryableErrorCount: 1,
    });
    expect(report.results.map((result) => ({
      invocationId: result.invocationId,
      status: result.status,
      errorMessage: result.errorMessage,
      retryable: result.retryable,
    }))).toEqual([
      {
        invocationId: "retrieve_docs:query_docs",
        status: "error",
        errorMessage: "docs unavailable",
        retryable: true,
      },
      {
        invocationId: "synthesize_answer:list_docs",
        status: "skipped",
        errorMessage: "previous invocation failed: retrieve_docs:query_docs",
        retryable: undefined,
      },
    ]);
  });

  it("emits compact provider lifecycle events without arguments or outputs", async () => {
    const queue = readyQueue();
    const events: Record<string, unknown>[] = [];
    let tick = 100;

    await executeAssistantWorkflowToolInvocationQueue(
      queue,
      (invocation) => {
        if (invocation.toolName === "query_docs") {
          throw new Error("docs unavailable");
        }
        return { secretOutput: true };
      },
      {
        argsByInvocationId: {
          "retrieve_docs:query_docs": { secretArgument: "must-not-appear" },
        },
        now: () => tick += 10,
        retryableOnError: true,
        onEvent: (event) => events.push(buildAssistantWorkflowToolExecutionEventTracePayload(event)),
      },
    );

    expect(events).toEqual([
      {
        phase: "started",
        invocationId: "retrieve_docs:query_docs",
        toolName: "query_docs",
        stepId: "retrieve_docs",
        provider: "mcp",
        invocationIndex: 0,
        queueStatus: "ready",
        durationMs: null,
        errorMessage: null,
        retryable: null,
      },
      {
        phase: "failed",
        invocationId: "retrieve_docs:query_docs",
        toolName: "query_docs",
        stepId: "retrieve_docs",
        provider: "mcp",
        invocationIndex: 0,
        queueStatus: "ready",
        durationMs: 10,
        errorMessage: "docs unavailable",
        retryable: true,
      },
      {
        phase: "skipped",
        invocationId: "synthesize_answer:list_docs",
        toolName: "list_docs",
        stepId: "synthesize_answer",
        provider: "http",
        invocationIndex: 1,
        queueStatus: "ready",
        durationMs: null,
        errorMessage: "previous invocation failed: retrieve_docs:query_docs",
        retryable: null,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain("secretArgument");
    expect(JSON.stringify(events)).not.toContain("secretOutput");
  });

  it("does not allow lifecycle observer failures to interrupt execution", async () => {
    const queue = readyQueue();
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      () => "ok",
      { onEvent: () => { throw new Error("trace sink unavailable"); } },
    );

    expect(report.summary).toMatchObject({ status: "complete", successCount: 2 });
  });

  it("can continue after errors when requested", async () => {
    const queue = readyQueue();
    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      (invocation) => {
        if (invocation.toolName === "query_docs") {
          throw "temporary failure";
        }
        return "catalog";
      },
      { continueOnError: true },
    );

    expect(report.summary).toMatchObject({
      status: "failed",
      resultCount: 2,
      successCount: 1,
      errorCount: 1,
      skippedCount: 0,
    });
    expect(buildAssistantWorkflowToolExecutionTracePayload(report)).toMatchObject({
      status: "failed",
      results: [
        {
          invocationId: "retrieve_docs:query_docs",
          status: "error",
          errorMessage: "temporary failure",
        },
        {
          invocationId: "synthesize_answer:list_docs",
          status: "success",
          hasOutput: true,
        },
      ],
    });
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
    id: "tool-executor-agent",
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
