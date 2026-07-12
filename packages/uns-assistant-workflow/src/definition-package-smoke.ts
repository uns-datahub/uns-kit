import {
  executeAssistantWorkflowRunFromPackage,
  type AssistantWorkflowDefinitionPackageExecutionResult,
  type AssistantWorkflowDefinitionPackageExecutionStatus,
} from "./definition-package-executor.js";
import {
  buildAssistantWorkflowRunFromPackage,
  type AssistantWorkflowDefinitionPackageRunInput,
  type AssistantWorkflowDefinitionPackageRunResult,
} from "./definition-package-run.js";
import type { AssistantWorkflowExecutionPlanStatus } from "./execution-plan.js";
import { assistantWorkflowNotHandled, type AssistantWorkflowOutcome } from "./outcome.js";
import type { AssistantWorkflowRunReportStatus } from "./run-report.js";
import {
  buildAssistantWorkflowFixtureToolExecutor,
  type AssistantWorkflowFixtureToolExecutorOptions,
  type AssistantWorkflowToolFixtureMap,
} from "./tool-fixtures.js";
import type { AssistantWorkflowToolExecutionOptions } from "./tool-executor.js";
import type { AssistantWorkflowToolResultSummaryStatus } from "./tool-results.js";

export type AssistantWorkflowDefinitionPackageSmokeRunCase = AssistantWorkflowDefinitionPackageRunInput & {
  id: string;
  required?: boolean;
  expectedRunStatus?: AssistantWorkflowExecutionPlanStatus;
  expectedActivePlanningStepProfileIds?: readonly string[];
  expectedProfileStepIds?: readonly string[];
};

export type AssistantWorkflowDefinitionPackageSmokeExecutionCase = AssistantWorkflowDefinitionPackageRunInput & {
  id: string;
  required?: boolean;
  fixtures?: AssistantWorkflowToolFixtureMap;
  fixtureOptions?: AssistantWorkflowFixtureToolExecutorOptions;
  toolExecutionOptions?: AssistantWorkflowToolExecutionOptions;
  outcome?: AssistantWorkflowOutcome;
  expectedExecutionStatus?: AssistantWorkflowDefinitionPackageExecutionStatus;
  expectedReportStatus?: AssistantWorkflowRunReportStatus;
  expectedToolResultStatus?: AssistantWorkflowToolResultSummaryStatus;
  expectedActivePlanningStepProfileIds?: readonly string[];
  expectedProfileStepIds?: readonly string[];
};

export type AssistantWorkflowDefinitionPackageSmokeSuiteInput = {
  runCases?: readonly AssistantWorkflowDefinitionPackageSmokeRunCase[];
  executionCases?: readonly AssistantWorkflowDefinitionPackageSmokeExecutionCase[];
};

export type AssistantWorkflowDefinitionPackageSmokeCheck = {
  id: string;
  expected: string | number | boolean | null;
  actual: string | number | boolean | null;
  passed: boolean;
};

export type AssistantWorkflowDefinitionPackageSmokeRunCaseResult = {
  id: string;
  kind: "run";
  required: boolean;
  passed: boolean;
  checks: AssistantWorkflowDefinitionPackageSmokeCheck[];
  packageRun: AssistantWorkflowDefinitionPackageRunResult;
};

export type AssistantWorkflowDefinitionPackageSmokeExecutionCaseResult = {
  id: string;
  kind: "execution";
  required: boolean;
  passed: boolean;
  checks: AssistantWorkflowDefinitionPackageSmokeCheck[];
  execution: AssistantWorkflowDefinitionPackageExecutionResult;
};

export type AssistantWorkflowDefinitionPackageSmokeCaseResult =
  | AssistantWorkflowDefinitionPackageSmokeRunCaseResult
  | AssistantWorkflowDefinitionPackageSmokeExecutionCaseResult;

export type AssistantWorkflowDefinitionPackageSmokeSummary = {
  caseCount: number;
  runCaseCount: number;
  executionCaseCount: number;
  passCount: number;
  failCount: number;
  requiredFailCount: number;
  failedCaseIds: string[];
  requiredFailedCaseIds: string[];
};

export type AssistantWorkflowDefinitionPackageSmokeSuiteResult = {
  summary: AssistantWorkflowDefinitionPackageSmokeSummary;
  cases: AssistantWorkflowDefinitionPackageSmokeCaseResult[];
};

export async function runAssistantWorkflowDefinitionPackageSmokeSuite(
  value: unknown,
  input: AssistantWorkflowDefinitionPackageSmokeSuiteInput,
): Promise<AssistantWorkflowDefinitionPackageSmokeSuiteResult> {
  const cases: AssistantWorkflowDefinitionPackageSmokeCaseResult[] = [];

  for (const runCase of input.runCases ?? []) {
    cases.push(runAssistantWorkflowDefinitionPackageSmokeRunCase(value, runCase));
  }

  for (const executionCase of input.executionCases ?? []) {
    cases.push(await runAssistantWorkflowDefinitionPackageSmokeExecutionCase(value, executionCase));
  }

  return {
    summary: buildSmokeSummary(cases),
    cases,
  };
}

export function runAssistantWorkflowDefinitionPackageSmokeRunCase(
  value: unknown,
  runCase: AssistantWorkflowDefinitionPackageSmokeRunCase,
): AssistantWorkflowDefinitionPackageSmokeRunCaseResult {
  const packageRun = buildAssistantWorkflowRunFromPackage(value, runCase);
  const checks = [
    smokeCheck("package_run_built", true, packageRun.built),
    ...(runCase.expectedRunStatus
      ? [smokeCheck("run_status", runCase.expectedRunStatus, packageRun.run?.status ?? null)]
      : []),
    ...optionalStringSetCheck(
      "active_planning_step_profiles",
      runCase.expectedActivePlanningStepProfileIds,
      packageRun.run?.decision.plan.activePlanningStepProfileIds ?? null,
    ),
    ...optionalStringSetCheck(
      "profile_steps",
      runCase.expectedProfileStepIds,
      packageRun.run?.decision.plan.profileStepIds ?? null,
    ),
  ];

  return {
    id: normalizeCaseId(runCase.id),
    kind: "run",
    required: runCase.required !== false,
    passed: checks.every((check) => check.passed),
    checks,
    packageRun,
  };
}

export async function runAssistantWorkflowDefinitionPackageSmokeExecutionCase(
  value: unknown,
  executionCase: AssistantWorkflowDefinitionPackageSmokeExecutionCase,
): Promise<AssistantWorkflowDefinitionPackageSmokeExecutionCaseResult> {
  const execution = await executeAssistantWorkflowRunFromPackage(value, {
    ...executionCase,
    toolExecutor: buildAssistantWorkflowFixtureToolExecutor(
      executionCase.fixtures ?? {},
      executionCase.fixtureOptions ?? {},
    ),
    outcome: executionCase.outcome ?? assistantWorkflowNotHandled("package smoke execution did not produce an outcome"),
    ...(executionCase.toolExecutionOptions ? { toolExecutionOptions: executionCase.toolExecutionOptions } : {}),
  });
  const checks = [
    smokeCheck("package_execution_executed", true, execution.executed),
    ...(executionCase.expectedExecutionStatus
      ? [smokeCheck("execution_status", executionCase.expectedExecutionStatus, execution.status)]
      : []),
    ...(executionCase.expectedReportStatus
      ? [smokeCheck("report_status", executionCase.expectedReportStatus, execution.report?.status ?? null)]
      : []),
    ...(executionCase.expectedToolResultStatus
      ? [smokeCheck("tool_result_status", executionCase.expectedToolResultStatus, execution.toolExecution?.summary.status ?? null)]
      : []),
    ...optionalStringSetCheck(
      "active_planning_step_profiles",
      executionCase.expectedActivePlanningStepProfileIds,
      execution.report?.evaluation.activePlanningStepProfileIds ?? null,
    ),
    ...optionalStringSetCheck(
      "profile_steps",
      executionCase.expectedProfileStepIds,
      execution.report?.evaluation.profileStepIds ?? null,
    ),
  ];

  return {
    id: normalizeCaseId(executionCase.id),
    kind: "execution",
    required: executionCase.required !== false,
    passed: checks.every((check) => check.passed),
    checks,
    execution,
  };
}

export function buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload(
  result: AssistantWorkflowDefinitionPackageSmokeSuiteResult,
): Record<string, unknown> {
  return {
    summary: result.summary,
    cases: result.cases.map((smokeCase) => ({
      id: smokeCase.id,
      kind: smokeCase.kind,
      required: smokeCase.required,
      passed: smokeCase.passed,
      checks: smokeCase.checks.map((check) => ({ ...check })),
      ...(smokeCase.kind === "run"
        ? { packageRun: buildCompactPackageRunTracePayload(smokeCase.packageRun) }
        : { execution: buildCompactExecutionTracePayload(smokeCase.execution) }),
    })),
  };
}

function buildSmokeSummary(
  cases: readonly AssistantWorkflowDefinitionPackageSmokeCaseResult[],
): AssistantWorkflowDefinitionPackageSmokeSummary {
  const failedCases = cases.filter((smokeCase) => !smokeCase.passed);
  const requiredFailedCases = failedCases.filter((smokeCase) => smokeCase.required);

  return {
    caseCount: cases.length,
    runCaseCount: cases.filter((smokeCase) => smokeCase.kind === "run").length,
    executionCaseCount: cases.filter((smokeCase) => smokeCase.kind === "execution").length,
    passCount: cases.length - failedCases.length,
    failCount: failedCases.length,
    requiredFailCount: requiredFailedCases.length,
    failedCaseIds: failedCases.map((smokeCase) => smokeCase.id),
    requiredFailedCaseIds: requiredFailedCases.map((smokeCase) => smokeCase.id),
  };
}

function smokeCheck(
  id: string,
  expected: string | number | boolean | null,
  actual: string | number | boolean | null,
): AssistantWorkflowDefinitionPackageSmokeCheck {
  return {
    id,
    expected,
    actual,
    passed: expected === actual,
  };
}

function optionalStringSetCheck(
  id: string,
  expected: readonly string[] | undefined,
  actual: readonly string[] | null,
): AssistantWorkflowDefinitionPackageSmokeCheck[] {
  if (expected === undefined) return [];
  return [smokeCheck(id, normalizeStringSet(expected).join(","), normalizeStringSet(actual ?? []).join(","))];
}

function normalizeStringSet(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function buildCompactPackageRunTracePayload(
  result: AssistantWorkflowDefinitionPackageRunResult,
): Record<string, unknown> {
  return {
    built: result.built,
    status: result.status,
    reason: result.reason,
    resolve: {
      resolved: result.resolve.resolved,
      status: result.resolve.status,
      reason: result.resolve.reason,
      definition: result.resolve.definition
        ? {
          schemaVersion: result.resolve.definition.schemaVersion,
          workflowId: result.resolve.definition.workflowId,
          workflowVersion: result.resolve.definition.workflowVersion,
          summary: result.resolve.definition.summary,
        }
        : null,
    },
    run: result.run
      ? {
        workflowId: result.run.workflowId,
        workflowVersion: result.run.workflowVersion,
        status: result.run.status,
        intent: result.run.decision.intent,
        matchedIntent: result.run.decision.matchedIntent,
        activePlanningStepProfileIds: result.run.decision.plan.activePlanningStepProfileIds,
        profileStepIds: result.run.decision.plan.profileStepIds,
        toolInvocationCount: result.run.toolInvocationQueue.invocations.length,
        blockingReasons: result.run.executionPlan.blockingReasons,
        warnings: result.run.executionPlan.warnings,
      }
      : null,
  };
}

function buildCompactExecutionTracePayload(
  result: AssistantWorkflowDefinitionPackageExecutionResult,
): Record<string, unknown> {
  return {
    executed: result.executed,
    status: result.status,
    reason: result.reason,
    packageRun: buildCompactPackageRunTracePayload(result.packageRun),
    toolExecution: result.toolExecution
      ? {
        status: result.toolExecution.summary.status,
        totalInvocations: result.toolExecution.summary.totalInvocations,
        resultCount: result.toolExecution.summary.resultCount,
        successCount: result.toolExecution.summary.successCount,
        errorCount: result.toolExecution.summary.errorCount,
        skippedCount: result.toolExecution.summary.skippedCount,
      }
      : null,
    report: result.report
      ? {
        workflowId: result.report.workflowId,
        workflowVersion: result.report.workflowVersion,
        status: result.report.status,
        outcomeKind: result.report.outcomeSummary.kind,
        handled: result.report.outcomeSummary.handled,
        activePlanningStepProfileIds: result.report.evaluation.activePlanningStepProfileIds,
        profileStepIds: result.report.evaluation.profileStepIds,
        warningCount: result.report.evaluation.warningCount,
        signalCount: result.report.evaluation.signalCount,
      }
      : null,
  };
}

function normalizeCaseId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed.length) {
    throw new Error("Assistant workflow package smoke case id is required.");
  }
  return trimmed;
}
