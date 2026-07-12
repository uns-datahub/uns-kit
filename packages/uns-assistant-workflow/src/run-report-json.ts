import {
  buildAssistantWorkflowPlanningProfileMigrationReport,
  buildAssistantWorkflowPlanningProfileMigrationReportTracePayload,
  buildAssistantWorkflowPlanningProfileMigrationReviewArtifact,
  buildAssistantWorkflowPlanningProfileMigrationReviewArtifactTracePayload,
  buildAssistantWorkflowRunReportBatch,
  buildAssistantWorkflowRunReportBatchTracePayload,
  type AssistantWorkflowPlanningProfileMigrationReport,
  type AssistantWorkflowPlanningProfileMigrationReviewArtifact,
  type AssistantWorkflowRunReportBatch,
  type AssistantWorkflowRunReportBatchCount,
  type AssistantWorkflowRunReportBatchOptions,
  type AssistantWorkflowRunReportBatchSignalCount,
} from "./run-report-batch.js";
import {
  buildAssistantWorkflowRunReportTracePayload,
  type AssistantWorkflowRunReport,
  type AssistantWorkflowRunReportStatus,
} from "./run-report.js";
import type {
  AssistantWorkflowRunEvaluationSignal,
  AssistantWorkflowRunEvaluationSignalName,
} from "./run-evaluation.js";
import {
  readAssistantWorkflowBooleanOrDefault as readBoolean,
  readAssistantWorkflowNumberOrDefault as readNumber,
  readAssistantWorkflowString,
  readAssistantWorkflowStringArray as readStringArray,
  readAssistantWorkflowStringOrDefault,
} from "./value-readers.js";

export const ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION = 1;

export type AssistantWorkflowJsonPrimitive = string | number | boolean | null;

export type AssistantWorkflowJsonValue =
  | AssistantWorkflowJsonPrimitive
  | AssistantWorkflowJsonValue[]
  | { [key: string]: AssistantWorkflowJsonValue };

export type AssistantWorkflowSerializedRunReport = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION;
  workflowId: string;
  workflowVersion: number;
  status: AssistantWorkflowRunReportStatus;
  run: Record<string, AssistantWorkflowJsonValue>;
  toolExecution: Record<string, AssistantWorkflowJsonValue> | null;
  outcome: Record<string, AssistantWorkflowJsonValue>;
  evaluation: Record<string, AssistantWorkflowJsonValue>;
};

export type AssistantWorkflowSerializedRunReportBatchOptions =
  AssistantWorkflowRunReportBatchOptions & {
    generatedAt?: string;
  };

export type AssistantWorkflowSerializedRunReportBatch = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION;
  generatedAt: string;
  sourceReportCount: number;
  reportCount: number;
  summary: Record<string, AssistantWorkflowJsonValue>;
  reports: AssistantWorkflowSerializedRunReport[];
};

export type AssistantWorkflowSerializedRunReportLinesOptions =
  AssistantWorkflowRunReportBatchOptions & {
    trailingNewline?: boolean;
  };

export type AssistantWorkflowSerializedRunReportLineErrorReason =
  | "invalid_json"
  | "invalid_report";

export type AssistantWorkflowSerializedRunReportLineError = {
  lineNumber: number;
  reason: AssistantWorkflowSerializedRunReportLineErrorReason;
  preview: string;
};

export type AssistantWorkflowSerializedRunReportLinesParseResult = {
  lineCount: number;
  reportCount: number;
  errorCount: number;
  reports: AssistantWorkflowSerializedRunReport[];
  errors: AssistantWorkflowSerializedRunReportLineError[];
};

export type AssistantWorkflowRunReportReplayLinesOptions =
  AssistantWorkflowSerializedRunReportBatchOptions & {
    minPlanningProfileRunCount?: number | null;
    currentRuntimePlanningProfileIds?: readonly string[] | null;
    migrationReviewPatchTargets?: readonly string[] | null;
    migrationReviewRequiredTestIds?: readonly string[] | null;
    migrationReviewTitle?: string | null;
  };

export type AssistantWorkflowRunReportReplayLinesInput = {
  reportLines: string;
};

export type AssistantWorkflowRunReportReplayLinesResult = {
  reportParse: AssistantWorkflowSerializedRunReportLinesParseResult;
  parseErrorCount: number;
  batch: AssistantWorkflowSerializedRunReportBatch;
  runReportBatch: AssistantWorkflowRunReportBatch;
  planningProfileMigration: AssistantWorkflowPlanningProfileMigrationReport;
  planningProfileMigrationReviewArtifact: AssistantWorkflowPlanningProfileMigrationReviewArtifact;
};

export function serializeAssistantWorkflowRunReport(
  report: AssistantWorkflowRunReport,
): AssistantWorkflowSerializedRunReport {
  const trace = buildAssistantWorkflowRunReportTracePayload(report);
  return {
    schemaVersion: ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
    workflowId: report.workflowId,
    workflowVersion: report.workflowVersion,
    status: report.status,
    run: toJsonRecord(trace["run"]),
    toolExecution: trace["toolExecution"] === null ? null : toJsonRecord(trace["toolExecution"]),
    outcome: toJsonRecord(trace["outcome"]),
    evaluation: toJsonRecord(trace["evaluation"]),
  };
}

export function stringifyAssistantWorkflowRunReport(
  report: AssistantWorkflowRunReport,
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowRunReport(report), null, space);
}

export function serializeAssistantWorkflowRunReports(
  reports: readonly AssistantWorkflowRunReport[],
  options: AssistantWorkflowSerializedRunReportBatchOptions = {},
): AssistantWorkflowSerializedRunReportBatch {
  const selectedReports = options.onlyInteresting === true
    ? reports.filter(isInterestingReport)
    : [...reports];
  const batch = buildAssistantWorkflowRunReportBatch(reports, {
    ...(options.onlyInteresting !== undefined ? { onlyInteresting: options.onlyInteresting } : {}),
  });
  const generatedAt = normalizeGeneratedAt(options.generatedAt) ?? batch.generatedAt;
  const summary = buildAssistantWorkflowRunReportBatchTracePayload({
    ...batch,
    generatedAt,
  });

  return {
    schemaVersion: ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
    generatedAt,
    sourceReportCount: reports.length,
    reportCount: selectedReports.length,
    summary: toJsonRecord(summary),
    reports: selectedReports.map(serializeAssistantWorkflowRunReport),
  };
}

export function buildAssistantWorkflowRunReportBatchFromSerializedReports(
  reports: readonly AssistantWorkflowSerializedRunReport[],
  options: AssistantWorkflowSerializedRunReportBatchOptions = {},
): AssistantWorkflowRunReportBatch {
  const rows = (
    options.onlyInteresting === true
      ? reports.filter(isInterestingSerializedReport)
      : [...reports]
  ).map(toSerializedBatchRow);
  const generatedAt = normalizeGeneratedAt(options.generatedAt) ?? new Date().toISOString();

  return {
    generatedAt,
    sourceReportCount: reports.length,
    rowCount: rows.length,
    interestingRowCount: rows.filter(isInterestingSerializedRow).length,
    warningRowCount: rows.filter((row) => row.warningCount > 0).length,
    statusCounts: buildStringCounts(rows.map((row) => row.status)),
    intentCounts: buildStringCounts(rows.map((row) => row.intent ?? "unknown")),
    outcomeCounts: buildStringCounts(rows.map((row) => row.outcomeKind)),
    toolResultStatusCounts: buildStringCounts(rows.map((row) => row.toolResultStatus ?? "none")),
    toolProviderResultCounts: buildStringCounts(rows.flatMap((row) => row.toolResultProviders)),
    activePlanningStepProfileCounts: buildStringCounts(rows.flatMap((row) => row.activePlanningStepProfileIds)),
    profileStepCounts: buildStringCounts(rows.flatMap((row) => row.profileStepIds)),
    directRouteDoneCounts: buildStringCounts(rows.flatMap((row) => row.directRouteDoneRoutes)),
    directRouteRecoveredCounts: buildStringCounts(rows.flatMap((row) => row.directRouteRecoveredRoutes)),
    directRouteErrorCounts: buildStringCounts(rows.flatMap((row) => row.directRouteErrorRoutes)),
    directRouteSkipReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.directRouteSkipReasons).filter(isActionableDirectRouteSkipReason),
    ),
    directRouteGapReasonCounts: buildStringCounts(rows.flatMap((row) => row.directRouteGapReasons)),
    directRouteObservedStrategyCounts: buildStringCounts(rows.flatMap((row) => row.directRouteObservedStrategies)),
    directRouteUndeclaredStrategyCounts: buildStringCounts(rows.flatMap((row) => row.directRouteUndeclaredStrategies)),
    memoryChangedSlotCounts: buildStringCounts(rows.flatMap((row) => row.memoryChangedSlots)),
    memoryChangedProfileFieldCounts: buildStringCounts(rows.flatMap((row) => row.memoryChangedProfileFields)),
    memorySkippedPatchReasonCounts: buildStringCounts(rows.flatMap((row) => row.memorySkippedPatchReasons)),
    threadProfileWriteSourceCounts: buildStringCounts(rows.flatMap((row) => row.threadProfileWriteSources)),
    threadProfileWriteReasonCounts: buildStringCounts(rows.flatMap((row) => row.threadProfileWriteReasons)),
    threadProfileWriteChangedFieldCounts: buildStringCounts(rows.flatMap((row) => row.threadProfileWriteChangedFields)),
    signalCounts: buildSignalCounts(rows.flatMap((row) => row.signals)),
    rows,
  };
}

export function serializeAssistantWorkflowSerializedRunReports(
  reports: readonly AssistantWorkflowSerializedRunReport[],
  options: AssistantWorkflowSerializedRunReportBatchOptions = {},
): AssistantWorkflowSerializedRunReportBatch {
  const selectedReports = options.onlyInteresting === true
    ? reports.filter(isInterestingSerializedReport)
    : [...reports];
  const batch = buildAssistantWorkflowRunReportBatchFromSerializedReports(reports, options);
  const summary = buildAssistantWorkflowRunReportBatchTracePayload(batch);

  return {
    schemaVersion: ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
    generatedAt: batch.generatedAt,
    sourceReportCount: reports.length,
    reportCount: selectedReports.length,
    summary: toJsonRecord(summary),
    reports: selectedReports,
  };
}

export function stringifyAssistantWorkflowRunReports(
  reports: readonly AssistantWorkflowRunReport[],
  options: AssistantWorkflowSerializedRunReportBatchOptions = {},
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowRunReports(reports, options), null, space);
}

export function stringifyAssistantWorkflowRunReportLines(
  reports: readonly AssistantWorkflowRunReport[],
  options: AssistantWorkflowSerializedRunReportLinesOptions = {},
): string {
  const selectedReports = options.onlyInteresting === true
    ? reports.filter(isInterestingReport)
    : [...reports];
  return stringifyAssistantWorkflowSerializedRunReportLines(
    selectedReports.map(serializeAssistantWorkflowRunReport),
    options,
  );
}

export function stringifyAssistantWorkflowSerializedRunReportLines(
  reports: readonly AssistantWorkflowSerializedRunReport[],
  options: AssistantWorkflowSerializedRunReportLinesOptions = {},
): string {
  const selectedReports = options.onlyInteresting === true
    ? reports.filter(isInterestingSerializedReport)
    : [...reports];
  const lines = selectedReports.map((report) => JSON.stringify(report));
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function parseAssistantWorkflowSerializedRunReport(
  value: unknown,
): AssistantWorkflowSerializedRunReport | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION) return null;
  if (typeof value["workflowId"] !== "string" || !value["workflowId"].trim().length) return null;
  if (typeof value["workflowVersion"] !== "number" || !Number.isFinite(value["workflowVersion"])) return null;
  if (!isRunReportStatus(value["status"])) return null;
  if (!isJsonRecord(value["run"])) return null;
  if (value["toolExecution"] !== null && !isJsonRecord(value["toolExecution"])) return null;
  if (!isJsonRecord(value["outcome"])) return null;
  if (!isJsonRecord(value["evaluation"])) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
    workflowId: value["workflowId"],
    workflowVersion: value["workflowVersion"],
    status: value["status"],
    run: value["run"],
    toolExecution: value["toolExecution"],
    outcome: value["outcome"],
    evaluation: value["evaluation"],
  };
}

export function parseAssistantWorkflowSerializedRunReportLines(
  input: string,
): AssistantWorkflowSerializedRunReportLinesParseResult {
  const reports: AssistantWorkflowSerializedRunReport[] = [];
  const errors: AssistantWorkflowSerializedRunReportLineError[] = [];
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

    const report = parseAssistantWorkflowSerializedRunReport(parsed);
    if (!report) {
      errors.push({
        lineNumber,
        reason: "invalid_report",
        preview: previewLine(trimmed),
      });
      continue;
    }
    reports.push(report);
  }

  return {
    lineCount,
    reportCount: reports.length,
    errorCount: errors.length,
    reports,
    errors,
  };
}

export function parseAssistantWorkflowSerializedRunReportBatch(
  value: unknown,
): AssistantWorkflowSerializedRunReportBatch | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (!isNonNegativeFiniteNumber(value["sourceReportCount"])) return null;
  if (!isNonNegativeFiniteNumber(value["reportCount"])) return null;
  if (!isJsonRecord(value["summary"])) return null;
  if (!Array.isArray(value["reports"])) return null;

  const reports = value["reports"].map(parseAssistantWorkflowSerializedRunReport);
  if (reports.some((report) => report === null)) return null;
  if (reports.length !== value["reportCount"]) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    sourceReportCount: value["sourceReportCount"],
    reportCount: value["reportCount"],
    summary: value["summary"],
    reports: reports.filter((report): report is AssistantWorkflowSerializedRunReport => report !== null),
  };
}

export function runAssistantWorkflowRunReportReplayLines(
  input: AssistantWorkflowRunReportReplayLinesInput,
  options: AssistantWorkflowRunReportReplayLinesOptions = {},
): AssistantWorkflowRunReportReplayLinesResult {
  const reportParse = parseAssistantWorkflowSerializedRunReportLines(input.reportLines);
  const runReportBatch = buildAssistantWorkflowRunReportBatchFromSerializedReports(reportParse.reports, options);
  const batch = serializeAssistantWorkflowSerializedRunReports(reportParse.reports, options);
  const planningProfileMigration = buildAssistantWorkflowPlanningProfileMigrationReport(runReportBatch, {
    ...(options.minPlanningProfileRunCount !== undefined
      ? { minRunCount: options.minPlanningProfileRunCount }
      : {}),
    ...(options.currentRuntimePlanningProfileIds !== undefined
      ? { currentRuntimeProfileIds: options.currentRuntimePlanningProfileIds }
      : {}),
    generatedAt: runReportBatch.generatedAt,
  });
  const planningProfileMigrationReviewArtifact = buildAssistantWorkflowPlanningProfileMigrationReviewArtifact(
    planningProfileMigration,
    {
      ...(options.migrationReviewTitle !== undefined ? { title: options.migrationReviewTitle } : {}),
      ...(options.migrationReviewPatchTargets !== undefined
        ? { patchTargets: options.migrationReviewPatchTargets }
        : {}),
      ...(options.migrationReviewRequiredTestIds !== undefined
        ? { requiredTestIds: options.migrationReviewRequiredTestIds }
        : {}),
    },
  );

  return {
    reportParse,
    parseErrorCount: reportParse.errorCount,
    batch,
    runReportBatch,
    planningProfileMigration,
    planningProfileMigrationReviewArtifact,
  };
}

export function buildAssistantWorkflowRunReportReplayLinesTracePayload(
  result: AssistantWorkflowRunReportReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
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
    batch: {
      generatedAt: result.batch.generatedAt,
      sourceReportCount: result.batch.sourceReportCount,
      reportCount: result.batch.reportCount,
      summary: result.batch.summary,
    },
    planningProfileMigration: toJsonRecord(
      buildAssistantWorkflowPlanningProfileMigrationReportTracePayload(result.planningProfileMigration),
    ),
    planningProfileMigrationReviewArtifact: toJsonRecord(
      buildAssistantWorkflowPlanningProfileMigrationReviewArtifactTracePayload(
        result.planningProfileMigrationReviewArtifact,
      ),
    ),
  };
}

function isInterestingReport(report: AssistantWorkflowRunReport): boolean {
  return report.status !== "completed" || report.evaluation.warningCount > 0 || report.evaluation.handled === false;
}

function isInterestingSerializedReport(report: AssistantWorkflowSerializedRunReport): boolean {
  return isInterestingSerializedRow(toSerializedBatchRow(report));
}

function isInterestingSerializedRow(
  row: AssistantWorkflowRunReportBatch["rows"][number],
): boolean {
  return row.status !== "completed" || row.warningCount > 0 || row.handled === false;
}

function isActionableDirectRouteSkipReason(value: string): boolean {
  return !value.endsWith(":runtime_policy_disabled") && !value.endsWith(":runtime_disabled");
}

function toSerializedBatchRow(
  report: AssistantWorkflowSerializedRunReport,
): AssistantWorkflowRunReportBatch["rows"][number] {
  return {
    workflowId: report.workflowId,
    workflowVersion: report.workflowVersion,
    status: report.status,
    intent: readOptionalString(report.evaluation["intent"]),
    outcomeKind: readString(report.evaluation["outcomeKind"], "unknown"),
    handled: readBoolean(report.evaluation["handled"], false),
    toolResultStatus: readOptionalString(report.evaluation["toolResultStatus"]),
    toolResultProviders: readSerializedToolResultProviders(report.toolExecution),
    activePlanningStepProfileIds: readStringArray(report.evaluation["activePlanningStepProfileIds"]),
    profileStepIds: readStringArray(report.evaluation["profileStepIds"]),
    directRouteDoneRoutes: readStringArray(report.evaluation["directRouteDoneRoutes"]),
    directRouteRecoveredRoutes: readStringArray(report.evaluation["directRouteRecoveredRoutes"]),
    directRouteErrorRoutes: readStringArray(report.evaluation["directRouteErrorRoutes"]),
    directRouteSkipReasons: readStringArray(report.evaluation["directRouteSkipReasons"]),
    directRouteGapReasons: readStringArray(report.evaluation["directRouteGapReasons"]),
    directRouteObservedStrategies: readStringArray(report.evaluation["directRouteObservedStrategies"]),
    directRouteUndeclaredStrategies: readStringArray(report.evaluation["directRouteUndeclaredStrategies"]),
    memoryChangedSlots: readStringArray(report.evaluation["memoryChangedSlots"]),
    memoryChangedProfileFields: readStringArray(report.evaluation["memoryChangedProfileFields"]),
    memorySkippedPatchReasons: readStringArray(report.evaluation["memorySkippedPatchReasons"]),
    threadProfileWriteSources: readStringArray(report.evaluation["threadProfileWriteSources"]),
    threadProfileWriteReasons: readStringArray(report.evaluation["threadProfileWriteReasons"]),
    threadProfileWriteChangedFields: readStringArray(report.evaluation["threadProfileWriteChangedFields"]),
    signalCount: readNumber(report.evaluation["signalCount"], 0),
    warningCount: readNumber(report.evaluation["warningCount"], 0),
    signals: readRunEvaluationSignals(report.evaluation["signals"]),
  };
}

function readSerializedToolResultProviders(
  toolExecution: Record<string, AssistantWorkflowJsonValue> | null,
): string[] {
  if (!toolExecution || !Array.isArray(toolExecution["results"])) return [];
  return toolExecution["results"].flatMap((value) => {
    if (!isJsonRecord(value)) return [];
    const provider = readOptionalString(value["provider"]);
    return provider ? [provider] : [];
  });
}

function readRunEvaluationSignals(value: AssistantWorkflowJsonValue | undefined): AssistantWorkflowRunEvaluationSignal[] {
  if (!Array.isArray(value)) return [];
  const signals: AssistantWorkflowRunEvaluationSignal[] = [];
  for (const item of value) {
    if (!isJsonRecord(item)) continue;
    const name = item["name"];
    const severity = item["severity"];
    if (!isRunEvaluationSignalName(name)) continue;
    if (severity !== "info" && severity !== "warning") continue;
    signals.push({
      name,
      severity,
      detail: readOptionalString(item["detail"]),
    });
  }
  return signals;
}

function isRunEvaluationSignalName(value: unknown): value is AssistantWorkflowRunEvaluationSignalName {
  return (
    value === "run_not_handled" ||
    value === "run_needs_clarification" ||
    value === "run_degraded" ||
    value === "run_failed" ||
    value === "missing_required_tools" ||
    value === "missing_tool_bindings" ||
    value === "missing_context" ||
    value === "clarification_policy_mismatch" ||
    value === "tool_execution_failed" ||
    value === "tool_execution_partial" ||
    value === "outcome_unhandled"
  );
}

function readString(value: AssistantWorkflowJsonValue | undefined, fallback: string): string {
  return readAssistantWorkflowStringOrDefault(value, fallback, { trim: false });
}

function readOptionalString(value: AssistantWorkflowJsonValue | undefined): string | null {
  return readAssistantWorkflowString(value, { trim: false });
}

function normalizeGeneratedAt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function previewLine(line: string): string {
  return line.length <= 160 ? line : `${line.slice(0, 157)}...`;
}

function toJsonRecord(value: unknown): Record<string, AssistantWorkflowJsonValue> {
  if (!isJsonRecord(value)) {
    throw new Error("Assistant workflow run report trace payload must be a JSON object.");
  }
  return value;
}

function isRunReportStatus(value: unknown): value is AssistantWorkflowRunReportStatus {
  return (
    value === "completed" ||
    value === "clarification" ||
    value === "degraded" ||
    value === "failed" ||
    value === "not_handled"
  );
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

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function uniqueNonEmptyStrings(values: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized.length || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowRunReportBatchCount[] {
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

function buildSignalCounts(
  signals: readonly AssistantWorkflowRunEvaluationSignal[],
): AssistantWorkflowRunReportBatchSignalCount[] {
  const counts = new Map<string, AssistantWorkflowRunReportBatchSignalCount>();
  for (const signal of signals) {
    const current = counts.get(signal.name);
    if (current) {
      current.count += 1;
      if (signal.severity === "warning") current.severity = "warning";
      continue;
    }
    counts.set(signal.name, {
      name: signal.name,
      severity: signal.severity,
      count: 1,
    });
  }
  return [...counts.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    if (left.severity !== right.severity) return left.severity === "warning" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
