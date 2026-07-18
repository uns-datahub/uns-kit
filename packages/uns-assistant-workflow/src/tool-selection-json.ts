import type { AssistantWorkflowJsonValue } from "./run-report-json.js";
import type {
  AssistantWorkflowToolSelectionAuthority,
  AssistantWorkflowToolSelectionAuthorityReason,
  AssistantWorkflowToolSelectionAuthoritySource,
  AssistantWorkflowToolSelectionDecision,
} from "./tool-selection-policy.js";

export const ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION = 1;

export type AssistantWorkflowSerializedToolSelectionDecision = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION;
  authority: AssistantWorkflowToolSelectionAuthority;
  effectiveToolNames: string[];
  effectiveReason: string | null;
  comparisonPayload: Record<string, AssistantWorkflowJsonValue> | null;
};

export type AssistantWorkflowSerializedToolSelectionDecisionLineErrorReason =
  | "invalid_json"
  | "invalid_tool_selection";

export type AssistantWorkflowSerializedToolSelectionDecisionLineError = {
  lineNumber: number;
  reason: AssistantWorkflowSerializedToolSelectionDecisionLineErrorReason;
  preview: string;
};

export type AssistantWorkflowSerializedToolSelectionDecisionLinesParseResult = {
  lineCount: number;
  decisionCount: number;
  errorCount: number;
  decisions: AssistantWorkflowSerializedToolSelectionDecision[];
  errors: AssistantWorkflowSerializedToolSelectionDecisionLineError[];
};

export type AssistantWorkflowSerializedToolSelectionDecisionLinesOptions = {
  trailingNewline?: boolean;
};

export type AssistantWorkflowSerializedToolSelectionDecisionBatchOptions = {
  generatedAt?: string;
  onlyInteresting?: boolean;
};

export type AssistantWorkflowSerializedToolSelectionDecisionBatchCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowSerializedToolSelectionDecisionBatchSummary = {
  generatedAt: string;
  sourceDecisionCount: number;
  decisionCount: number;
  interestingDecisionCount: number;
  workflowAuthorityCount: number;
  legacyAuthorityCount: number;
  authoritySourceCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  authorityReasonCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  workflowStatusCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  effectiveReasonCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  optionalToolModeCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  workflowSelectionProfileCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  workflowSelectionProfileToolCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  effectiveToolCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  workflowSuggestedToolCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
  workflowSelectionCandidateToolCounts: AssistantWorkflowSerializedToolSelectionDecisionBatchCount[];
};

export type AssistantWorkflowSerializedToolSelectionDecisionBatch = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION;
  generatedAt: string;
  sourceDecisionCount: number;
  decisionCount: number;
  summary: AssistantWorkflowSerializedToolSelectionDecisionBatchSummary;
  decisions: AssistantWorkflowSerializedToolSelectionDecision[];
};

export function serializeAssistantWorkflowToolSelectionDecision(
  decision: AssistantWorkflowToolSelectionDecision,
): AssistantWorkflowSerializedToolSelectionDecision {
  return {
    schemaVersion: ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION,
    authority: {
      source: decision.authority.source,
      reason: decision.authority.reason,
      selectedToolNames: [...decision.authority.selectedToolNames],
      workflowSuggestedToolNames: [...decision.authority.workflowSuggestedToolNames],
      workflowStatus: decision.authority.workflowStatus,
    },
    effectiveToolNames: [...decision.effectiveToolNames],
    effectiveReason: decision.effectiveReason,
    comparisonPayload: decision.comparisonPayload === null ? null : toJsonRecord(decision.comparisonPayload),
  };
}

export function stringifyAssistantWorkflowToolSelectionDecision(
  decision: AssistantWorkflowToolSelectionDecision,
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowToolSelectionDecision(decision), null, space);
}

export function stringifyAssistantWorkflowToolSelectionDecisionLines(
  decisions: readonly AssistantWorkflowToolSelectionDecision[],
  options: AssistantWorkflowSerializedToolSelectionDecisionLinesOptions = {},
): string {
  return stringifyAssistantWorkflowSerializedToolSelectionDecisionLines(
    decisions.map(serializeAssistantWorkflowToolSelectionDecision),
    options,
  );
}

export function stringifyAssistantWorkflowSerializedToolSelectionDecisionLines(
  decisions: readonly AssistantWorkflowSerializedToolSelectionDecision[],
  options: AssistantWorkflowSerializedToolSelectionDecisionLinesOptions = {},
): string {
  const lines = decisions.map((decision) => JSON.stringify(decision));
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function serializeAssistantWorkflowToolSelectionDecisions(
  decisions: readonly AssistantWorkflowToolSelectionDecision[],
  options: AssistantWorkflowSerializedToolSelectionDecisionBatchOptions = {},
): AssistantWorkflowSerializedToolSelectionDecisionBatch {
  const allDecisions = decisions.map(serializeAssistantWorkflowToolSelectionDecision);
  return buildAssistantWorkflowSerializedToolSelectionDecisionBatch(allDecisions, options);
}

export function buildAssistantWorkflowSerializedToolSelectionDecisionBatch(
  allDecisions: readonly AssistantWorkflowSerializedToolSelectionDecision[],
  options: AssistantWorkflowSerializedToolSelectionDecisionBatchOptions = {},
): AssistantWorkflowSerializedToolSelectionDecisionBatch {
  const decisions = options.onlyInteresting === true
    ? allDecisions.filter(isInterestingDecision)
    : [...allDecisions];
  const generatedAt = normalizeGeneratedAt(options.generatedAt) ?? new Date().toISOString();
  const summary = buildSerializedDecisionBatchSummary(allDecisions, decisions, generatedAt);

  return {
    schemaVersion: ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION,
    generatedAt,
    sourceDecisionCount: allDecisions.length,
    decisionCount: decisions.length,
    summary,
    decisions,
  };
}

export function stringifyAssistantWorkflowToolSelectionDecisions(
  decisions: readonly AssistantWorkflowToolSelectionDecision[],
  options: AssistantWorkflowSerializedToolSelectionDecisionBatchOptions = {},
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowToolSelectionDecisions(decisions, options), null, space);
}

export function parseAssistantWorkflowSerializedToolSelectionDecision(
  value: unknown,
): AssistantWorkflowSerializedToolSelectionDecision | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION) return null;
  const authority = parseToolSelectionAuthority(value["authority"]);
  if (!authority) return null;
  if (!isStringArray(value["effectiveToolNames"])) return null;
  if (value["effectiveReason"] !== null && typeof value["effectiveReason"] !== "string") return null;
  if (value["comparisonPayload"] !== null && !isJsonRecord(value["comparisonPayload"])) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION,
    authority,
    effectiveToolNames: value["effectiveToolNames"],
    effectiveReason: value["effectiveReason"],
    comparisonPayload: value["comparisonPayload"],
  };
}

export function parseAssistantWorkflowSerializedToolSelectionDecisionLines(
  input: string,
): AssistantWorkflowSerializedToolSelectionDecisionLinesParseResult {
  const decisions: AssistantWorkflowSerializedToolSelectionDecision[] = [];
  const errors: AssistantWorkflowSerializedToolSelectionDecisionLineError[] = [];
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

    const decision = parseAssistantWorkflowSerializedToolSelectionDecision(parsed);
    if (!decision) {
      errors.push({
        lineNumber,
        reason: "invalid_tool_selection",
        preview: previewLine(trimmed),
      });
      continue;
    }
    decisions.push(decision);
  }

  return {
    lineCount,
    decisionCount: decisions.length,
    errorCount: errors.length,
    decisions,
    errors,
  };
}

export function parseAssistantWorkflowSerializedToolSelectionDecisionBatch(
  value: unknown,
): AssistantWorkflowSerializedToolSelectionDecisionBatch | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (!isNonNegativeFiniteNumber(value["sourceDecisionCount"])) return null;
  if (!isNonNegativeFiniteNumber(value["decisionCount"])) return null;
  if (!isDecisionBatchSummary(value["summary"])) return null;
  if (!Array.isArray(value["decisions"])) return null;

  const decisions = value["decisions"].map(parseAssistantWorkflowSerializedToolSelectionDecision);
  if (decisions.some((decision) => decision === null)) return null;
  if (decisions.length !== value["decisionCount"]) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_TOOL_SELECTION_JSON_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    sourceDecisionCount: value["sourceDecisionCount"],
    decisionCount: value["decisionCount"],
    summary: value["summary"],
    decisions: decisions.filter((decision): decision is AssistantWorkflowSerializedToolSelectionDecision => decision !== null),
  };
}

function buildSerializedDecisionBatchSummary(
  allDecisions: readonly AssistantWorkflowSerializedToolSelectionDecision[],
  decisions: readonly AssistantWorkflowSerializedToolSelectionDecision[],
  generatedAt: string,
): AssistantWorkflowSerializedToolSelectionDecisionBatchSummary {
  return {
    generatedAt,
    sourceDecisionCount: allDecisions.length,
    decisionCount: decisions.length,
    interestingDecisionCount: decisions.filter(isInterestingDecision).length,
    workflowAuthorityCount: decisions.filter((decision) => decision.authority.source === "workflow").length,
    legacyAuthorityCount: decisions.filter((decision) => decision.authority.source === "legacy-pruner").length,
    authoritySourceCounts: buildStringCounts(decisions.map((decision) => decision.authority.source)),
    authorityReasonCounts: buildStringCounts(decisions.map((decision) => decision.authority.reason)),
    workflowStatusCounts: buildStringCounts(decisions.map((decision) => decision.authority.workflowStatus ?? "none")),
    effectiveReasonCounts: buildStringCounts(decisions.map((decision) => decision.effectiveReason ?? "none")),
    optionalToolModeCounts: buildStringCounts(decisions.map((decision) =>
      readJsonString(decision.comparisonPayload?.["workflowSelectionOptionalToolMode"]) ?? "none"
    )),
    workflowSelectionProfileCounts: buildStringCounts(decisions.flatMap((decision) =>
      readJsonStringArray(decision.comparisonPayload?.["workflowSelectionActiveProfileIds"])
    )),
    workflowSelectionProfileToolCounts: buildStringCounts(decisions.flatMap((decision) =>
      readJsonStringArray(decision.comparisonPayload?.["workflowSelectionProfileTools"])
    )),
    effectiveToolCounts: buildStringCounts(decisions.flatMap((decision) => decision.effectiveToolNames)),
    workflowSuggestedToolCounts: buildStringCounts(decisions.flatMap((decision) =>
      decision.authority.workflowSuggestedToolNames
    )),
    workflowSelectionCandidateToolCounts: buildStringCounts(decisions.flatMap((decision) =>
      readJsonStringArray(decision.comparisonPayload?.["workflowSelectionCandidateTools"])
    )),
  };
}

function isInterestingDecision(decision: AssistantWorkflowSerializedToolSelectionDecision): boolean {
  return decision.authority.source !== "workflow";
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowSerializedToolSelectionDecisionBatchCount[] {
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

function isDecisionBatchSummary(value: unknown): value is AssistantWorkflowSerializedToolSelectionDecisionBatchSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value["generatedAt"] === "string" &&
    isNonNegativeFiniteNumber(value["sourceDecisionCount"]) &&
    isNonNegativeFiniteNumber(value["decisionCount"]) &&
    isNonNegativeFiniteNumber(value["interestingDecisionCount"]) &&
    isNonNegativeFiniteNumber(value["workflowAuthorityCount"]) &&
    isNonNegativeFiniteNumber(value["legacyAuthorityCount"]) &&
    isCountArray(value["authoritySourceCounts"]) &&
    isCountArray(value["authorityReasonCounts"]) &&
    isCountArray(value["workflowStatusCounts"]) &&
    isCountArray(value["effectiveReasonCounts"]) &&
    isCountArray(value["optionalToolModeCounts"]) &&
    isCountArray(value["workflowSelectionProfileCounts"]) &&
    isCountArray(value["workflowSelectionProfileToolCounts"]) &&
    isCountArray(value["effectiveToolCounts"]) &&
    isCountArray(value["workflowSuggestedToolCounts"]) &&
    isCountArray(value["workflowSelectionCandidateToolCounts"])
  );
}

function isCountArray(value: unknown): value is AssistantWorkflowSerializedToolSelectionDecisionBatchCount[] {
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

function parseToolSelectionAuthority(value: unknown): AssistantWorkflowToolSelectionAuthority | null {
  if (!isRecord(value)) return null;
  if (!isAuthoritySource(value["source"])) return null;
  if (!isAuthorityReason(value["reason"])) return null;
  if (!isStringArray(value["selectedToolNames"])) return null;
  if (!isStringArray(value["workflowSuggestedToolNames"])) return null;
  if (value["workflowStatus"] !== null && typeof value["workflowStatus"] !== "string") return null;

  return {
    source: value["source"],
    reason: value["reason"],
    selectedToolNames: value["selectedToolNames"],
    workflowSuggestedToolNames: value["workflowSuggestedToolNames"],
    workflowStatus: value["workflowStatus"],
  };
}

function isAuthoritySource(value: unknown): value is AssistantWorkflowToolSelectionAuthoritySource {
  return value === "workflow" || value === "legacy-pruner";
}

function isAuthorityReason(value: unknown): value is AssistantWorkflowToolSelectionAuthorityReason {
  return (
    value === "workflow_equivalent" ||
    value === "workflow_authority_enabled" ||
    value === "workflow_unavailable" ||
    value === "workflow_authority_not_enabled" ||
    value === "workflow_blocked" ||
    value === "workflow_selection_not_exercised" ||
    value === "workflow_differs"
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function previewLine(line: string): string {
  return line.length <= 160 ? line : `${line.slice(0, 157)}...`;
}

function readJsonString(value: AssistantWorkflowJsonValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function readJsonStringArray(value: AssistantWorkflowJsonValue | undefined): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function toJsonRecord(value: unknown): Record<string, AssistantWorkflowJsonValue> {
  if (!isJsonRecord(value)) {
    throw new Error("Assistant workflow tool-selection payload must be a JSON object.");
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
