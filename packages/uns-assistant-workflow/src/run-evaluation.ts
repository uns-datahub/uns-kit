import type { AssistantWorkflowRunReport } from "./run-report.js";

export type AssistantWorkflowRunEvaluationSource = Omit<AssistantWorkflowRunReport, "evaluation">;

export type AssistantWorkflowRunEvaluationSeverity = "info" | "warning";

export type AssistantWorkflowRunEvaluationSignalName =
  | "run_not_handled"
  | "run_needs_clarification"
  | "run_degraded"
  | "run_failed"
  | "missing_required_tools"
  | "missing_tool_bindings"
  | "missing_context"
  | "clarification_policy_mismatch"
  | "tool_execution_failed"
  | "tool_execution_partial"
  | "outcome_unhandled";

export type AssistantWorkflowRunEvaluationSignal = {
  name: AssistantWorkflowRunEvaluationSignalName;
  severity: AssistantWorkflowRunEvaluationSeverity;
  detail: string | null;
};

export type AssistantWorkflowRunEvaluation = {
  workflowId: string;
  workflowVersion: number;
  status: AssistantWorkflowRunReport["status"];
  intent: string | null;
  outcomeKind: string;
  handled: boolean;
  toolResultStatus: string | null;
  readyToolCount: number;
  invokedToolCount: number;
  activePlanningStepProfileIds: string[];
  profileStepIds: string[];
  signalCount: number;
  warningCount: number;
  signals: AssistantWorkflowRunEvaluationSignal[];
};

export function evaluateAssistantWorkflowRunReport(
  report: AssistantWorkflowRunEvaluationSource,
): AssistantWorkflowRunEvaluation {
  const signals = collectAssistantWorkflowRunEvaluationSignals(report);
  return {
    workflowId: report.workflowId,
    workflowVersion: report.workflowVersion,
    status: report.status,
    intent: report.run.decision.intent,
    outcomeKind: report.outcome.kind,
    handled: report.outcomeSummary.handled,
    toolResultStatus: report.toolExecution?.summary.status ?? null,
    readyToolCount: report.run.executionPlan.readyToolNames.length,
    invokedToolCount: report.toolExecution?.summary.totalInvocations ?? report.run.toolInvocationQueue.invocations.length,
    activePlanningStepProfileIds: [...report.run.decision.plan.activePlanningStepProfileIds],
    profileStepIds: [...report.run.decision.plan.profileStepIds],
    signalCount: signals.length,
    warningCount: signals.filter((signal) => signal.severity === "warning").length,
    signals,
  };
}

export function collectAssistantWorkflowRunEvaluationSignals(
  report: AssistantWorkflowRunEvaluationSource,
): AssistantWorkflowRunEvaluationSignal[] {
  const signals: AssistantWorkflowRunEvaluationSignal[] = [];

  if (report.status === "not_handled") {
    signals.push({
      name: "run_not_handled",
      severity: "warning",
      detail: report.outcomeSummary.reason,
    });
  }
  if (report.status === "clarification") {
    signals.push({
      name: "run_needs_clarification",
      severity: "info",
      detail: report.outcomeSummary.reason,
    });
  }
  if (report.status === "degraded") {
    signals.push({
      name: "run_degraded",
      severity: "warning",
      detail: report.outcomeSummary.reason,
    });
  }
  if (report.status === "failed") {
    signals.push({
      name: "run_failed",
      severity: "warning",
      detail: report.toolExecution?.summary.status ?? null,
    });
  }

  if (report.run.executionPlan.missingCapabilityNames.length > 0) {
    signals.push({
      name: "missing_required_tools",
      severity: "warning",
      detail: report.run.executionPlan.missingCapabilityNames.join(", "),
    });
  }
  if (report.run.executionPlan.missingBindingNames.length > 0) {
    signals.push({
      name: "missing_tool_bindings",
      severity: "warning",
      detail: report.run.executionPlan.missingBindingNames.join(", "),
    });
  }
  if (report.run.executionPlan.missingContextRequirements.length > 0) {
    signals.push({
      name: "missing_context",
      severity: "warning",
      detail: report.run.executionPlan.missingContextRequirements.join(", "),
    });
  }

  if (report.toolExecution?.summary.status === "failed") {
    signals.push({
      name: "tool_execution_failed",
      severity: "warning",
      detail: summarizeToolExecutionFailure(report),
    });
  } else if (report.toolExecution?.summary.status === "partial") {
    signals.push({
      name: "tool_execution_partial",
      severity: "warning",
      detail: summarizeToolExecutionFailure(report),
    });
  }

  if (!report.outcomeSummary.handled) {
    signals.push({
      name: "outcome_unhandled",
      severity: "warning",
      detail: report.outcomeSummary.reason,
    });
  }

  return signals;
}

export function buildAssistantWorkflowRunEvaluationTracePayload(
  evaluation: AssistantWorkflowRunEvaluation,
): Record<string, unknown> {
  return {
    workflowId: evaluation.workflowId,
    workflowVersion: evaluation.workflowVersion,
    status: evaluation.status,
    intent: evaluation.intent,
    outcomeKind: evaluation.outcomeKind,
    handled: evaluation.handled,
    toolResultStatus: evaluation.toolResultStatus,
    readyToolCount: evaluation.readyToolCount,
    invokedToolCount: evaluation.invokedToolCount,
    activePlanningStepProfileIds: evaluation.activePlanningStepProfileIds,
    profileStepIds: evaluation.profileStepIds,
    signalCount: evaluation.signalCount,
    warningCount: evaluation.warningCount,
    signals: evaluation.signals,
  };
}

function summarizeToolExecutionFailure(report: AssistantWorkflowRunEvaluationSource): string | null {
  const summary = report.toolExecution?.summary;
  if (!summary) return null;
  const parts = [
    summary.errorCount > 0 ? `errors=${summary.errorCount}` : "",
    summary.skippedCount > 0 ? `skipped=${summary.skippedCount}` : "",
    summary.missingResultInvocationIds.length > 0
      ? `missing=${summary.missingResultInvocationIds.join(",")}`
      : "",
    summary.unexpectedResultInvocationIds.length > 0
      ? `unexpected=${summary.unexpectedResultInvocationIds.join(",")}`
      : "",
  ].filter((part) => part.length > 0);
  return parts.length ? parts.join("; ") : summary.status;
}
