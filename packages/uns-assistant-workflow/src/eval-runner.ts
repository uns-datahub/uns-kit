import type { AssistantWorkflowEvalCase } from "./eval-case.js";
import {
  buildAssistantWorkflowEvalActualFromSerializedRunReport,
  buildAssistantWorkflowEvalResultTracePayload,
  buildMissingAssistantWorkflowEvalActual,
  evaluateAssistantWorkflowEvalCase,
  evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport,
  type AssistantWorkflowEvalActualOptions,
  type AssistantWorkflowEvalResult,
} from "./eval-result.js";
import {
  buildAssistantWorkflowEvalSuite,
  buildAssistantWorkflowEvalSuiteTracePayload,
  type AssistantWorkflowEvalSuite,
} from "./eval-suite.js";
import type {
  AssistantWorkflowJsonValue,
  AssistantWorkflowSerializedRunReport,
} from "./run-report-json.js";

export type AssistantWorkflowEvalRunCaseInput = {
  evalCase: AssistantWorkflowEvalCase;
  report?: AssistantWorkflowSerializedRunReport | null;
  qualitySignalNames?: readonly string[] | null;
};

export type AssistantWorkflowEvalRunOptions = {
  onlyFailures?: boolean;
};

export type AssistantWorkflowEvalRun = {
  generatedAt: string;
  caseCount: number;
  reportCount: number;
  resultCount: number;
  missingReportCount: number;
  unmatchedReportCount: number;
  missingReportCaseIds: string[];
  suite: AssistantWorkflowEvalSuite;
  results: AssistantWorkflowEvalResult[];
};

export type AssistantWorkflowEvalRunReportsOptions =
  AssistantWorkflowEvalRunOptions & {
    qualitySignalNamesByCaseId?: Record<string, readonly string[]> | null;
  };

export function runAssistantWorkflowEvalCases(
  inputs: readonly AssistantWorkflowEvalRunCaseInput[],
  options: AssistantWorkflowEvalRunOptions = {},
): AssistantWorkflowEvalRun {
  const results = inputs.map((input) => {
    if (!input.report) {
      return evaluateAssistantWorkflowEvalCase(
        input.evalCase,
        buildMissingAssistantWorkflowEvalActual(),
      );
    }
    return evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(
      input.evalCase,
      input.report,
      buildActualOptions(input.qualitySignalNames),
    );
  });
  const suite = buildAssistantWorkflowEvalSuite(results, {
    ...(options.onlyFailures !== undefined ? { onlyFailures: options.onlyFailures } : {}),
  });
  const missingReportCaseIds = inputs
    .filter((input) => !input.report)
    .map((input) => input.evalCase.id);

  return {
    generatedAt: suite.generatedAt,
    caseCount: inputs.length,
    reportCount: inputs.filter((input) => input.report).length,
    resultCount: results.length,
    missingReportCount: missingReportCaseIds.length,
    unmatchedReportCount: 0,
    missingReportCaseIds,
    suite,
    results,
  };
}

export function runAssistantWorkflowEvalCasesAgainstSerializedRunReports(
  evalCases: readonly AssistantWorkflowEvalCase[],
  reports: readonly AssistantWorkflowSerializedRunReport[],
  options: AssistantWorkflowEvalRunReportsOptions = {},
): AssistantWorkflowEvalRun {
  const inputs = evalCases.map((evalCase, index) => ({
    evalCase,
    report: reports[index] ?? null,
    qualitySignalNames: options.qualitySignalNamesByCaseId?.[evalCase.id] ?? null,
  }));
  const run = runAssistantWorkflowEvalCases(inputs, options);
  return {
    ...run,
    reportCount: reports.length,
    unmatchedReportCount: Math.max(0, reports.length - evalCases.length),
  };
}

export function buildAssistantWorkflowEvalRunTracePayload(
  run: AssistantWorkflowEvalRun,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: run.generatedAt,
    caseCount: run.caseCount,
    reportCount: run.reportCount,
    resultCount: run.resultCount,
    missingReportCount: run.missingReportCount,
    unmatchedReportCount: run.unmatchedReportCount,
    missingReportCaseIds: run.missingReportCaseIds,
    suite: buildAssistantWorkflowEvalSuiteTracePayload(run.suite),
    results: run.results.map(buildAssistantWorkflowEvalResultTracePayload),
  };
}

function buildActualOptions(
  qualitySignalNames: readonly string[] | null | undefined,
): AssistantWorkflowEvalActualOptions {
  return qualitySignalNames ? { qualitySignalNames } : {};
}
