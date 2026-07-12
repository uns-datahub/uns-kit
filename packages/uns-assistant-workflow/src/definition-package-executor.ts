import {
  buildAssistantWorkflowDefinitionPackageRunTracePayload,
  buildAssistantWorkflowRunFromPackage,
  type AssistantWorkflowDefinitionPackageRunInput,
  type AssistantWorkflowDefinitionPackageRunResult,
} from "./definition-package-run.js";
import type { AssistantWorkflowOutcome } from "./outcome.js";
import { assistantWorkflowNotHandled } from "./outcome.js";
import {
  buildAssistantWorkflowRunReport,
  buildAssistantWorkflowRunReportTracePayload,
  type AssistantWorkflowRunReport,
} from "./run-report.js";
import {
  buildAssistantWorkflowToolExecutionTracePayload,
  createAssistantWorkflowToolProviderExecutor,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowToolExecutionOptions,
  type AssistantWorkflowToolExecutionReport,
  type AssistantWorkflowToolExecutor,
  type AssistantWorkflowToolProviderExecutorOptions,
  type AssistantWorkflowToolProviderExecutors,
} from "./tool-executor.js";

export type AssistantWorkflowDefinitionPackageOutcomeBuilderContext = {
  packageRun: Extract<AssistantWorkflowDefinitionPackageRunResult, { built: true }>;
  toolExecution: AssistantWorkflowToolExecutionReport;
};

export type AssistantWorkflowDefinitionPackageOutcomeBuilder = (
  context: AssistantWorkflowDefinitionPackageOutcomeBuilderContext,
) => AssistantWorkflowOutcome | Promise<AssistantWorkflowOutcome>;

type AssistantWorkflowDefinitionPackageExecutionBaseInput =
  AssistantWorkflowDefinitionPackageRunInput & {
    toolExecutionOptions?: AssistantWorkflowToolExecutionOptions;
    outcome?: AssistantWorkflowOutcome | null;
    outcomeBuilder?: AssistantWorkflowDefinitionPackageOutcomeBuilder | null;
  };

export type AssistantWorkflowDefinitionPackageExecutionInput =
  | (AssistantWorkflowDefinitionPackageExecutionBaseInput & {
    toolExecutor: AssistantWorkflowToolExecutor;
    toolProviderExecutors?: never;
    toolProviderExecutorOptions?: never;
  })
  | (AssistantWorkflowDefinitionPackageExecutionBaseInput & {
    toolExecutor?: never;
    toolProviderExecutors: AssistantWorkflowToolProviderExecutors;
    toolProviderExecutorOptions?: AssistantWorkflowToolProviderExecutorOptions;
  });

export type AssistantWorkflowDefinitionPackageExecutionStatus =
  | "report_built"
  | "run_failed"
  | "outcome_failed";

export type AssistantWorkflowDefinitionPackageExecutionResult =
  | {
    executed: true;
    status: "report_built";
    packageRun: AssistantWorkflowDefinitionPackageRunResult;
    toolExecution: AssistantWorkflowToolExecutionReport;
    report: AssistantWorkflowRunReport;
    reason: string | null;
  }
  | {
    executed: false;
    status: "run_failed";
    packageRun: AssistantWorkflowDefinitionPackageRunResult;
    toolExecution: null;
    report: null;
    reason: string;
  }
  | {
    executed: false;
    status: "outcome_failed";
    packageRun: AssistantWorkflowDefinitionPackageRunResult;
    toolExecution: AssistantWorkflowToolExecutionReport;
    report: null;
    reason: string;
  };

export async function executeAssistantWorkflowRunFromPackage(
  value: unknown,
  input: AssistantWorkflowDefinitionPackageExecutionInput,
): Promise<AssistantWorkflowDefinitionPackageExecutionResult> {
  const packageRun = buildAssistantWorkflowRunFromPackage(value, input);
  if (!packageRun.built) {
    return {
      executed: false,
      status: "run_failed",
      packageRun,
      toolExecution: null,
      report: null,
      reason: packageRun.reason,
    };
  }

  const toolExecutor = input.toolExecutor ?? createAssistantWorkflowToolProviderExecutor(
    input.toolProviderExecutors,
    input.toolProviderExecutorOptions ?? {},
  );

  const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
    packageRun.run.toolInvocationQueue,
    toolExecutor,
    input.toolExecutionOptions ?? {},
  );

  let outcome: AssistantWorkflowOutcome;
  try {
    outcome = input.outcome ?? (input.outcomeBuilder
      ? await input.outcomeBuilder({ packageRun, toolExecution })
      : assistantWorkflowNotHandled("package execution did not produce an outcome"));
  } catch (error) {
    return {
      executed: false,
      status: "outcome_failed",
      packageRun,
      toolExecution,
      report: null,
      reason: getErrorMessage(error),
    };
  }

  const report = buildAssistantWorkflowRunReport({
    run: packageRun.run,
    toolExecution,
    outcome,
  });

  return {
    executed: true,
    status: "report_built",
    packageRun,
    toolExecution,
    report,
    reason: null,
  };
}

export function buildAssistantWorkflowDefinitionPackageExecutionTracePayload(
  result: AssistantWorkflowDefinitionPackageExecutionResult,
): Record<string, unknown> {
  return {
    executed: result.executed,
    status: result.status,
    reason: result.reason,
    packageRun: buildAssistantWorkflowDefinitionPackageRunTracePayload(result.packageRun),
    toolExecution: result.toolExecution
      ? buildAssistantWorkflowToolExecutionTracePayload(result.toolExecution)
      : null,
    report: result.report ? buildAssistantWorkflowRunReportTracePayload(result.report) : null,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length) {
    return error.trim();
  }
  return "assistant workflow package outcome failed";
}
