import type {
  AssistantWorkflowEvalCheckName,
  AssistantWorkflowEvalCheckStatus,
  AssistantWorkflowEvalResult,
  AssistantWorkflowEvalResultStatus,
} from "./eval-result.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowEvalSuiteOptions = {
  onlyFailures?: boolean;
};

export type AssistantWorkflowEvalSuiteCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowEvalSuiteCheckCount = {
  name: AssistantWorkflowEvalCheckName;
  status: AssistantWorkflowEvalCheckStatus;
  count: number;
};

export type AssistantWorkflowEvalSuiteRow = {
  caseId: string;
  required: boolean;
  status: AssistantWorkflowEvalResultStatus;
  failedCheckNames: AssistantWorkflowEvalCheckName[];
  passedCount: number;
  failedCount: number;
  skippedCount: number;
};

export type AssistantWorkflowEvalSuite = {
  generatedAt: string;
  sourceResultCount: number;
  resultCount: number;
  passCount: number;
  failCount: number;
  skippedCount: number;
  requiredCount: number;
  requiredFailedCount: number;
  optionalFailedCount: number;
  requiredFailedCaseIds: string[];
  optionalFailedCaseIds: string[];
  statusCounts: AssistantWorkflowEvalSuiteCount[];
  checkCounts: AssistantWorkflowEvalSuiteCheckCount[];
  failedCheckCounts: AssistantWorkflowEvalSuiteCount[];
  rows: AssistantWorkflowEvalSuiteRow[];
};

export function buildAssistantWorkflowEvalSuite(
  results: readonly AssistantWorkflowEvalResult[],
  options: AssistantWorkflowEvalSuiteOptions = {},
): AssistantWorkflowEvalSuite {
  const allRows = results.map(toSuiteRow);
  const rows = options.onlyFailures === true
    ? allRows.filter((row) => row.status === "fail")
    : allRows;
  const failedRows = rows.filter((row) => row.status === "fail");
  const requiredFailedRows = failedRows.filter((row) => row.required);
  const optionalFailedRows = failedRows.filter((row) => !row.required);

  return {
    generatedAt: new Date().toISOString(),
    sourceResultCount: results.length,
    resultCount: rows.length,
    passCount: rows.filter((row) => row.status === "pass").length,
    failCount: failedRows.length,
    skippedCount: rows.filter((row) => row.status === "skipped").length,
    requiredCount: rows.filter((row) => row.required).length,
    requiredFailedCount: requiredFailedRows.length,
    optionalFailedCount: optionalFailedRows.length,
    requiredFailedCaseIds: requiredFailedRows.map((row) => row.caseId),
    optionalFailedCaseIds: optionalFailedRows.map((row) => row.caseId),
    statusCounts: buildStringCounts(rows.map((row) => row.status)),
    checkCounts: buildCheckCounts(results, rows),
    failedCheckCounts: buildStringCounts(rows.flatMap((row) => row.failedCheckNames)),
    rows,
  };
}

export function buildAssistantWorkflowEvalSuiteTracePayload(
  suite: AssistantWorkflowEvalSuite,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: suite.generatedAt,
    sourceResultCount: suite.sourceResultCount,
    resultCount: suite.resultCount,
    passCount: suite.passCount,
    failCount: suite.failCount,
    skippedCount: suite.skippedCount,
    requiredCount: suite.requiredCount,
    requiredFailedCount: suite.requiredFailedCount,
    optionalFailedCount: suite.optionalFailedCount,
    requiredFailedCaseIds: suite.requiredFailedCaseIds,
    optionalFailedCaseIds: suite.optionalFailedCaseIds,
    statusCounts: suite.statusCounts,
    checkCounts: suite.checkCounts,
    failedCheckCounts: suite.failedCheckCounts,
  };
}

function toSuiteRow(result: AssistantWorkflowEvalResult): AssistantWorkflowEvalSuiteRow {
  return {
    caseId: result.caseId,
    required: result.required,
    status: result.status,
    failedCheckNames: result.checks
      .filter((check) => check.status === "fail")
      .map((check) => check.name),
    passedCount: result.passedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
  };
}

function buildCheckCounts(
  results: readonly AssistantWorkflowEvalResult[],
  selectedRows: readonly AssistantWorkflowEvalSuiteRow[],
): AssistantWorkflowEvalSuiteCheckCount[] {
  const selectedIds = new Set(selectedRows.map((row) => row.caseId));
  const counts = new Map<string, AssistantWorkflowEvalSuiteCheckCount>();
  for (const result of results) {
    if (!selectedIds.has(result.caseId)) continue;
    for (const check of result.checks) {
      const key = `${check.name}:${check.status}`;
      const current = counts.get(key);
      if (current) {
        current.count += 1;
        continue;
      }
      counts.set(key, {
        name: check.name,
        status: check.status,
        count: 1,
      });
    }
  }
  return [...counts.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    if (left.name !== right.name) return left.name.localeCompare(right.name);
    return left.status.localeCompare(right.status);
  });
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowEvalSuiteCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value.length) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    });
}
