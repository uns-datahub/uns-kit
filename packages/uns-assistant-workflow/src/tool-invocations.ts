import type {
  AssistantWorkflowDefinition,
  AssistantWorkflowPlanningStepKind,
  AssistantWorkflowToolBindingDefinition,
  AssistantWorkflowToolCapabilityDefinition,
  AssistantWorkflowToolProvider,
} from "./definition.js";
import type { AssistantWorkflowExecutionPlan, AssistantWorkflowExecutionPlanStatus } from "./execution-plan.js";
import {
  resolveAssistantWorkflowTools,
  type AssistantWorkflowToolResolution,
} from "./tool-bindings.js";
import {
  buildAssistantWorkflowExecutionBudgetAssessment,
  buildAssistantWorkflowExecutionBudgetTracePayload,
  formatAssistantWorkflowExecutionBudgetViolation,
  type AssistantWorkflowExecutionBudget,
  type AssistantWorkflowExecutionBudgetAssessment,
} from "./execution-budget.js";
import {
  resolveAssistantWorkflowExecutionPolicy,
  type AssistantWorkflowExecutionPolicy,
} from "./execution-policy.js";

export type AssistantWorkflowToolInvocationQueueStatus =
  | "ready"
  | "partial"
  | "blocked"
  | "empty";

export type AssistantWorkflowToolInvocation = {
  id: string;
  stepId: string;
  stepKind: AssistantWorkflowPlanningStepKind;
  dependsOnStepIds?: string[];
  toolName: string;
  required: boolean;
  provider: AssistantWorkflowToolProvider;
  capability: AssistantWorkflowToolCapabilityDefinition;
  binding: AssistantWorkflowToolBindingDefinition;
  maxAttempts?: number;
};

export type AssistantWorkflowToolInvocationQueue = {
  status: AssistantWorkflowToolInvocationQueueStatus;
  invocations: AssistantWorkflowToolInvocation[];
  skippedStepIds: string[];
  blockingReasons: string[];
  warnings: string[];
  executionBudget?: AssistantWorkflowExecutionBudget | null;
  budgetAssessment?: AssistantWorkflowExecutionBudgetAssessment | null;
  executionPolicy?: AssistantWorkflowExecutionPolicy;
};

export type AssistantWorkflowToolInvocationQueueOptions = {
  includeOptional?: boolean;
  allowWhenBlocked?: boolean;
};

export type AssistantWorkflowToolInvocationRun = {
  status: AssistantWorkflowExecutionPlanStatus;
  executionPlan: AssistantWorkflowExecutionPlan;
};

export function buildAssistantWorkflowToolInvocationQueue(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  run: AssistantWorkflowToolInvocationRun,
  options: AssistantWorkflowToolInvocationQueueOptions = {},
): AssistantWorkflowToolInvocationQueue {
  const includeOptional = options.includeOptional !== false;
  const blocked = run.status === "blocked" || run.status === "needs-clarification";
  if (blocked && options.allowWhenBlocked !== true) {
    return {
      status: "blocked",
      invocations: [],
      skippedStepIds: run.executionPlan.steps.map((step) => step.id),
      blockingReasons: [...run.executionPlan.blockingReasons],
      warnings: [...run.executionPlan.warnings],
      executionBudget: run.executionPlan.executionBudget ?? null,
      budgetAssessment: run.executionPlan.budgetAssessment ?? null,
      executionPolicy: run.executionPlan.executionPolicy ?? resolveAssistantWorkflowExecutionPolicy(),
    };
  }

  const invocations: AssistantWorkflowToolInvocation[] = [];
  const executionPolicy = run.executionPlan.executionPolicy ?? resolveAssistantWorkflowExecutionPolicy(workflow.executionPolicy);
  const skippedStepIds: string[] = [];
  for (const step of run.executionPlan.steps) {
    if (step.status === "blocked" || step.status === "optional-skipped") {
      skippedStepIds.push(step.id);
      continue;
    }
    const readyToolNames = includeOptional
      ? step.readyToolNames
      : step.readyToolNames.filter((toolName) => step.requiredToolNames.includes(toolName));
    const resolutions = resolveAssistantWorkflowTools(workflow, readyToolNames).resolutions;
    for (const resolution of resolutions) {
      const invocation = buildInvocation(step.id, step.kind, step.dependsOnStepIds, step.requiredToolNames.includes(resolution.toolName), resolution, executionPolicy);
      if (invocation) {
        invocations.push(invocation);
      }
    }
  }

  const budgetAssessment = workflow.executionBudget
    ? buildAssistantWorkflowExecutionBudgetAssessment(workflow.executionBudget, {
        planningStepCount: run.executionPlan.steps.length,
        toolCallCount: invocations.reduce((count, invocation) => count + (invocation.maxAttempts ?? 1), 0),
      })
    : null;
  if (budgetAssessment?.status === "blocked") {
    return {
      status: "blocked",
      invocations: [],
      skippedStepIds: run.executionPlan.steps.map((step) => step.id),
      blockingReasons: [
        ...run.executionPlan.blockingReasons,
        ...budgetAssessment.violations.map(formatAssistantWorkflowExecutionBudgetViolation),
      ],
      warnings: [...run.executionPlan.warnings],
      executionBudget: { ...budgetAssessment.budget },
      budgetAssessment,
      executionPolicy,
    };
  }

  return {
    status:
      invocations.length === 0
        ? "empty"
        : run.status === "partial"
        ? "partial"
        : "ready",
    invocations,
    skippedStepIds,
    blockingReasons: [...run.executionPlan.blockingReasons],
    warnings: [...run.executionPlan.warnings],
    executionBudget: workflow.executionBudget ? { ...workflow.executionBudget } : null,
    budgetAssessment,
    executionPolicy,
  };
}

export function buildAssistantWorkflowToolInvocationQueueTracePayload(
  queue: AssistantWorkflowToolInvocationQueue,
): Record<string, unknown> {
  return {
    status: queue.status,
    invocationCount: queue.invocations.length,
    invocations: queue.invocations.map((invocation) => ({
      id: invocation.id,
      stepId: invocation.stepId,
      stepKind: invocation.stepKind,
      dependsOnStepIds: invocation.dependsOnStepIds ?? [],
      toolName: invocation.toolName,
      required: invocation.required,
      provider: invocation.provider,
      effect: invocation.capability.effect,
      outputKinds: invocation.capability.outputKinds,
      bindingProvider: invocation.binding.provider,
      maxAttempts: invocation.maxAttempts ?? 1,
    })),
    skippedStepIds: queue.skippedStepIds,
    blockingReasons: queue.blockingReasons,
    warnings: queue.warnings,
    executionBudget: queue.executionBudget ?? null,
    budgetAssessment: queue.budgetAssessment
      ? buildAssistantWorkflowExecutionBudgetTracePayload(queue.budgetAssessment)
      : null,
    executionPolicy: queue.executionPolicy ?? resolveAssistantWorkflowExecutionPolicy(),
  };
}

function buildInvocation(
  stepId: string,
  stepKind: AssistantWorkflowPlanningStepKind,
  dependsOnStepIds: readonly string[],
  required: boolean,
  resolution: AssistantWorkflowToolResolution,
  executionPolicy: AssistantWorkflowExecutionPolicy,
): AssistantWorkflowToolInvocation | null {
  if (resolution.status !== "ready" || !resolution.capability || !resolution.binding || !resolution.provider) {
    return null;
  }
  return {
    id: `${stepId}:${resolution.toolName}`,
    stepId,
    stepKind,
    dependsOnStepIds: [...dependsOnStepIds],
    toolName: resolution.toolName,
    required,
    provider: resolution.provider,
    capability: resolution.capability,
    binding: resolution.binding,
    maxAttempts: resolution.capability.retryClass === "never"
      ? 1
      : executionPolicy.maxAttemptsPerTool,
  };
}
