import {
  buildAssistantWorkflowDefinitionPackageRunTracePayload,
  buildAssistantWorkflowRunFromPackage,
  type AssistantWorkflowDefinitionPackageRunInput,
  type AssistantWorkflowDefinitionPackageRunResult,
} from "./definition-package-run.js";
import type { AssistantWorkflowOutcome } from "./outcome.js";
import {
  assistantWorkflowNotHandled,
} from "./outcome.js";
import {
  buildAssistantWorkflowRunReport,
  buildAssistantWorkflowRunReportTracePayload,
  type AssistantWorkflowRunReport,
} from "./run-report.js";
import type { AssistantWorkflowToolExecutionReport } from "./tool-executor.js";

export type AssistantWorkflowDefinitionPackageRunReportInput =
  AssistantWorkflowDefinitionPackageRunInput & {
    outcome?: AssistantWorkflowOutcome | null;
    toolExecution?: AssistantWorkflowToolExecutionReport | null;
  };

export type AssistantWorkflowDefinitionPackageRunReportStatus =
  | "report_built"
  | "run_failed";

export type AssistantWorkflowDefinitionPackageRunReportResult =
  | {
    built: true;
    status: "report_built";
    packageRun: AssistantWorkflowDefinitionPackageRunResult;
    report: AssistantWorkflowRunReport;
    reason: string | null;
  }
  | {
    built: false;
    status: "run_failed";
    packageRun: AssistantWorkflowDefinitionPackageRunResult;
    report: null;
    reason: string;
  };

export function buildAssistantWorkflowRunReportFromPackage(
  value: unknown,
  input: AssistantWorkflowDefinitionPackageRunReportInput = {},
): AssistantWorkflowDefinitionPackageRunReportResult {
  const packageRun = buildAssistantWorkflowRunFromPackage(value, input);
  if (!packageRun.built) {
    return {
      built: false,
      status: "run_failed",
      packageRun,
      report: null,
      reason: packageRun.reason,
    };
  }

  const report = buildAssistantWorkflowRunReport({
    run: packageRun.run,
    toolExecution: input.toolExecution ?? null,
    outcome: input.outcome ?? assistantWorkflowNotHandled("package run did not produce an outcome"),
  });

  return {
    built: true,
    status: "report_built",
    packageRun,
    report,
    reason: null,
  };
}

export function buildAssistantWorkflowDefinitionPackageRunReportTracePayload(
  result: AssistantWorkflowDefinitionPackageRunReportResult,
): Record<string, unknown> {
  return {
    built: result.built,
    status: result.status,
    reason: result.reason,
    packageRun: buildAssistantWorkflowDefinitionPackageRunTracePayload(result.packageRun),
    report: result.report ? buildAssistantWorkflowRunReportTracePayload(result.report) : null,
  };
}
