import type {
  AssistantWorkflowDefinitionTuningAction,
  AssistantWorkflowDefinitionTuningPatchPreview,
  AssistantWorkflowDefinitionTuningSuggestion,
} from "./definition-tuning.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION = 1;

export type AssistantWorkflowSerializedDefinitionTuningSuggestion =
  AssistantWorkflowDefinitionTuningSuggestion & {
    schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION;
  };

export type AssistantWorkflowSerializedDefinitionTuningSuggestionLineErrorReason =
  | "invalid_json"
  | "invalid_definition_tuning_suggestion";

export type AssistantWorkflowSerializedDefinitionTuningSuggestionLineError = {
  lineNumber: number;
  reason: AssistantWorkflowSerializedDefinitionTuningSuggestionLineErrorReason;
  preview: string;
};

export type AssistantWorkflowSerializedDefinitionTuningSuggestionLinesParseResult = {
  lineCount: number;
  suggestionCount: number;
  errorCount: number;
  suggestions: AssistantWorkflowSerializedDefinitionTuningSuggestion[];
  errors: AssistantWorkflowSerializedDefinitionTuningSuggestionLineError[];
};

export type AssistantWorkflowSerializedDefinitionTuningSuggestionLinesOptions = {
  trailingNewline?: boolean;
};

export type AssistantWorkflowSerializedDefinitionTuningBatchOptions = {
  generatedAt?: string;
  onlyApplicable?: boolean;
};

export type AssistantWorkflowSerializedDefinitionTuningBatchCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowSerializedDefinitionTuningBatchSummary = {
  generatedAt: string;
  sourceSuggestionCount: number;
  suggestionCount: number;
  applicableSuggestionCount: number;
  reviewOnlySuggestionCount: number;
  warningCount: number;
  actionCounts: AssistantWorkflowSerializedDefinitionTuningBatchCount[];
  severityCounts: AssistantWorkflowSerializedDefinitionTuningBatchCount[];
  patchKindCounts: AssistantWorkflowSerializedDefinitionTuningBatchCount[];
  intentCounts: AssistantWorkflowSerializedDefinitionTuningBatchCount[];
  toolCounts: AssistantWorkflowSerializedDefinitionTuningBatchCount[];
};

export type AssistantWorkflowSerializedDefinitionTuningBatch = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION;
  generatedAt: string;
  sourceSuggestionCount: number;
  suggestionCount: number;
  summary: AssistantWorkflowSerializedDefinitionTuningBatchSummary;
  suggestions: AssistantWorkflowSerializedDefinitionTuningSuggestion[];
};

const ACTIONS = new Set<AssistantWorkflowDefinitionTuningAction>([
  "add_intent_tool_hint",
  "add_direct_route_strategy",
  "register_tool_capability",
  "review_tool_selection_policy",
  "review_clarification_rule",
  "review_direct_route_strategy",
  "debug_runtime_error",
  "promote_eval_case",
  "review_quality_signal",
]);

export function serializeAssistantWorkflowDefinitionTuningSuggestion(
  suggestion: AssistantWorkflowDefinitionTuningSuggestion,
): AssistantWorkflowSerializedDefinitionTuningSuggestion {
  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION,
    id: suggestion.id,
    action: suggestion.action,
    severity: suggestion.severity,
    intentId: suggestion.intentId,
    toolName: suggestion.toolName,
    signal: suggestion.signal,
    count: suggestion.count,
    requestIds: [...suggestion.requestIds],
    sourceSuggestionIds: [...suggestion.sourceSuggestionIds],
    rationale: suggestion.rationale,
    suggestedAction: suggestion.suggestedAction,
    patchPreview: clonePatchPreview(suggestion.patchPreview),
  };
}

export function stringifyAssistantWorkflowDefinitionTuningSuggestionLines(
  suggestions: readonly AssistantWorkflowDefinitionTuningSuggestion[],
  options: AssistantWorkflowSerializedDefinitionTuningSuggestionLinesOptions = {},
): string {
  return stringifyAssistantWorkflowSerializedDefinitionTuningSuggestionLines(
    suggestions.map(serializeAssistantWorkflowDefinitionTuningSuggestion),
    options,
  );
}

export function stringifyAssistantWorkflowSerializedDefinitionTuningSuggestionLines(
  suggestions: readonly AssistantWorkflowSerializedDefinitionTuningSuggestion[],
  options: AssistantWorkflowSerializedDefinitionTuningSuggestionLinesOptions = {},
): string {
  const lines = suggestions.map((suggestion) => JSON.stringify(suggestion));
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function buildAssistantWorkflowSerializedDefinitionTuningBatch(
  allSuggestions: readonly AssistantWorkflowSerializedDefinitionTuningSuggestion[],
  options: AssistantWorkflowSerializedDefinitionTuningBatchOptions = {},
): AssistantWorkflowSerializedDefinitionTuningBatch {
  const suggestions = options.onlyApplicable === true
    ? allSuggestions.filter(isApplicableSuggestion)
    : [...allSuggestions];
  const generatedAt = normalizeGeneratedAt(options.generatedAt) ?? new Date().toISOString();
  const summary = buildBatchSummary(allSuggestions, suggestions, generatedAt);

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION,
    generatedAt,
    sourceSuggestionCount: allSuggestions.length,
    suggestionCount: suggestions.length,
    summary,
    suggestions,
  };
}

export function parseAssistantWorkflowSerializedDefinitionTuningSuggestion(
  value: unknown,
): AssistantWorkflowSerializedDefinitionTuningSuggestion | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION) return null;
  if (typeof value["id"] !== "string" || !value["id"].trim().length) return null;
  if (!isAction(value["action"])) return null;
  if (value["severity"] !== "info" && value["severity"] !== "warning") return null;
  if (!isNullableString(value["intentId"])) return null;
  if (!isNullableString(value["toolName"])) return null;
  if (!isNullableString(value["signal"])) return null;
  if (!isNonNegativeFiniteNumber(value["count"])) return null;
  if (!isStringArray(value["requestIds"])) return null;
  if (!isStringArray(value["sourceSuggestionIds"])) return null;
  if (typeof value["rationale"] !== "string") return null;
  if (typeof value["suggestedAction"] !== "string") return null;
  const patchPreview = parsePatchPreview(value["patchPreview"]);
  if (!patchPreview) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION,
    id: value["id"],
    action: value["action"],
    severity: value["severity"],
    intentId: value["intentId"],
    toolName: value["toolName"],
    signal: value["signal"],
    count: value["count"],
    requestIds: value["requestIds"],
    sourceSuggestionIds: value["sourceSuggestionIds"],
    rationale: value["rationale"],
    suggestedAction: value["suggestedAction"],
    patchPreview,
  };
}

export function parseAssistantWorkflowSerializedDefinitionTuningSuggestionLines(
  input: string,
): AssistantWorkflowSerializedDefinitionTuningSuggestionLinesParseResult {
  const suggestions: AssistantWorkflowSerializedDefinitionTuningSuggestion[] = [];
  const errors: AssistantWorkflowSerializedDefinitionTuningSuggestionLineError[] = [];
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
      errors.push({ lineNumber, reason: "invalid_json", preview: previewLine(trimmed) });
      continue;
    }

    const suggestion = parseAssistantWorkflowSerializedDefinitionTuningSuggestion(parsed);
    if (!suggestion) {
      errors.push({
        lineNumber,
        reason: "invalid_definition_tuning_suggestion",
        preview: previewLine(trimmed),
      });
      continue;
    }
    suggestions.push(suggestion);
  }

  return {
    lineCount,
    suggestionCount: suggestions.length,
    errorCount: errors.length,
    suggestions,
    errors,
  };
}

export function parseAssistantWorkflowSerializedDefinitionTuningBatch(
  value: unknown,
): AssistantWorkflowSerializedDefinitionTuningBatch | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (!isNonNegativeFiniteNumber(value["sourceSuggestionCount"])) return null;
  if (!isNonNegativeFiniteNumber(value["suggestionCount"])) return null;
  if (!isBatchSummary(value["summary"])) return null;
  if (!Array.isArray(value["suggestions"])) return null;

  const suggestions = value["suggestions"].map(parseAssistantWorkflowSerializedDefinitionTuningSuggestion);
  if (suggestions.some((suggestion) => suggestion === null)) return null;
  if (suggestions.length !== value["suggestionCount"]) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_JSON_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    sourceSuggestionCount: value["sourceSuggestionCount"],
    suggestionCount: value["suggestionCount"],
    summary: value["summary"],
    suggestions: suggestions.filter((suggestion): suggestion is AssistantWorkflowSerializedDefinitionTuningSuggestion =>
      suggestion !== null
    ),
  };
}

function buildBatchSummary(
  allSuggestions: readonly AssistantWorkflowSerializedDefinitionTuningSuggestion[],
  suggestions: readonly AssistantWorkflowSerializedDefinitionTuningSuggestion[],
  generatedAt: string,
): AssistantWorkflowSerializedDefinitionTuningBatchSummary {
  return {
    generatedAt,
    sourceSuggestionCount: allSuggestions.length,
    suggestionCount: suggestions.length,
    applicableSuggestionCount: suggestions.filter(isApplicableSuggestion).length,
    reviewOnlySuggestionCount: suggestions.filter((suggestion) => suggestion.patchPreview.kind === "none").length,
    warningCount: suggestions.filter((suggestion) => suggestion.severity === "warning").length,
    actionCounts: buildStringCounts(suggestions.map((suggestion) => suggestion.action)),
    severityCounts: buildStringCounts(suggestions.map((suggestion) => suggestion.severity)),
    patchKindCounts: buildStringCounts(suggestions.map((suggestion) => suggestion.patchPreview.kind)),
    intentCounts: buildStringCounts(suggestions.map((suggestion) => suggestion.intentId ?? "none")),
    toolCounts: buildStringCounts(suggestions.map((suggestion) => suggestion.toolName ?? "none")),
  };
}

function isApplicableSuggestion(suggestion: AssistantWorkflowSerializedDefinitionTuningSuggestion): boolean {
  return suggestion.patchPreview.kind !== "none";
}

function clonePatchPreview(
  patchPreview: AssistantWorkflowDefinitionTuningPatchPreview,
): AssistantWorkflowDefinitionTuningPatchPreview {
  return { ...patchPreview };
}

function parsePatchPreview(value: unknown): AssistantWorkflowDefinitionTuningPatchPreview | null {
  if (!isRecord(value)) return null;
  if (value["kind"] === "none") return { kind: "none" };
  if (value["kind"] === "register_tool_capability" && typeof value["toolName"] === "string") {
    return { kind: "register_tool_capability", toolName: value["toolName"] };
  }
  if (
    value["kind"] === "append_intent_tool_hint" &&
    typeof value["intentId"] === "string" &&
    typeof value["toolName"] === "string"
  ) {
    return {
      kind: "append_intent_tool_hint",
      intentId: value["intentId"],
      toolName: value["toolName"],
    };
  }
  if (
    value["kind"] === "append_direct_route_strategy" &&
    typeof value["routeId"] === "string" &&
    typeof value["strategyId"] === "string" &&
    typeof value["description"] === "string"
  ) {
    return {
      kind: "append_direct_route_strategy",
      routeId: value["routeId"],
      strategyId: value["strategyId"],
      description: value["description"],
    };
  }
  return null;
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowSerializedDefinitionTuningBatchCount[] {
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

function isBatchSummary(value: unknown): value is AssistantWorkflowSerializedDefinitionTuningBatchSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value["generatedAt"] === "string" &&
    isNonNegativeFiniteNumber(value["sourceSuggestionCount"]) &&
    isNonNegativeFiniteNumber(value["suggestionCount"]) &&
    isNonNegativeFiniteNumber(value["applicableSuggestionCount"]) &&
    isNonNegativeFiniteNumber(value["reviewOnlySuggestionCount"]) &&
    isNonNegativeFiniteNumber(value["warningCount"]) &&
    isCountArray(value["actionCounts"]) &&
    isCountArray(value["severityCounts"]) &&
    isCountArray(value["patchKindCounts"]) &&
    isCountArray(value["intentCounts"]) &&
    isCountArray(value["toolCounts"])
  );
}

function isCountArray(value: unknown): value is AssistantWorkflowSerializedDefinitionTuningBatchCount[] {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item["key"] === "string" &&
    isNonNegativeFiniteNumber(item["count"])
  );
}

function isAction(value: unknown): value is AssistantWorkflowDefinitionTuningAction {
  return typeof value === "string" && ACTIONS.has(value as AssistantWorkflowDefinitionTuningAction);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeGeneratedAt(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function previewLine(line: string): string {
  return line.length <= 120 ? line : `${line.slice(0, 117)}...`;
}
