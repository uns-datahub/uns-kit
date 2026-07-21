import { describe, expect, it, vi } from "vitest";
import {
  buildAssistantWorkflowRun,
  buildAssistantWorkflowToolExecutionEventTracePayload,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  validateAssistantWorkflowDefinition,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow execution policy", () => {
  it("rejects invalid retry and failure policy values", () => {
    const workflow = {
      ...baseWorkflow(),
      executionPolicy: {
        failureMode: "guess-and-continue",
        maxAttemptsPerTool: 5,
      },
    } as unknown as AssistantWorkflowDefinition;

    expect(() => defineAssistantWorkflow(workflow)).toThrow(
      "Assistant workflow execution policy failureMode is invalid.",
    );
    expect(validateAssistantWorkflowDefinition(workflow).diagnostics).toContainEqual(expect.objectContaining({
      code: "invalid_execution_policy",
      path: "executionPolicy",
    }));
  });

  it("retries eligible tools deterministically up to the declared attempt limit", async () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      executionPolicy: { failureMode: "fail-fast", maxAttemptsPerTool: 2 },
      executionBudget: {
        maxPlanningSteps: 2,
        maxToolCalls: 4,
        maxProviderCalls: 1,
        maxDurationMs: 1_000,
        maxEvidenceBytes: 1_000,
      },
    });
    const queue = readyQueue(workflow);
    const attempts: number[] = [];
    const events: Record<string, unknown>[] = [];

    const report = await executeAssistantWorkflowToolInvocationQueue(
      queue,
      (invocation, context) => {
        if (invocation.toolName === "query_docs") {
          attempts.push(context.attempt ?? 0);
          if (context.attempt === 1) throw new Error("temporary");
        }
        return "ok";
      },
      { onEvent: (event) => events.push(buildAssistantWorkflowToolExecutionEventTracePayload(event)) },
    );

    expect(attempts).toEqual([1, 2]);
    expect(report.summary).toMatchObject({ status: "complete", successCount: 2 });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: "failed",
        invocationId: "retrieve_docs:query_docs",
        attempt: 1,
        maxAttempts: 2,
        retryable: true,
      }),
      expect.objectContaining({
        phase: "succeeded",
        invocationId: "retrieve_docs:query_docs",
        attempt: 2,
        maxAttempts: 2,
      }),
    ]));
  });

  it("continues independent work but skips dependents after a terminal failure", async () => {
    const queue = readyQueue(defineAssistantWorkflow(baseWorkflow()));
    queue.executionPolicy = { failureMode: "continue-independent", maxAttemptsPerTool: 2 };
    queue.invocations[0]!.maxAttempts = 2;
    queue.invocations[1]!.dependsOnStepIds = ["retrieve_docs"];
    queue.invocations.push({
      ...queue.invocations[1]!,
      id: "independent:list_docs",
      stepId: "independent",
      dependsOnStepIds: [],
      maxAttempts: 1,
    });
    const executor = vi.fn((invocation: (typeof queue.invocations)[number]) => {
      if (invocation.toolName === "query_docs") throw new Error("unavailable");
      return "ok";
    });

    const report = await executeAssistantWorkflowToolInvocationQueue(queue, executor);

    expect(executor).toHaveBeenCalledTimes(3);
    expect(report.results.map((result) => [result.invocationId, result.status, result.errorMessage])).toEqual([
      ["retrieve_docs:query_docs", "error", "unavailable"],
      ["synthesize_answer:list_docs", "skipped", "dependency step failed: retrieve_docs"],
      ["independent:list_docs", "success", undefined],
    ]);
  });

  it("budgets the maximum number of retry attempts before queue construction", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      executionPolicy: { failureMode: "fail-fast", maxAttemptsPerTool: 2 },
      executionBudget: {
        maxPlanningSteps: 2,
        maxToolCalls: 3,
        maxProviderCalls: 1,
        maxDurationMs: 1_000,
        maxEvidenceBytes: 1_000,
      },
    });

    const run = buildAssistantWorkflowRun(workflow, readyInput());

    expect(run.status).toBe("blocked");
    expect(run.executionPlan.budgetAssessment).toMatchObject({
      status: "blocked",
      usage: { toolCallCount: 4 },
      violations: [{ code: "tool_calls_exceeded", actual: 4, limit: 3 }],
    });
    expect(run.toolInvocationQueue.invocations).toEqual([]);
  });
});

function readyQueue(workflow: AssistantWorkflowDefinition) {
  return buildAssistantWorkflowRun(workflow, readyInput()).toolInvocationQueue;
}

function readyInput() {
  return {
    classification: {
      intent: "answer_docs",
      confidence: 0.9,
      entities: { containers: ["manual"] },
    },
    availableToolNames: ["query_docs", "list_docs"],
    availableContext: ["auth", "document-scope"] as const,
  };
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "policy-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
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
      dependsOn: ["retrieve_docs"],
      requiredToolHints: ["list_docs"],
    }],
  };
}
