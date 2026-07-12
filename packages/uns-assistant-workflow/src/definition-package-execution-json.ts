import {
  buildAssistantWorkflowDefinitionPackageExecutionTracePayload,
  type AssistantWorkflowDefinitionPackageExecutionResult,
  type AssistantWorkflowDefinitionPackageExecutionStatus,
} from "./definition-package-executor.js";
import {
  parseAssistantWorkflowSerializedRunReport,
  serializeAssistantWorkflowRunReport,
  type AssistantWorkflowJsonValue,
  type AssistantWorkflowSerializedRunReport,
} from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION = 1;

export type AssistantWorkflowSerializedDefinitionPackageExecution = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION;
  executed: boolean;
  status: AssistantWorkflowDefinitionPackageExecutionStatus;
  reason: string | null;
  packageRun: Record<string, AssistantWorkflowJsonValue>;
  toolExecution: Record<string, AssistantWorkflowJsonValue> | null;
  report: AssistantWorkflowSerializedRunReport | null;
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionLineErrorReason =
  | "invalid_json"
  | "invalid_execution";

export type AssistantWorkflowSerializedDefinitionPackageExecutionLineError = {
  lineNumber: number;
  reason: AssistantWorkflowSerializedDefinitionPackageExecutionLineErrorReason;
  preview: string;
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionLinesParseResult = {
  lineCount: number;
  executionCount: number;
  errorCount: number;
  executions: AssistantWorkflowSerializedDefinitionPackageExecution[];
  errors: AssistantWorkflowSerializedDefinitionPackageExecutionLineError[];
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionLinesOptions = {
  trailingNewline?: boolean;
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionBatchOptions = {
  generatedAt?: string;
  onlyInteresting?: boolean;
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionBatchCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionBatchSummary = {
  generatedAt: string;
  sourceExecutionCount: number;
  executionCount: number;
  interestingExecutionCount: number;
  executedCount: number;
  failedExecutionCount: number;
  statusCounts: AssistantWorkflowSerializedDefinitionPackageExecutionBatchCount[];
  reportStatusCounts: AssistantWorkflowSerializedDefinitionPackageExecutionBatchCount[];
};

export type AssistantWorkflowSerializedDefinitionPackageExecutionBatch = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION;
  generatedAt: string;
  sourceExecutionCount: number;
  executionCount: number;
  summary: AssistantWorkflowSerializedDefinitionPackageExecutionBatchSummary;
  executions: AssistantWorkflowSerializedDefinitionPackageExecution[];
};

export function serializeAssistantWorkflowDefinitionPackageExecutionResult(
  result: AssistantWorkflowDefinitionPackageExecutionResult,
): AssistantWorkflowSerializedDefinitionPackageExecution {
  const trace = buildAssistantWorkflowDefinitionPackageExecutionTracePayload(result);
  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION,
    executed: result.executed,
    status: result.status,
    reason: result.reason,
    packageRun: toJsonRecord(trace["packageRun"]),
    toolExecution: trace["toolExecution"] === null ? null : toJsonRecord(trace["toolExecution"]),
    report: result.report ? serializeAssistantWorkflowRunReport(result.report) : null,
  };
}

export function stringifyAssistantWorkflowDefinitionPackageExecutionResult(
  result: AssistantWorkflowDefinitionPackageExecutionResult,
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowDefinitionPackageExecutionResult(result), null, space);
}

export function stringifyAssistantWorkflowDefinitionPackageExecutionResultLines(
  results: readonly AssistantWorkflowDefinitionPackageExecutionResult[],
  options: AssistantWorkflowSerializedDefinitionPackageExecutionLinesOptions = {},
): string {
  const lines = results.map((result) => JSON.stringify(serializeAssistantWorkflowDefinitionPackageExecutionResult(result)));
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function serializeAssistantWorkflowDefinitionPackageExecutionResults(
  results: readonly AssistantWorkflowDefinitionPackageExecutionResult[],
  options: AssistantWorkflowSerializedDefinitionPackageExecutionBatchOptions = {},
): AssistantWorkflowSerializedDefinitionPackageExecutionBatch {
  const allExecutions = results.map(serializeAssistantWorkflowDefinitionPackageExecutionResult);
  return buildAssistantWorkflowSerializedDefinitionPackageExecutionBatch(allExecutions, options);
}

export function buildAssistantWorkflowSerializedDefinitionPackageExecutionBatch(
  allExecutions: readonly AssistantWorkflowSerializedDefinitionPackageExecution[],
  options: AssistantWorkflowSerializedDefinitionPackageExecutionBatchOptions = {},
): AssistantWorkflowSerializedDefinitionPackageExecutionBatch {
  const executions = options.onlyInteresting === true
    ? allExecutions.filter(isInterestingExecution)
    : [...allExecutions];
  const generatedAt = normalizeGeneratedAt(options.generatedAt) ?? new Date().toISOString();
  const summary = buildSerializedExecutionBatchSummary(allExecutions, executions, generatedAt);

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION,
    generatedAt,
    sourceExecutionCount: allExecutions.length,
    executionCount: executions.length,
    summary,
    executions,
  };
}

export function stringifyAssistantWorkflowDefinitionPackageExecutionResults(
  results: readonly AssistantWorkflowDefinitionPackageExecutionResult[],
  options: AssistantWorkflowSerializedDefinitionPackageExecutionBatchOptions = {},
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowDefinitionPackageExecutionResults(results, options), null, space);
}

export function parseAssistantWorkflowSerializedDefinitionPackageExecution(
  value: unknown,
): AssistantWorkflowSerializedDefinitionPackageExecution | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION) return null;
  if (typeof value["executed"] !== "boolean") return null;
  if (!isPackageExecutionStatus(value["status"])) return null;
  if (value["reason"] !== null && typeof value["reason"] !== "string") return null;
  if (!isJsonRecord(value["packageRun"])) return null;
  if (value["toolExecution"] !== null && !isJsonRecord(value["toolExecution"])) return null;

  const report = value["report"] === null
    ? null
    : parseAssistantWorkflowSerializedRunReport(value["report"]);
  if (value["report"] !== null && !report) return null;
  if (value["executed"] === true && report === null) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION,
    executed: value["executed"],
    status: value["status"],
    reason: value["reason"],
    packageRun: value["packageRun"],
    toolExecution: value["toolExecution"],
    report,
  };
}

export function parseAssistantWorkflowSerializedDefinitionPackageExecutionLines(
  input: string,
): AssistantWorkflowSerializedDefinitionPackageExecutionLinesParseResult {
  const executions: AssistantWorkflowSerializedDefinitionPackageExecution[] = [];
  const errors: AssistantWorkflowSerializedDefinitionPackageExecutionLineError[] = [];
  let lineCount = 0;

  for (const [index, line] of input.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed.length) continue;
    const lineNumber = index + 1;
    lineCount += 1;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      errors.push({
        lineNumber,
        reason: "invalid_json",
        preview: previewLine(trimmed),
      });
      continue;
    }

    const execution = parseAssistantWorkflowSerializedDefinitionPackageExecution(parsed);
    if (!execution) {
      errors.push({
        lineNumber,
        reason: "invalid_execution",
        preview: previewLine(trimmed),
      });
      continue;
    }
    executions.push(execution);
  }

  return {
    lineCount,
    executionCount: executions.length,
    errorCount: errors.length,
    executions,
    errors,
  };
}

export function parseAssistantWorkflowSerializedDefinitionPackageExecutionBatch(
  value: unknown,
): AssistantWorkflowSerializedDefinitionPackageExecutionBatch | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (!isNonNegativeFiniteNumber(value["sourceExecutionCount"])) return null;
  if (!isNonNegativeFiniteNumber(value["executionCount"])) return null;
  if (!isExecutionBatchSummary(value["summary"])) return null;
  if (!Array.isArray(value["executions"])) return null;

  const executions = value["executions"].map(parseAssistantWorkflowSerializedDefinitionPackageExecution);
  if (executions.some((execution) => execution === null)) return null;
  if (executions.length !== value["executionCount"]) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_EXECUTION_JSON_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    sourceExecutionCount: value["sourceExecutionCount"],
    executionCount: value["executionCount"],
    summary: value["summary"],
    executions: executions.filter((execution): execution is AssistantWorkflowSerializedDefinitionPackageExecution => execution !== null),
  };
}

function buildSerializedExecutionBatchSummary(
  allExecutions: readonly AssistantWorkflowSerializedDefinitionPackageExecution[],
  executions: readonly AssistantWorkflowSerializedDefinitionPackageExecution[],
  generatedAt: string,
): AssistantWorkflowSerializedDefinitionPackageExecutionBatchSummary {
  return {
    generatedAt,
    sourceExecutionCount: allExecutions.length,
    executionCount: executions.length,
    interestingExecutionCount: executions.filter(isInterestingExecution).length,
    executedCount: executions.filter((execution) => execution.executed).length,
    failedExecutionCount: executions.filter((execution) => !execution.executed).length,
    statusCounts: buildStringCounts(executions.map((execution) => execution.status)),
    reportStatusCounts: buildStringCounts(executions.map((execution) => execution.report?.status ?? "none")),
  };
}

function isInterestingExecution(execution: AssistantWorkflowSerializedDefinitionPackageExecution): boolean {
  if (!execution.executed) return true;
  if (execution.status !== "report_built") return true;
  if (!execution.report) return true;
  if (execution.report.status !== "completed") return true;
  const warningCount = execution.report.evaluation["warningCount"];
  return typeof warningCount === "number" && warningCount > 0;
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowSerializedDefinitionPackageExecutionBatchCount[] {
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

function isExecutionBatchSummary(value: unknown): value is AssistantWorkflowSerializedDefinitionPackageExecutionBatchSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value["generatedAt"] === "string" &&
    isNonNegativeFiniteNumber(value["sourceExecutionCount"]) &&
    isNonNegativeFiniteNumber(value["executionCount"]) &&
    isNonNegativeFiniteNumber(value["interestingExecutionCount"]) &&
    isNonNegativeFiniteNumber(value["executedCount"]) &&
    isNonNegativeFiniteNumber(value["failedExecutionCount"]) &&
    isCountArray(value["statusCounts"]) &&
    isCountArray(value["reportStatusCounts"])
  );
}

function isCountArray(value: unknown): value is AssistantWorkflowSerializedDefinitionPackageExecutionBatchCount[] {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item["key"] === "string" &&
    isNonNegativeFiniteNumber(item["count"])
  );
}

function normalizeGeneratedAt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPackageExecutionStatus(value: unknown): value is AssistantWorkflowDefinitionPackageExecutionStatus {
  return value === "report_built" || value === "run_failed" || value === "outcome_failed";
}

function toJsonRecord(value: unknown): Record<string, AssistantWorkflowJsonValue> {
  if (!isJsonRecord(value)) {
    throw new Error("Assistant workflow package execution trace payload must be a JSON object.");
  }
  return value;
}

function isJsonRecord(value: unknown): value is Record<string, AssistantWorkflowJsonValue> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AssistantWorkflowJsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonRecord(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewLine(line: string): string {
  return line.length <= 160 ? line : `${line.slice(0, 157)}...`;
}
