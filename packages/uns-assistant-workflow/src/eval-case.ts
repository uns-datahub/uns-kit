import type { AssistantWorkflowRunReportStatus } from "./run-report.js";
import type {
  AssistantWorkflowJsonValue,
  AssistantWorkflowSerializedRunReport,
} from "./run-report-json.js";
import type { AssistantWorkflowSerializedToolSelectionDecision } from "./tool-selection-json.js";
import type { AssistantWorkflowTraceEvalCandidate } from "./trace-replay.js";
import {
  readAssistantWorkflowNestedArray as readNestedArray,
  readAssistantWorkflowNestedString as readNestedStringOrNull,
  readAssistantWorkflowString as readStringOrNull,
  readAssistantWorkflowStringArray as readStringArray,
} from "./value-readers.js";

export const ASSISTANT_WORKFLOW_EVAL_CASE_SCHEMA_VERSION = 1;

export type AssistantWorkflowEvalCaseSourceKind =
  | "manual"
  | "trace-replay"
  | "run-report"
  | "tool-selection";

export type AssistantWorkflowEvalCaseSource = {
  kind: AssistantWorkflowEvalCaseSourceKind;
  requestId: string | null;
  debugId: string | null;
  workflowId: string | null;
  workflowVersion: number | null;
  createdAt: string | null;
};

export type AssistantWorkflowEvalCaseExpectations = {
  intent: string | null;
  presentation: string | null;
  status: AssistantWorkflowRunReportStatus | null;
  outcomeKind: string | null;
  planStepIds: string[];
  activePlanningStepProfileIds: string[];
  profileStepIds: string[];
  tools: string[];
  signalNames: string[];
  qualitySignalNames: string[];
};

type AssistantWorkflowEvalCaseExpectationRecord =
  Omit<AssistantWorkflowEvalCaseExpectations, "activePlanningStepProfileIds" | "profileStepIds"> &
    Partial<Pick<AssistantWorkflowEvalCaseExpectations, "activePlanningStepProfileIds" | "profileStepIds">>;

export type AssistantWorkflowEvalCase = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_EVAL_CASE_SCHEMA_VERSION;
  id: string;
  prompt: string;
  required: boolean;
  tags: string[];
  source: AssistantWorkflowEvalCaseSource;
  expectations: AssistantWorkflowEvalCaseExpectations;
  notes: string[];
  metadata: Record<string, AssistantWorkflowJsonValue>;
};

export type AssistantWorkflowEvalCaseInput = {
  id?: string | null;
  prompt: string;
  required?: boolean | null;
  tags?: readonly string[] | null;
  source?: Partial<AssistantWorkflowEvalCaseSource> | null;
  expectations?: Partial<AssistantWorkflowEvalCaseExpectations> | null;
  notes?: readonly string[] | null;
  metadata?: Record<string, AssistantWorkflowJsonValue> | null;
};

export type AssistantWorkflowTraceEvalCaseOptions = {
  id?: string | null;
  required?: boolean | null;
  tags?: readonly string[] | null;
  source?: Partial<AssistantWorkflowEvalCaseSource> | null;
  notes?: readonly string[] | null;
  metadata?: Record<string, AssistantWorkflowJsonValue> | null;
};

export type AssistantWorkflowRunReportEvalCaseOptions =
  AssistantWorkflowTraceEvalCaseOptions & {
    prompt: string;
  };

export type AssistantWorkflowToolSelectionEvalCaseOptions =
  AssistantWorkflowTraceEvalCaseOptions & {
    prompt: string;
  };

export type AssistantWorkflowEvalCaseLineErrorReason =
  | "invalid_json"
  | "invalid_eval_case";

export type AssistantWorkflowEvalCaseLineError = {
  lineNumber: number;
  reason: AssistantWorkflowEvalCaseLineErrorReason;
  preview: string;
};

export type AssistantWorkflowEvalCaseLinesParseResult = {
  lineCount: number;
  caseCount: number;
  errorCount: number;
  cases: AssistantWorkflowEvalCase[];
  errors: AssistantWorkflowEvalCaseLineError[];
};

export function buildAssistantWorkflowEvalCase(input: AssistantWorkflowEvalCaseInput): AssistantWorkflowEvalCase {
  const prompt = normalizeRequiredString(input.prompt, "prompt");
  const source = normalizeEvalCaseSource(input.source, "manual");
  const expectations = normalizeEvalCaseExpectations(input.expectations);
  const tags = uniqueNonEmptyStrings(input.tags ?? []);
  const notes = uniqueNonEmptyStrings(input.notes ?? []);
  const metadata = input.metadata ?? {};

  return {
    schemaVersion: ASSISTANT_WORKFLOW_EVAL_CASE_SCHEMA_VERSION,
    id: normalizeOptionalString(input.id) ?? buildEvalCaseId(prompt, expectations.intent, source.kind),
    prompt,
    required: input.required === true,
    tags,
    source,
    expectations,
    notes,
    metadata,
  };
}

export function buildAssistantWorkflowEvalCaseFromTraceCandidate(
  candidate: AssistantWorkflowTraceEvalCandidate,
  options: AssistantWorkflowTraceEvalCaseOptions = {},
): AssistantWorkflowEvalCase {
  return buildAssistantWorkflowEvalCase({
    prompt: candidate.promptPreview,
    source: {
      ...options.source,
      kind: options.source?.kind ?? "trace-replay",
    },
    expectations: {
      intent: candidate.expectedIntent,
      presentation: candidate.expectedPresentation,
      planStepIds: candidate.expectedPlanStepIds,
      activePlanningStepProfileIds: candidate.expectedActivePlanningStepProfileIds,
      profileStepIds: candidate.expectedProfileStepIds,
      tools: candidate.expectedTools,
      qualitySignalNames: candidate.qualitySignalNames,
    },
    notes: [...candidate.notes, ...(options.notes ?? [])],
    ...(options.id !== undefined ? { id: options.id } : {}),
    ...(options.required !== undefined ? { required: options.required } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
  });
}

export function buildAssistantWorkflowEvalCaseFromSerializedRunReport(
  report: AssistantWorkflowSerializedRunReport,
  options: AssistantWorkflowRunReportEvalCaseOptions,
): AssistantWorkflowEvalCase {
  return buildAssistantWorkflowEvalCase({
    prompt: options.prompt,
    source: {
      ...options.source,
      kind: options.source?.kind ?? "run-report",
      workflowId: options.source?.workflowId ?? report.workflowId,
      workflowVersion: options.source?.workflowVersion ?? report.workflowVersion,
    },
    expectations: {
      intent: readStringOrNull(report.evaluation["intent"]) ?? readNestedStringOrNull(report.run, ["decision", "intent"]),
      presentation: readNestedStringOrNull(report.run, ["decision", "effectivePresentation"]),
      status: report.status,
      outcomeKind: readStringOrNull(report.evaluation["outcomeKind"]) ?? readStringOrNull(report.outcome["kind"]),
      planStepIds: readPlanStepIds(report),
      activePlanningStepProfileIds: readStringArray(report.evaluation["activePlanningStepProfileIds"]),
      profileStepIds: readStringArray(report.evaluation["profileStepIds"]),
      tools: readInvocationToolNames(report),
      signalNames: readSignalNames(report),
    },
    ...(options.id !== undefined ? { id: options.id } : {}),
    ...(options.required !== undefined ? { required: options.required } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.notes !== undefined ? { notes: options.notes } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
  });
}

export function buildAssistantWorkflowEvalCaseFromSerializedToolSelectionDecision(
  decision: AssistantWorkflowSerializedToolSelectionDecision,
  options: AssistantWorkflowToolSelectionEvalCaseOptions,
): AssistantWorkflowEvalCase {
  return buildAssistantWorkflowEvalCase({
    prompt: options.prompt,
    source: {
      ...options.source,
      kind: options.source?.kind ?? "tool-selection",
      workflowId: options.source?.workflowId ?? readNestedStringOrNull(decision.comparisonPayload, ["workflowRun", "workflowId"]),
      workflowVersion: options.source?.workflowVersion ?? readWorkflowVersion(decision),
    },
    expectations: {
      intent: readNestedStringOrNull(decision.comparisonPayload, ["intent"])
        ?? readNestedStringOrNull(decision.comparisonPayload, ["workflowRun", "decision", "intent"]),
      presentation: readNestedStringOrNull(decision.comparisonPayload, ["effectivePresentation"])
        ?? readNestedStringOrNull(decision.comparisonPayload, ["workflowRun", "decision", "effectivePresentation"]),
      planStepIds: readSelectionPlanStepIds(decision),
      activePlanningStepProfileIds: readSelectionActivePlanningStepProfileIds(decision),
      profileStepIds: readSelectionProfileStepIds(decision),
      tools: decision.effectiveToolNames,
      signalNames: uniqueNonEmptyStrings([
        decision.authority.source,
        decision.authority.reason,
      ]),
    },
    notes: [
      `tool_selection_authority: ${decision.authority.source}/${decision.authority.reason}`,
      ...(options.notes ?? []),
    ],
    metadata: {
      ...(options.metadata ?? {}),
      authoritySource: decision.authority.source,
      authorityReason: decision.authority.reason,
    },
    ...(options.id !== undefined ? { id: options.id } : {}),
    ...(options.required !== undefined ? { required: options.required } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
  });
}

export function stringifyAssistantWorkflowEvalCase(
  evalCase: AssistantWorkflowEvalCase,
  space?: number,
): string {
  return JSON.stringify(evalCase, null, space);
}

export function stringifyAssistantWorkflowEvalCaseLines(
  cases: readonly AssistantWorkflowEvalCase[],
  options: { trailingNewline?: boolean } = {},
): string {
  const lines = cases.map((evalCase) => JSON.stringify(evalCase));
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function parseAssistantWorkflowEvalCase(value: unknown): AssistantWorkflowEvalCase | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_EVAL_CASE_SCHEMA_VERSION) return null;
  if (typeof value["id"] !== "string" || !value["id"].trim().length) return null;
  if (typeof value["prompt"] !== "string" || !value["prompt"].trim().length) return null;
  if (typeof value["required"] !== "boolean") return null;
  if (!isStringArray(value["tags"])) return null;
  if (!isEvalCaseSource(value["source"])) return null;
  if (!isEvalCaseExpectations(value["expectations"])) return null;
  if (!isStringArray(value["notes"])) return null;
  if (!isJsonRecord(value["metadata"])) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_EVAL_CASE_SCHEMA_VERSION,
    id: value["id"],
    prompt: value["prompt"],
    required: value["required"],
    tags: value["tags"],
    source: value["source"],
    expectations: normalizeEvalCaseExpectations(value["expectations"]),
    notes: value["notes"],
    metadata: value["metadata"],
  };
}

export function parseAssistantWorkflowEvalCaseLines(input: string): AssistantWorkflowEvalCaseLinesParseResult {
  const cases: AssistantWorkflowEvalCase[] = [];
  const errors: AssistantWorkflowEvalCaseLineError[] = [];
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

    const evalCase = parseAssistantWorkflowEvalCase(parsed);
    if (!evalCase) {
      errors.push({
        lineNumber,
        reason: "invalid_eval_case",
        preview: previewLine(trimmed),
      });
      continue;
    }
    cases.push(evalCase);
  }

  return {
    lineCount,
    caseCount: cases.length,
    errorCount: errors.length,
    cases,
    errors,
  };
}

function normalizeEvalCaseSource(
  source: Partial<AssistantWorkflowEvalCaseSource> | null | undefined,
  fallbackKind: AssistantWorkflowEvalCaseSourceKind,
): AssistantWorkflowEvalCaseSource {
  return {
    kind: isEvalCaseSourceKind(source?.kind) ? source.kind : fallbackKind,
    requestId: normalizeOptionalString(source?.requestId),
    debugId: normalizeOptionalString(source?.debugId),
    workflowId: normalizeOptionalString(source?.workflowId),
    workflowVersion: typeof source?.workflowVersion === "number" && Number.isFinite(source.workflowVersion)
      ? source.workflowVersion
      : null,
    createdAt: normalizeOptionalString(source?.createdAt),
  };
}

function normalizeEvalCaseExpectations(
  expectations: Partial<AssistantWorkflowEvalCaseExpectations> | null | undefined,
): AssistantWorkflowEvalCaseExpectations {
  return {
    intent: normalizeOptionalString(expectations?.intent),
    presentation: normalizeOptionalString(expectations?.presentation),
    status: isRunReportStatus(expectations?.status) ? expectations.status : null,
    outcomeKind: normalizeOptionalString(expectations?.outcomeKind),
    planStepIds: uniqueNonEmptyStrings(expectations?.planStepIds ?? []),
    activePlanningStepProfileIds: uniqueNonEmptyStrings(expectations?.activePlanningStepProfileIds ?? []),
    profileStepIds: uniqueNonEmptyStrings(expectations?.profileStepIds ?? []),
    tools: uniqueNonEmptyStrings(expectations?.tools ?? []),
    signalNames: uniqueNonEmptyStrings(expectations?.signalNames ?? []),
    qualitySignalNames: uniqueNonEmptyStrings(expectations?.qualitySignalNames ?? []),
  };
}

function readPlanStepIds(report: AssistantWorkflowSerializedRunReport): string[] {
  const steps = readNestedArray(report.run, ["executionPlan", "steps"]);
  return uniqueNonEmptyStrings(steps.flatMap((step) => isRecord(step) ? [step["id"]] : []));
}

function readInvocationToolNames(report: AssistantWorkflowSerializedRunReport): string[] {
  const invocations = readNestedArray(report.run, ["toolInvocationQueue", "invocations"]);
  return uniqueNonEmptyStrings(invocations.flatMap((invocation) =>
    isRecord(invocation) ? [invocation["toolName"]] : []
  ));
}

function readSignalNames(report: AssistantWorkflowSerializedRunReport): string[] {
  const signals = readNestedArray(report.evaluation, ["signals"]);
  return uniqueNonEmptyStrings(signals.flatMap((signal) => isRecord(signal) ? [signal["name"]] : []));
}

function readSelectionPlanStepIds(decision: AssistantWorkflowSerializedToolSelectionDecision): string[] {
  const fromPlan = readNestedArray(decision.comparisonPayload, ["plan", "stepIds"]);
  if (fromPlan.length) return uniqueNonEmptyStrings(fromPlan);
  const fromExecutionPlan = readNestedArray(decision.comparisonPayload, ["executionPlan", "steps"]);
  return uniqueNonEmptyStrings(fromExecutionPlan.flatMap((step) => isRecord(step) ? [step["id"]] : []));
}

function readSelectionActivePlanningStepProfileIds(decision: AssistantWorkflowSerializedToolSelectionDecision): string[] {
  const fromPlan = readNestedArray(decision.comparisonPayload, ["plan", "activePlanningStepProfileIds"]);
  if (fromPlan.length) return uniqueNonEmptyStrings(fromPlan);
  return readNestedArray(decision.comparisonPayload, ["workflowRun", "decision", "plan", "activePlanningStepProfileIds"])
    .filter((value): value is string => typeof value === "string");
}

function readSelectionProfileStepIds(decision: AssistantWorkflowSerializedToolSelectionDecision): string[] {
  const fromPlan = readNestedArray(decision.comparisonPayload, ["plan", "profileStepIds"]);
  if (fromPlan.length) return uniqueNonEmptyStrings(fromPlan);
  return readNestedArray(decision.comparisonPayload, ["workflowRun", "decision", "plan", "profileStepIds"])
    .filter((value): value is string => typeof value === "string");
}

function readWorkflowVersion(decision: AssistantWorkflowSerializedToolSelectionDecision): number | null {
  const payload = decision.comparisonPayload;
  if (!isRecord(payload)) return null;
  const workflowRun = payload["workflowRun"];
  if (!isRecord(workflowRun)) return null;
  return typeof workflowRun["workflowVersion"] === "number" && Number.isFinite(workflowRun["workflowVersion"])
    ? workflowRun["workflowVersion"]
    : null;
}

function buildEvalCaseId(
  prompt: string,
  intent: string | null,
  sourceKind: AssistantWorkflowEvalCaseSourceKind,
): string {
  const prefix = [sourceKind, intent ?? "unknown"].map(toIdSegment).join("-");
  return `${prefix}-${hashString(prompt)}`;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function toIdSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.length ? normalized : "unknown";
}

function uniqueNonEmptyStrings(values: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed.length || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error(`Assistant workflow eval case ${fieldName} is required.`);
  }
  return trimmed;
}

function isEvalCaseSource(value: unknown): value is AssistantWorkflowEvalCaseSource {
  if (!isRecord(value)) return false;
  return (
    isEvalCaseSourceKind(value["kind"]) &&
    isNullableString(value["requestId"]) &&
    isNullableString(value["debugId"]) &&
    isNullableString(value["workflowId"]) &&
    (value["workflowVersion"] === null || (typeof value["workflowVersion"] === "number" && Number.isFinite(value["workflowVersion"]))) &&
    isNullableString(value["createdAt"])
  );
}

function isEvalCaseExpectations(value: unknown): value is AssistantWorkflowEvalCaseExpectationRecord {
  if (!isRecord(value)) return false;
  return (
    isNullableString(value["intent"]) &&
    isNullableString(value["presentation"]) &&
    (value["status"] === null || isRunReportStatus(value["status"])) &&
    isNullableString(value["outcomeKind"]) &&
    isStringArray(value["planStepIds"]) &&
    (value["activePlanningStepProfileIds"] === undefined || isStringArray(value["activePlanningStepProfileIds"])) &&
    (value["profileStepIds"] === undefined || isStringArray(value["profileStepIds"])) &&
    isStringArray(value["tools"]) &&
    isStringArray(value["signalNames"]) &&
    isStringArray(value["qualitySignalNames"])
  );
}

function isEvalCaseSourceKind(value: unknown): value is AssistantWorkflowEvalCaseSourceKind {
  return value === "manual" || value === "trace-replay" || value === "run-report" || value === "tool-selection";
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
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
