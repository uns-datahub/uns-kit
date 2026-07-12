import {
  buildAssistantWorkflowOutcomeTracePayload,
  type AssistantWorkflowOutcome,
  type AssistantWorkflowOutcomeSummary,
  summarizeAssistantWorkflowOutcome,
} from "./outcome.js";
import {
  buildAssistantWorkflowRunTracePayload,
  type AssistantWorkflowRun,
} from "./run.js";
import {
  buildAssistantWorkflowRunEvaluationTracePayload,
  evaluateAssistantWorkflowRunReport,
  type AssistantWorkflowRunEvaluation,
} from "./run-evaluation.js";
import {
  buildAssistantWorkflowToolExecutionTracePayload,
  type AssistantWorkflowToolExecutionReport,
} from "./tool-executor.js";

export type AssistantWorkflowRunReportStatus =
  | "completed"
  | "clarification"
  | "degraded"
  | "failed"
  | "not_handled";

export type AssistantWorkflowRunReport = {
  workflowId: string;
  workflowVersion: number;
  status: AssistantWorkflowRunReportStatus;
  run: AssistantWorkflowRun;
  toolExecution: AssistantWorkflowToolExecutionReport | null;
  outcome: AssistantWorkflowOutcome;
  outcomeSummary: AssistantWorkflowOutcomeSummary;
  evaluation: AssistantWorkflowRunEvaluation;
};

export function buildAssistantWorkflowRunReport(input: {
  run: AssistantWorkflowRun;
  outcome: AssistantWorkflowOutcome;
  toolExecution?: AssistantWorkflowToolExecutionReport | null;
}): AssistantWorkflowRunReport {
  const outcomeSummary = summarizeAssistantWorkflowOutcome(input.outcome);
  const reportWithoutEvaluation = {
    workflowId: input.run.workflowId,
    workflowVersion: input.run.workflowVersion,
    status: resolveRunReportStatus(input.outcome, input.toolExecution ?? null),
    run: input.run,
    toolExecution: input.toolExecution ?? null,
    outcome: input.outcome,
    outcomeSummary,
  };
  const evaluation = evaluateAssistantWorkflowRunReport(reportWithoutEvaluation);
  return {
    ...reportWithoutEvaluation,
    evaluation,
  };
}

export function buildAssistantWorkflowRunReportTracePayload(
  report: AssistantWorkflowRunReport,
): Record<string, unknown> {
  return {
    workflowId: report.workflowId,
    workflowVersion: report.workflowVersion,
    status: report.status,
    run: buildAssistantWorkflowRunTracePayload(report.run),
    toolExecution: report.toolExecution
      ? buildAssistantWorkflowToolExecutionTracePayload(report.toolExecution)
      : null,
    outcome: buildAssistantWorkflowOutcomeTracePayload(report.outcome),
    evaluation: buildAssistantWorkflowRunEvaluationTracePayload(report.evaluation),
  };
}

function resolveRunReportStatus(
  outcome: AssistantWorkflowOutcome,
  toolExecution: AssistantWorkflowToolExecutionReport | null,
): AssistantWorkflowRunReportStatus {
  if (outcome.kind === "not_handled") return "not_handled";
  if (outcome.kind === "clarification") return "clarification";
  if (outcome.kind === "degraded") return "degraded";
  if (toolExecution?.summary.status === "failed") return "failed";
  return "completed";
}
