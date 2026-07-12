import {
  buildAssistantWorkflowDecision,
  buildAssistantWorkflowDecisionTracePayload,
  type AssistantWorkflowDecision,
  type AssistantWorkflowDecisionInput,
} from "./decision.js";
import {
  type AssistantWorkflowDefinition,
  type AssistantWorkflowToolContextRequirement,
} from "./definition.js";
import {
  buildAssistantWorkflowExecutionPlan,
  buildAssistantWorkflowExecutionPlanTracePayload,
  type AssistantWorkflowExecutionPlan,
  type AssistantWorkflowExecutionPlanStatus,
} from "./execution-plan.js";
import {
  buildAssistantWorkflowToolInvocationQueue,
  buildAssistantWorkflowToolInvocationQueueTracePayload,
  type AssistantWorkflowToolInvocationQueue,
} from "./tool-invocations.js";

export type AssistantWorkflowRunInput = {
  classification?: AssistantWorkflowDecisionInput | null;
  availableToolNames?: readonly string[] | null;
  availableContext?: readonly AssistantWorkflowToolContextRequirement[] | null;
};

export type AssistantWorkflowRun = {
  workflowId: string;
  workflowVersion: number;
  status: AssistantWorkflowExecutionPlanStatus;
  decision: AssistantWorkflowDecision;
  executionPlan: AssistantWorkflowExecutionPlan;
  toolInvocationQueue: AssistantWorkflowToolInvocationQueue;
};

export function buildAssistantWorkflowRun(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  input: AssistantWorkflowRunInput = {},
): AssistantWorkflowRun {
  const decision = buildAssistantWorkflowDecision(
    workflow,
    input.classification,
    input.availableToolNames ?? [],
  );
  const executionPlan = buildAssistantWorkflowExecutionPlan(workflow, decision, {
    availableContext: input.availableContext ?? null,
  });
  const runWithoutQueue = {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    status: executionPlan.status,
    decision,
    executionPlan,
  };
  const toolInvocationQueue = buildAssistantWorkflowToolInvocationQueue(workflow, runWithoutQueue);

  return {
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    status: executionPlan.status,
    decision,
    executionPlan,
    toolInvocationQueue,
  };
}

export function buildAssistantWorkflowRunTracePayload(run: AssistantWorkflowRun): Record<string, unknown> {
  return {
    workflowId: run.workflowId,
    workflowVersion: run.workflowVersion,
    status: run.status,
    decision: buildAssistantWorkflowDecisionTracePayload(run.decision),
    executionPlan: buildAssistantWorkflowExecutionPlanTracePayload(run.executionPlan),
    toolInvocationQueue: buildAssistantWorkflowToolInvocationQueueTracePayload(run.toolInvocationQueue),
  };
}
