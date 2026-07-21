export const ASSISTANT_WORKFLOW_EXECUTION_BUDGET_LIMITS = Object.freeze({
  maxPlanningSteps: 32,
  maxToolCalls: 16,
  maxProviderCalls: 8,
  maxDurationMs: 300_000,
  maxEvidenceBytes: 1_000_000,
});

export type AssistantWorkflowExecutionBudget = {
  maxPlanningSteps: number;
  maxToolCalls: number;
  maxProviderCalls: number;
  maxDurationMs: number;
  maxEvidenceBytes: number;
};

export type AssistantWorkflowExecutionBudgetUsage = {
  planningStepCount: number;
  toolCallCount: number;
  providerCallCount: number;
  elapsedMs: number;
  evidenceBytes: number;
};

export type AssistantWorkflowExecutionBudgetViolationCode =
  | "planning_steps_exceeded"
  | "tool_calls_exceeded"
  | "provider_calls_exceeded"
  | "duration_exceeded"
  | "evidence_bytes_exceeded";

export type AssistantWorkflowExecutionBudgetViolation = {
  code: AssistantWorkflowExecutionBudgetViolationCode;
  actual: number;
  limit: number;
};

export type AssistantWorkflowExecutionBudgetAssessment = {
  status: "within-budget" | "blocked";
  budget: AssistantWorkflowExecutionBudget;
  usage: AssistantWorkflowExecutionBudgetUsage;
  violations: AssistantWorkflowExecutionBudgetViolation[];
};

export function assertAssistantWorkflowExecutionBudget(
  budget: AssistantWorkflowExecutionBudget,
): void {
  assertBudgetValue("maxPlanningSteps", budget.maxPlanningSteps, 1, ASSISTANT_WORKFLOW_EXECUTION_BUDGET_LIMITS.maxPlanningSteps);
  assertBudgetValue("maxToolCalls", budget.maxToolCalls, 0, ASSISTANT_WORKFLOW_EXECUTION_BUDGET_LIMITS.maxToolCalls);
  assertBudgetValue("maxProviderCalls", budget.maxProviderCalls, 0, ASSISTANT_WORKFLOW_EXECUTION_BUDGET_LIMITS.maxProviderCalls);
  assertBudgetValue("maxDurationMs", budget.maxDurationMs, 1, ASSISTANT_WORKFLOW_EXECUTION_BUDGET_LIMITS.maxDurationMs);
  assertBudgetValue("maxEvidenceBytes", budget.maxEvidenceBytes, 0, ASSISTANT_WORKFLOW_EXECUTION_BUDGET_LIMITS.maxEvidenceBytes);
}

export function buildAssistantWorkflowExecutionBudgetAssessment(
  budget: AssistantWorkflowExecutionBudget,
  usage: Partial<AssistantWorkflowExecutionBudgetUsage> = {},
): AssistantWorkflowExecutionBudgetAssessment {
  assertAssistantWorkflowExecutionBudget(budget);
  const normalizedUsage: AssistantWorkflowExecutionBudgetUsage = {
    planningStepCount: normalizeUsageValue(usage.planningStepCount),
    toolCallCount: normalizeUsageValue(usage.toolCallCount),
    providerCallCount: normalizeUsageValue(usage.providerCallCount),
    elapsedMs: normalizeUsageValue(usage.elapsedMs),
    evidenceBytes: normalizeUsageValue(usage.evidenceBytes),
  };
  const violations = [
    buildViolation("planning_steps_exceeded", normalizedUsage.planningStepCount, budget.maxPlanningSteps),
    buildViolation("tool_calls_exceeded", normalizedUsage.toolCallCount, budget.maxToolCalls),
    buildViolation("provider_calls_exceeded", normalizedUsage.providerCallCount, budget.maxProviderCalls),
    buildViolation("duration_exceeded", normalizedUsage.elapsedMs, budget.maxDurationMs),
    buildViolation("evidence_bytes_exceeded", normalizedUsage.evidenceBytes, budget.maxEvidenceBytes),
  ].filter((violation): violation is AssistantWorkflowExecutionBudgetViolation => violation !== null);

  return {
    status: violations.length > 0 ? "blocked" : "within-budget",
    budget: { ...budget },
    usage: normalizedUsage,
    violations,
  };
}

export function buildAssistantWorkflowExecutionBudgetTracePayload(
  assessment: AssistantWorkflowExecutionBudgetAssessment,
): Record<string, unknown> {
  return {
    status: assessment.status,
    budget: assessment.budget,
    usage: assessment.usage,
    violations: assessment.violations.map((violation) => ({ ...violation })),
  };
}

export function formatAssistantWorkflowExecutionBudgetViolation(
  violation: AssistantWorkflowExecutionBudgetViolation,
): string {
  return `execution budget exceeded: ${violation.code} (${violation.actual} > ${violation.limit})`;
}

function assertBudgetValue(
  field: keyof AssistantWorkflowExecutionBudget,
  value: number,
  minimum: number,
  maximum: number,
): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Assistant workflow execution budget ${field} must be an integer between ${minimum} and ${maximum}.`,
    );
  }
}

function normalizeUsageValue(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Assistant workflow execution budget usage values must be finite non-negative numbers.");
  }
  return Math.floor(value);
}

function buildViolation(
  code: AssistantWorkflowExecutionBudgetViolationCode,
  actual: number,
  limit: number,
): AssistantWorkflowExecutionBudgetViolation | null {
  return actual > limit ? { code, actual, limit } : null;
}
