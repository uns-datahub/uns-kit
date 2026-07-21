import { describe, expect, it, vi } from "vitest";
import {
  buildAssistantWorkflowExecutionBudgetAssessment,
  buildAssistantWorkflowExecutionBudgetTracePayload,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunTracePayload,
  buildAssistantWorkflowToolExecutionTracePayload,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  validateAssistantWorkflowDefinition,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowExecutionBudget,
} from "../src/index.js";

describe("assistant workflow execution budgets", () => {
  it("assesses all generic and host-owned usage dimensions", () => {
    const assessment = buildAssistantWorkflowExecutionBudgetAssessment(budget(), {
      planningStepCount: 3,
      toolCallCount: 4,
      providerCallCount: 3,
      elapsedMs: 101,
      evidenceBytes: 501,
    });

    expect(assessment).toMatchObject({
      status: "blocked",
      violations: [
        { code: "planning_steps_exceeded", actual: 3, limit: 2 },
        { code: "tool_calls_exceeded", actual: 4, limit: 2 },
        { code: "provider_calls_exceeded", actual: 3, limit: 2 },
        { code: "duration_exceeded", actual: 101, limit: 100 },
        { code: "evidence_bytes_exceeded", actual: 501, limit: 500 },
      ],
    });
    expect(buildAssistantWorkflowExecutionBudgetTracePayload(assessment)).toEqual(assessment);
  });

  it("rejects invalid definition budgets through assertions and diagnostics", () => {
    const workflow = {
      ...baseWorkflow(),
      executionBudget: { ...budget(), maxToolCalls: 17 },
    };

    expect(() => defineAssistantWorkflow(workflow)).toThrow(
      "Assistant workflow execution budget maxToolCalls must be an integer between 0 and 16.",
    );
    expect(validateAssistantWorkflowDefinition(workflow).diagnostics).toContainEqual(expect.objectContaining({
      severity: "error",
      code: "invalid_execution_budget",
      path: "executionBudget",
    }));
  });

  it("keeps a bounded multi-step plan executable when it is within budget", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      executionBudget: budget(),
    });
    const run = buildReadyRun(workflow);

    expect(run).toMatchObject({
      status: "ready",
      executionPlan: {
        budgetAssessment: {
          status: "within-budget",
          usage: { planningStepCount: 2, toolCallCount: 2 },
        },
      },
      toolInvocationQueue: {
        status: "ready",
        budgetAssessment: {
          status: "within-budget",
          usage: { planningStepCount: 2, toolCallCount: 2 },
        },
      },
    });
    expect(run.toolInvocationQueue.invocations).toHaveLength(2);
  });

  it.each([
    ["planning steps", { maxPlanningSteps: 1 }, "planning_steps_exceeded"],
    ["tool calls", { maxToolCalls: 1 }, "tool_calls_exceeded"],
  ] as const)("blocks a compiled plan that exceeds %s", (_label, override, violationCode) => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      executionBudget: budget(override),
    });
    const run = buildReadyRun(workflow);

    expect(run.status).toBe("blocked");
    expect(run.executionPlan.budgetAssessment?.violations).toContainEqual(expect.objectContaining({
      code: violationCode,
    }));
    expect(run.toolInvocationQueue).toMatchObject({
      status: "blocked",
      invocations: [],
    });
    expect(JSON.stringify(buildAssistantWorkflowRunTracePayload(run))).not.toContain("manual");
  });

  it("defensively rejects a crafted queue before calling a tool", async () => {
    const queue = buildReadyRun(defineAssistantWorkflow(baseWorkflow())).toolInvocationQueue;
    const executor = vi.fn(() => "must not run");

    const report = await executeAssistantWorkflowToolInvocationQueue(queue, executor, {
      executionBudget: budget({ maxToolCalls: 1 }),
    });

    expect(executor).not.toHaveBeenCalled();
    expect(report.summary).toMatchObject({
      status: "failed",
      errorCount: 1,
      skippedCount: 1,
    });
    expect(report.budgetAssessment).toMatchObject({
      status: "blocked",
      violations: [{ code: "tool_calls_exceeded", actual: 2, limit: 1 }],
    });
  });

  it("stops before the next call when the duration budget is exhausted", async () => {
    const queue = buildReadyRun(defineAssistantWorkflow(baseWorkflow())).toolInvocationQueue;
    const executor = vi.fn(() => ({ secretOutput: true }));
    const ticks = [0, 0, 6, 6];

    const report = await executeAssistantWorkflowToolInvocationQueue(queue, executor, {
      executionBudget: budget({ maxDurationMs: 5 }),
      argsByInvocationId: {
        "retrieve_docs:query_docs": { secretArgument: true },
      },
      now: () => ticks.shift() ?? 6,
    });

    expect(executor).toHaveBeenCalledTimes(1);
    expect(report.results.map((result) => result.status)).toEqual(["success", "error"]);
    expect(report.budgetAssessment).toMatchObject({
      status: "blocked",
      violations: [{ code: "duration_exceeded", actual: 6, limit: 5 }],
    });
    const trace = JSON.stringify(buildAssistantWorkflowToolExecutionTracePayload(report));
    expect(trace).not.toContain("secretArgument");
    expect(trace).not.toContain("secretOutput");
  });
});

function budget(
  overrides: Partial<AssistantWorkflowExecutionBudget> = {},
): AssistantWorkflowExecutionBudget {
  return {
    maxPlanningSteps: 2,
    maxToolCalls: 2,
    maxProviderCalls: 2,
    maxDurationMs: 100,
    maxEvidenceBytes: 500,
    ...overrides,
  };
}

function buildReadyRun(workflow: AssistantWorkflowDefinition) {
  return buildAssistantWorkflowRun(workflow, {
    classification: {
      intent: "answer_docs",
      confidence: 0.9,
      entities: { containers: ["manual"] },
    },
    availableToolNames: ["query_docs", "list_docs"],
    availableContext: ["auth", "document-scope"],
  });
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "budgeted-agent",
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
