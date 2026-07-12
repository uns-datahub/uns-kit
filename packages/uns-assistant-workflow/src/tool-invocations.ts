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

export type AssistantWorkflowToolInvocationQueueStatus =
  | "ready"
  | "partial"
  | "blocked"
  | "empty";

export type AssistantWorkflowToolInvocation = {
  id: string;
  stepId: string;
  stepKind: AssistantWorkflowPlanningStepKind;
  toolName: string;
  required: boolean;
  provider: AssistantWorkflowToolProvider;
  capability: AssistantWorkflowToolCapabilityDefinition;
  binding: AssistantWorkflowToolBindingDefinition;
};

export type AssistantWorkflowToolInvocationQueue = {
  status: AssistantWorkflowToolInvocationQueueStatus;
  invocations: AssistantWorkflowToolInvocation[];
  skippedStepIds: string[];
  blockingReasons: string[];
  warnings: string[];
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
    };
  }

  const invocations: AssistantWorkflowToolInvocation[] = [];
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
      const invocation = buildInvocation(step.id, step.kind, step.requiredToolNames.includes(resolution.toolName), resolution);
      if (invocation) {
        invocations.push(invocation);
      }
    }
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
      toolName: invocation.toolName,
      required: invocation.required,
      provider: invocation.provider,
      effect: invocation.capability.effect,
      outputKinds: invocation.capability.outputKinds,
      bindingProvider: invocation.binding.provider,
    })),
    skippedStepIds: queue.skippedStepIds,
    blockingReasons: queue.blockingReasons,
    warnings: queue.warnings,
  };
}

function buildInvocation(
  stepId: string,
  stepKind: AssistantWorkflowPlanningStepKind,
  required: boolean,
  resolution: AssistantWorkflowToolResolution,
): AssistantWorkflowToolInvocation | null {
  if (resolution.status !== "ready" || !resolution.capability || !resolution.binding || !resolution.provider) {
    return null;
  }
  return {
    id: `${stepId}:${resolution.toolName}`,
    stepId,
    stepKind,
    toolName: resolution.toolName,
    required,
    provider: resolution.provider,
    capability: resolution.capability,
    binding: resolution.binding,
  };
}
