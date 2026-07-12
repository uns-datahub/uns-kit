import type { AssistantWorkflowRun } from "./run.js";

export type AssistantWorkflowRunParitySummary = {
  workflowId: string;
  workflowVersion: number;
  intent: string | null;
  runStatus: AssistantWorkflowRun["status"];
  stepIds: string[];
  readyToolNames: string[];
  invocationToolNames: string[];
  blockingReasonCount: number;
  warningCount: number;
};

export type AssistantWorkflowRunParityDifference = {
  field: keyof AssistantWorkflowRunParitySummary;
  expected: string | number | string[] | null;
  actual: string | number | string[] | null;
};

export type AssistantWorkflowRunParityResult = {
  matches: boolean;
  differences: AssistantWorkflowRunParityDifference[];
};

export function buildAssistantWorkflowRunParitySummary(
  run: AssistantWorkflowRun,
): AssistantWorkflowRunParitySummary {
  return {
    workflowId: run.workflowId,
    workflowVersion: run.workflowVersion,
    intent: run.decision.intent,
    runStatus: run.status,
    stepIds: run.executionPlan.steps.map((step) => step.id),
    readyToolNames: [...run.executionPlan.readyToolNames],
    invocationToolNames: run.toolInvocationQueue.invocations.map((invocation) => invocation.toolName),
    blockingReasonCount: run.executionPlan.blockingReasons.length,
    warningCount: run.executionPlan.warnings.length,
  };
}

export function compareAssistantWorkflowRunParity(
  expected: AssistantWorkflowRunParitySummary,
  actual: AssistantWorkflowRunParitySummary,
): AssistantWorkflowRunParityResult {
  const differences: AssistantWorkflowRunParityDifference[] = [];
  compareValue("workflowId", expected.workflowId, actual.workflowId, differences);
  compareValue("workflowVersion", expected.workflowVersion, actual.workflowVersion, differences);
  compareValue("intent", expected.intent, actual.intent, differences);
  compareValue("runStatus", expected.runStatus, actual.runStatus, differences);
  compareArray("stepIds", expected.stepIds, actual.stepIds, differences);
  compareArray("readyToolNames", expected.readyToolNames, actual.readyToolNames, differences);
  compareArray("invocationToolNames", expected.invocationToolNames, actual.invocationToolNames, differences);
  compareValue("blockingReasonCount", expected.blockingReasonCount, actual.blockingReasonCount, differences);
  compareValue("warningCount", expected.warningCount, actual.warningCount, differences);
  return { matches: differences.length === 0, differences };
}

function compareValue(
  field: AssistantWorkflowRunParityDifference["field"],
  expected: string | number | null,
  actual: string | number | null,
  differences: AssistantWorkflowRunParityDifference[],
): void {
  if (expected !== actual) differences.push({ field, expected, actual });
}

function compareArray(
  field: AssistantWorkflowRunParityDifference["field"],
  expected: string[],
  actual: string[],
  differences: AssistantWorkflowRunParityDifference[],
): void {
  if (expected.length !== actual.length || expected.some((entry, index) => entry !== actual[index])) {
    differences.push({ field, expected: [...expected], actual: [...actual] });
  }
}
