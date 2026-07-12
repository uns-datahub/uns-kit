import {
  buildAssistantWorkflowDefinitionPackageTracePayload,
  type AssistantWorkflowDefinitionPackage,
} from "./definition-package.js";
import {
  buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload,
  type AssistantWorkflowDefinitionPackageSmokeSuiteResult,
} from "./definition-package-smoke.js";
import {
  parseAssistantWorkflowSerializedDefinition,
  serializeAssistantWorkflowDefinition,
  type AssistantWorkflowSerializedDefinition,
} from "./definition-json.js";
import {
  parseAssistantWorkflowSerializedDefinitionTuningSuggestion,
  type AssistantWorkflowSerializedDefinitionTuningSuggestion,
} from "./definition-tuning-json.js";
import {
  buildAssistantWorkflowDefinitionTuningApplyTracePayload,
  type AssistantWorkflowDefinitionTuningApplySkipReason,
  type AssistantWorkflowDefinitionTuningApplySkippedSuggestion,
  type AssistantWorkflowDefinitionTuningApplyResult,
} from "./definition-tuning.js";
import {
  buildAssistantWorkflowDefinitionTuningReplayLinesTracePayload,
  type AssistantWorkflowDefinitionTuningReplayLinesResult,
} from "./definition-tuning-replay.js";
import {
  buildAssistantWorkflowDefinitionTuningReviewTracePayload,
  type AssistantWorkflowDefinitionTuningReview,
} from "./definition-tuning-review.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_TUNING_REVIEW_ARTIFACT_SCHEMA_VERSION = 1;

export type AssistantWorkflowDefinitionTuningReviewArtifact = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_TUNING_REVIEW_ARTIFACT_SCHEMA_VERSION;
  generatedAt: string;
  workflowId: string;
  workflowVersion: number;
  reviewContext: Record<string, AssistantWorkflowJsonValue>;
  suggestions: {
    summary: AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary;
    applied: AssistantWorkflowSerializedDefinitionTuningSuggestion[];
    skipped: AssistantWorkflowDefinitionTuningReviewArtifactSkippedSuggestion[];
    reviewOnly: AssistantWorkflowSerializedDefinitionTuningSuggestion[];
  };
  replay: Record<string, AssistantWorkflowJsonValue>;
  apply: Record<string, AssistantWorkflowJsonValue>;
  patchedDefinition: AssistantWorkflowSerializedDefinition;
  patchedPackage: Record<string, AssistantWorkflowJsonValue>;
  smoke: Record<string, AssistantWorkflowJsonValue> | null;
  review: Record<string, AssistantWorkflowJsonValue>;
};

export type AssistantWorkflowDefinitionTuningReviewArtifactInput = {
  replay: AssistantWorkflowDefinitionTuningReplayLinesResult;
  applyResult: AssistantWorkflowDefinitionTuningApplyResult;
  definitionPackage: AssistantWorkflowDefinitionPackage;
  smoke?: AssistantWorkflowDefinitionPackageSmokeSuiteResult | null;
  review: AssistantWorkflowDefinitionTuningReview;
  reviewContext?: Record<string, AssistantWorkflowJsonValue>;
  generatedAt?: string;
};

export type AssistantWorkflowDefinitionTuningReviewArtifactSkippedSuggestion =
  AssistantWorkflowDefinitionTuningApplySkippedSuggestion & {
    suggestion: AssistantWorkflowSerializedDefinitionTuningSuggestion | null;
  };

export type AssistantWorkflowDefinitionTuningReviewArtifactCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary = {
  appliedCount: number;
  skippedCount: number;
  reviewOnlyCount: number;
  skipReasonCounts: AssistantWorkflowDefinitionTuningReviewArtifactCount[];
  reviewOnlyActionCounts: AssistantWorkflowDefinitionTuningReviewArtifactCount[];
  reviewOnlySignalCounts: AssistantWorkflowDefinitionTuningReviewArtifactCount[];
};

const APPLY_SKIP_REASONS = new Set<AssistantWorkflowDefinitionTuningApplySkipReason>([
  "not_selected",
  "unsupported_patch",
  "missing_intent",
  "missing_direct_route",
  "tool_hint_exists",
  "direct_route_strategy_exists",
  "intent_apply_limit",
]);

export function buildAssistantWorkflowDefinitionTuningReviewArtifact(
  input: AssistantWorkflowDefinitionTuningReviewArtifactInput,
): AssistantWorkflowDefinitionTuningReviewArtifact {
  const generatedAt = normalizeGeneratedAt(input.generatedAt) ?? new Date().toISOString();
  const applied = buildAppliedSuggestions(input);
  const skipped = buildSkippedSuggestions(input);
  const reviewOnly = buildReviewOnlySuggestions(input);

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_REVIEW_ARTIFACT_SCHEMA_VERSION,
    generatedAt,
    workflowId: input.applyResult.definition.id,
    workflowVersion: input.applyResult.definition.version,
    reviewContext: cloneJsonRecord(input.reviewContext ?? {}),
    suggestions: {
      summary: buildSuggestionSummary(applied, skipped, reviewOnly),
      applied,
      skipped,
      reviewOnly,
    },
    replay: buildAssistantWorkflowDefinitionTuningReplayLinesTracePayload(input.replay),
    apply: buildAssistantWorkflowDefinitionTuningApplyTracePayload(input.applyResult),
    patchedDefinition: serializeAssistantWorkflowDefinition(input.applyResult.definition),
    patchedPackage: cloneJsonRecord(
      buildAssistantWorkflowDefinitionPackageTracePayload(input.definitionPackage),
    ),
    smoke: input.smoke
      ? cloneJsonRecord(buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload(input.smoke))
      : null,
    review: buildAssistantWorkflowDefinitionTuningReviewTracePayload(input.review),
  };
}

function buildSuggestionSummary(
  applied: readonly AssistantWorkflowSerializedDefinitionTuningSuggestion[],
  skipped: readonly AssistantWorkflowDefinitionTuningReviewArtifactSkippedSuggestion[],
  reviewOnly: readonly AssistantWorkflowSerializedDefinitionTuningSuggestion[],
): AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary {
  return {
    appliedCount: applied.length,
    skippedCount: skipped.length,
    reviewOnlyCount: reviewOnly.length,
    skipReasonCounts: countStrings(skipped.map((suggestion) => suggestion.reason)),
    reviewOnlyActionCounts: countStrings(reviewOnly.map((suggestion) => suggestion.action)),
    reviewOnlySignalCounts: countStrings(reviewOnly.map((suggestion) => suggestion.signal ?? "none")),
  };
}

export function stringifyAssistantWorkflowDefinitionTuningReviewArtifact(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  space?: number,
): string {
  return JSON.stringify(artifact, null, space);
}

export function parseAssistantWorkflowDefinitionTuningReviewArtifact(
  value: unknown,
): AssistantWorkflowDefinitionTuningReviewArtifact | null {
  if (!isJsonRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_TUNING_REVIEW_ARTIFACT_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (typeof value["workflowId"] !== "string" || !value["workflowId"].trim().length) return null;
  if (typeof value["workflowVersion"] !== "number" || !Number.isFinite(value["workflowVersion"])) return null;
  if (!isJsonRecord(value["reviewContext"])) return null;
  const suggestions = parseArtifactSuggestions(value["suggestions"]);
  if (!suggestions) return null;
  if (!isJsonRecord(value["replay"])) return null;
  if (!isJsonRecord(value["apply"])) return null;
  const patchedDefinition = parseAssistantWorkflowSerializedDefinition(value["patchedDefinition"]);
  if (!patchedDefinition) return null;
  if (!isJsonRecord(value["patchedPackage"])) return null;
  if (value["smoke"] !== null && !isJsonRecord(value["smoke"])) return null;
  if (!isJsonRecord(value["review"])) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_REVIEW_ARTIFACT_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    workflowId: value["workflowId"],
    workflowVersion: value["workflowVersion"],
    reviewContext: value["reviewContext"],
    suggestions,
    replay: value["replay"],
    apply: value["apply"],
    patchedDefinition,
    patchedPackage: value["patchedPackage"],
    smoke: value["smoke"],
    review: value["review"],
  };
}

function buildAppliedSuggestions(
  input: AssistantWorkflowDefinitionTuningReviewArtifactInput,
): AssistantWorkflowSerializedDefinitionTuningSuggestion[] {
  const appliedIds = new Set(input.applyResult.appliedSuggestionIds);
  return input.replay.batch.suggestions
    .filter((suggestion) => appliedIds.has(suggestion.id))
    .map((suggestion) => ({ ...suggestion, requestIds: [...suggestion.requestIds], sourceSuggestionIds: [...suggestion.sourceSuggestionIds] }));
}

function buildSkippedSuggestions(
  input: AssistantWorkflowDefinitionTuningReviewArtifactInput,
): AssistantWorkflowDefinitionTuningReviewArtifactSkippedSuggestion[] {
  const suggestionsById = new Map(input.replay.batch.suggestions.map((suggestion) => [suggestion.id, suggestion]));
  return input.applyResult.skippedSuggestions.map((skipped) => {
    const suggestion = suggestionsById.get(skipped.id) ?? null;
    return {
      id: skipped.id,
      reason: skipped.reason,
      suggestion: suggestion
        ? {
            ...suggestion,
            requestIds: [...suggestion.requestIds],
            sourceSuggestionIds: [...suggestion.sourceSuggestionIds],
          }
        : null,
    };
  });
}

function buildReviewOnlySuggestions(
  input: AssistantWorkflowDefinitionTuningReviewArtifactInput,
): AssistantWorkflowSerializedDefinitionTuningSuggestion[] {
  return input.replay.batch.suggestions
    .filter((suggestion) => suggestion.patchPreview.kind === "none")
    .map((suggestion) => ({
      ...suggestion,
      requestIds: [...suggestion.requestIds],
      sourceSuggestionIds: [...suggestion.sourceSuggestionIds],
    }));
}

function parseArtifactSuggestions(
  value: unknown,
): AssistantWorkflowDefinitionTuningReviewArtifact["suggestions"] | null {
  if (value === undefined) {
    return {
      summary: buildSuggestionSummary([], [], []),
      applied: [],
      skipped: [],
      reviewOnly: [],
    };
  }
  if (!isJsonRecord(value)) return null;
  const applied = value["applied"];
  if (!Array.isArray(applied)) return null;
  const parsed = applied.map(parseAssistantWorkflowSerializedDefinitionTuningSuggestion);
  if (parsed.some((suggestion) => suggestion === null)) return null;
  const skipped = parseSkippedSuggestions(value["skipped"]);
  if (!skipped) return null;
  const reviewOnly = parseSerializedSuggestions(value["reviewOnly"]);
  if (!reviewOnly) return null;
  const summary = parseSuggestionSummary(value["summary"]) ??
    buildSuggestionSummary(
      parsed.filter((suggestion): suggestion is AssistantWorkflowSerializedDefinitionTuningSuggestion => suggestion !== null),
      skipped,
      reviewOnly,
    );
  return {
    summary,
    applied: parsed.filter((suggestion): suggestion is AssistantWorkflowSerializedDefinitionTuningSuggestion => suggestion !== null).map((suggestion) => ({
      ...suggestion,
      requestIds: [...suggestion.requestIds],
      sourceSuggestionIds: [...suggestion.sourceSuggestionIds],
    })),
    skipped,
    reviewOnly,
  };
}

function parseSuggestionSummary(
  value: unknown,
): AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary | null {
  if (value === undefined) return null;
  if (!isJsonRecord(value)) return null;
  if (!isNonNegativeFiniteNumber(value["appliedCount"])) return null;
  if (!isNonNegativeFiniteNumber(value["skippedCount"])) return null;
  if (!isNonNegativeFiniteNumber(value["reviewOnlyCount"])) return null;
  const skipReasonCounts = parseCounts(value["skipReasonCounts"]);
  const reviewOnlyActionCounts = parseCounts(value["reviewOnlyActionCounts"]);
  const reviewOnlySignalCounts = parseCounts(value["reviewOnlySignalCounts"]);
  if (!skipReasonCounts || !reviewOnlyActionCounts || !reviewOnlySignalCounts) return null;
  return {
    appliedCount: value["appliedCount"],
    skippedCount: value["skippedCount"],
    reviewOnlyCount: value["reviewOnlyCount"],
    skipReasonCounts,
    reviewOnlyActionCounts,
    reviewOnlySignalCounts,
  };
}

function parseSkippedSuggestions(
  value: unknown,
): AssistantWorkflowDefinitionTuningReviewArtifactSkippedSuggestion[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const skipped: AssistantWorkflowDefinitionTuningReviewArtifactSkippedSuggestion[] = [];
  for (const item of value) {
    if (!isJsonRecord(item)) return null;
    if (typeof item["id"] !== "string" || !item["id"].trim().length) return null;
    if (!isApplySkipReason(item["reason"])) return null;
    const suggestion = item["suggestion"] === null
      ? null
      : parseAssistantWorkflowSerializedDefinitionTuningSuggestion(item["suggestion"]);
    if (item["suggestion"] !== null && !suggestion) return null;
    skipped.push({
      id: item["id"],
      reason: item["reason"],
      suggestion: suggestion
        ? {
            ...suggestion,
            requestIds: [...suggestion.requestIds],
            sourceSuggestionIds: [...suggestion.sourceSuggestionIds],
          }
        : null,
    });
  }
  return skipped;
}

function isApplySkipReason(value: unknown): value is AssistantWorkflowDefinitionTuningApplySkipReason {
  return typeof value === "string" && APPLY_SKIP_REASONS.has(value as AssistantWorkflowDefinitionTuningApplySkipReason);
}

function parseSerializedSuggestions(
  value: unknown,
): AssistantWorkflowSerializedDefinitionTuningSuggestion[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const parsed = value.map(parseAssistantWorkflowSerializedDefinitionTuningSuggestion);
  if (parsed.some((suggestion) => suggestion === null)) return null;
  return parsed
    .filter((suggestion): suggestion is AssistantWorkflowSerializedDefinitionTuningSuggestion => suggestion !== null)
    .map((suggestion) => ({
      ...suggestion,
      requestIds: [...suggestion.requestIds],
      sourceSuggestionIds: [...suggestion.sourceSuggestionIds],
    }));
}

function parseCounts(value: unknown): AssistantWorkflowDefinitionTuningReviewArtifactCount[] | null {
  if (!Array.isArray(value)) return null;
  const counts: AssistantWorkflowDefinitionTuningReviewArtifactCount[] = [];
  for (const item of value) {
    if (!isJsonRecord(item)) return null;
    if (typeof item["key"] !== "string" || !item["key"].trim().length) return null;
    if (!isNonNegativeFiniteNumber(item["count"])) return null;
    counts.push({
      key: item["key"],
      count: item["count"],
    });
  }
  return counts;
}

function countStrings(values: readonly string[]): AssistantWorkflowDefinitionTuningReviewArtifactCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeGeneratedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function cloneJsonRecord(
  value: Record<string, unknown>,
): Record<string, AssistantWorkflowJsonValue> {
  const cloned = JSON.parse(JSON.stringify(value)) as unknown;
  return isJsonRecord(cloned) ? cloned : {};
}

function isJsonRecord(value: unknown): value is Record<string, AssistantWorkflowJsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AssistantWorkflowJsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonRecord(value);
}
