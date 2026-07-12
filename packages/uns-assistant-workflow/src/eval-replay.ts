import {
  parseAssistantWorkflowEvalCaseLines,
  type AssistantWorkflowEvalCaseLinesParseResult,
} from "./eval-case.js";
import {
  buildAssistantWorkflowEvalRunTracePayload,
  runAssistantWorkflowEvalCasesAgainstSerializedRunReports,
  type AssistantWorkflowEvalRun,
  type AssistantWorkflowEvalRunReportsOptions,
} from "./eval-runner.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";
import {
  parseAssistantWorkflowSerializedRunReportLines,
  type AssistantWorkflowSerializedRunReportLinesParseResult,
} from "./run-report-json.js";

export type AssistantWorkflowEvalReplayLinesOptions = AssistantWorkflowEvalRunReportsOptions;

export type AssistantWorkflowEvalReplayLinesInput = {
  evalCaseLines: string;
  reportLines: string;
};

export type AssistantWorkflowEvalReplayLinesResult = {
  caseParse: AssistantWorkflowEvalCaseLinesParseResult;
  reportParse: AssistantWorkflowSerializedRunReportLinesParseResult;
  parseErrorCount: number;
  run: AssistantWorkflowEvalRun;
};

export function runAssistantWorkflowEvalReplayLines(
  input: AssistantWorkflowEvalReplayLinesInput,
  options: AssistantWorkflowEvalReplayLinesOptions = {},
): AssistantWorkflowEvalReplayLinesResult {
  const caseParse = parseAssistantWorkflowEvalCaseLines(input.evalCaseLines);
  const reportParse = parseAssistantWorkflowSerializedRunReportLines(input.reportLines);
  const run = runAssistantWorkflowEvalCasesAgainstSerializedRunReports(
    caseParse.cases,
    reportParse.reports,
    options,
  );

  return {
    caseParse,
    reportParse,
    parseErrorCount: caseParse.errorCount + reportParse.errorCount,
    run,
  };
}

export function buildAssistantWorkflowEvalReplayLinesTracePayload(
  result: AssistantWorkflowEvalReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    caseParse: {
      lineCount: result.caseParse.lineCount,
      caseCount: result.caseParse.caseCount,
      errorCount: result.caseParse.errorCount,
      errors: result.caseParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    reportParse: {
      lineCount: result.reportParse.lineCount,
      reportCount: result.reportParse.reportCount,
      errorCount: result.reportParse.errorCount,
      errors: result.reportParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    parseErrorCount: result.parseErrorCount,
    run: buildAssistantWorkflowEvalRunTracePayload(result.run),
  };
}
