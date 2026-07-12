import type { AssistantWorkflowDefinitionTuningReviewArtifact } from "./definition-tuning-review-artifact.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_TUNING_APPROVAL_SCHEMA_VERSION = 1;

export type AssistantWorkflowDefinitionTuningApprovalDecisionKind =
  | "pending"
  | "approved"
  | "rejected";

export type AssistantWorkflowDefinitionTuningApprovalDecision = {
  suggestionId: string;
  decision: AssistantWorkflowDefinitionTuningApprovalDecisionKind;
  note?: string;
  decidedBy?: string;
  decidedAt?: string;
};

export type AssistantWorkflowDefinitionTuningApprovalArtifact = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_TUNING_APPROVAL_SCHEMA_VERSION;
  generatedAt: string;
  workflowId: string | null;
  workflowVersion: number | null;
  sourceReviewArtifactGeneratedAt: string | null;
  decisions: AssistantWorkflowDefinitionTuningApprovalDecision[];
};

export type AssistantWorkflowDefinitionTuningApprovalArtifactOptions = {
  workflowId?: string | null;
  workflowVersion?: number | null;
  sourceReviewArtifactGeneratedAt?: string | null;
  generatedAt?: string;
};

export type AssistantWorkflowDefinitionTuningApprovalTemplateOptions =
  Omit<
    AssistantWorkflowDefinitionTuningApprovalArtifactOptions,
    "workflowId" | "workflowVersion" | "sourceReviewArtifactGeneratedAt"
  > & {
    defaultDecision?: AssistantWorkflowDefinitionTuningApprovalDecisionKind;
    decidedBy?: string;
    decidedAt?: string;
    note?: string;
  };

export function buildAssistantWorkflowDefinitionTuningApprovalArtifact(
  decisions: readonly AssistantWorkflowDefinitionTuningApprovalDecision[],
  options: AssistantWorkflowDefinitionTuningApprovalArtifactOptions = {},
): AssistantWorkflowDefinitionTuningApprovalArtifact {
  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_APPROVAL_SCHEMA_VERSION,
    generatedAt: normalizeGeneratedAt(options.generatedAt) ?? new Date().toISOString(),
    workflowId: normalizeOptionalString(options.workflowId),
    workflowVersion: normalizeOptionalNumber(options.workflowVersion),
    sourceReviewArtifactGeneratedAt: normalizeOptionalString(options.sourceReviewArtifactGeneratedAt),
    decisions: normalizeApprovalDecisions(decisions),
  };
}

export function buildAssistantWorkflowDefinitionTuningApprovalArtifactFromReview(
  reviewArtifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  decisions: readonly AssistantWorkflowDefinitionTuningApprovalDecision[],
  options: Omit<
    AssistantWorkflowDefinitionTuningApprovalArtifactOptions,
    "workflowId" | "workflowVersion" | "sourceReviewArtifactGeneratedAt"
  > = {},
): AssistantWorkflowDefinitionTuningApprovalArtifact {
  return buildAssistantWorkflowDefinitionTuningApprovalArtifact(decisions, {
    ...options,
    workflowId: reviewArtifact.workflowId,
    workflowVersion: reviewArtifact.workflowVersion,
    sourceReviewArtifactGeneratedAt: reviewArtifact.generatedAt,
  });
}

export function buildAssistantWorkflowDefinitionTuningApprovalTemplateFromReview(
  reviewArtifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  options: AssistantWorkflowDefinitionTuningApprovalTemplateOptions = {},
): AssistantWorkflowDefinitionTuningApprovalArtifact {
  const defaultDecision = isApprovalDecisionKind(options.defaultDecision)
    ? options.defaultDecision
    : "pending";
  const decidedAt = normalizeGeneratedAt(options.decidedAt);
  const decisions = reviewArtifact.suggestions.applied.map((suggestion) => {
    const reviewNote = buildSuggestionReviewNote(reviewArtifact, suggestion);

    return {
      suggestionId: suggestion.id,
      decision: defaultDecision,
      ...(options.note?.trim() ? { note: options.note.trim() } : reviewNote ? { note: reviewNote } : {}),
      ...(options.decidedBy?.trim() ? { decidedBy: options.decidedBy.trim() } : {}),
      ...(decidedAt ? { decidedAt } : {}),
    };
  });

  return buildAssistantWorkflowDefinitionTuningApprovalArtifactFromReview(
    reviewArtifact,
    decisions,
    options.generatedAt ? { generatedAt: options.generatedAt } : {},
  );
}

export function readApprovedAssistantWorkflowDefinitionTuningSuggestionIds(
  artifact: AssistantWorkflowDefinitionTuningApprovalArtifact,
): string[] {
  return artifact.decisions
    .filter((decision) => decision.decision === "approved")
    .map((decision) => decision.suggestionId);
}

export function buildAssistantWorkflowDefinitionTuningApprovalTracePayload(
  artifact: AssistantWorkflowDefinitionTuningApprovalArtifact,
): Record<string, AssistantWorkflowJsonValue> {
  const approvedSuggestionIds = readApprovedAssistantWorkflowDefinitionTuningSuggestionIds(artifact);
  const rejectedSuggestionIds = artifact.decisions
    .filter((decision) => decision.decision === "rejected")
    .map((decision) => decision.suggestionId);
  const pendingSuggestionIds = artifact.decisions
    .filter((decision) => decision.decision === "pending")
    .map((decision) => decision.suggestionId);

  return {
    schemaVersion: artifact.schemaVersion,
    generatedAt: artifact.generatedAt,
    workflowId: artifact.workflowId,
    workflowVersion: artifact.workflowVersion,
    sourceReviewArtifactGeneratedAt: artifact.sourceReviewArtifactGeneratedAt,
    decisionCount: artifact.decisions.length,
    approvedCount: approvedSuggestionIds.length,
    rejectedCount: rejectedSuggestionIds.length,
    pendingCount: pendingSuggestionIds.length,
    approvedSuggestionIds,
    rejectedSuggestionIds,
    pendingSuggestionIds,
    decisions: artifact.decisions.map((decision) => ({
      suggestionId: decision.suggestionId,
      decision: decision.decision,
      note: decision.note ?? null,
      decidedBy: decision.decidedBy ?? null,
      decidedAt: decision.decidedAt ?? null,
    })),
  };
}

export function stringifyAssistantWorkflowDefinitionTuningApprovalArtifact(
  artifact: AssistantWorkflowDefinitionTuningApprovalArtifact,
  space?: number,
): string {
  return JSON.stringify(artifact, null, space);
}

export function parseAssistantWorkflowDefinitionTuningApprovalArtifact(
  value: unknown,
): AssistantWorkflowDefinitionTuningApprovalArtifact | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_TUNING_APPROVAL_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (!isNullableString(value["workflowId"])) return null;
  if (!isNullableNumber(value["workflowVersion"])) return null;
  if (!isNullableString(value["sourceReviewArtifactGeneratedAt"])) return null;
  if (!Array.isArray(value["decisions"])) return null;
  const decisions = value["decisions"].map(parseApprovalDecision);
  if (decisions.some((decision) => decision === null)) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_APPROVAL_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    workflowId: value["workflowId"],
    workflowVersion: value["workflowVersion"],
    sourceReviewArtifactGeneratedAt: value["sourceReviewArtifactGeneratedAt"],
    decisions: decisions.filter((decision): decision is AssistantWorkflowDefinitionTuningApprovalDecision =>
      decision !== null
    ),
  };
}

function normalizeApprovalDecisions(
  decisions: readonly AssistantWorkflowDefinitionTuningApprovalDecision[],
): AssistantWorkflowDefinitionTuningApprovalDecision[] {
  const bySuggestionId = new Map<string, AssistantWorkflowDefinitionTuningApprovalDecision>();
  for (const decision of decisions) {
    const suggestionId = normalizeRequiredString(decision.suggestionId);
    if (!suggestionId) continue;
    const decidedAt = normalizeGeneratedAt(decision.decidedAt);
    bySuggestionId.set(suggestionId, {
      suggestionId,
      decision: decision.decision,
      ...(decision.note?.trim() ? { note: decision.note.trim() } : {}),
      ...(decision.decidedBy?.trim() ? { decidedBy: decision.decidedBy.trim() } : {}),
      ...(decidedAt ? { decidedAt } : {}),
    });
  }
  return [...bySuggestionId.values()].sort((left, right) => left.suggestionId.localeCompare(right.suggestionId));
}

function parseApprovalDecision(value: unknown): AssistantWorkflowDefinitionTuningApprovalDecision | null {
  if (!isRecord(value)) return null;
  if (typeof value["suggestionId"] !== "string" || !value["suggestionId"].trim().length) return null;
  if (!isApprovalDecisionKind(value["decision"])) return null;
  if (value["note"] !== undefined && typeof value["note"] !== "string") return null;
  if (value["decidedBy"] !== undefined && typeof value["decidedBy"] !== "string") return null;
  if (value["decidedAt"] !== undefined && typeof value["decidedAt"] !== "string") return null;

  return {
    suggestionId: value["suggestionId"],
    decision: value["decision"],
    ...(value["note"] ? { note: value["note"] } : {}),
    ...(value["decidedBy"] ? { decidedBy: value["decidedBy"] } : {}),
    ...(value["decidedAt"] ? { decidedAt: value["decidedAt"] } : {}),
  };
}

function buildSuggestionReviewNote(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  suggestion: AssistantWorkflowDefinitionTuningReviewArtifact["suggestions"]["applied"][number],
): string | null {
  const reasons = Array.isArray(artifact.review["reasons"]) ? artifact.review["reasons"] : [];
  const matchingReason = reasons.find((reason) => isMatchingSuggestionReviewReason(reason, suggestion));
  if (matchingReason && isRecord(matchingReason) && typeof matchingReason["code"] === "string") {
    return `Review required: ${matchingReason["code"]}.`;
  }
  const deferredSignals = readDeferredReviewSignalsForSuggestion(artifact, suggestion);
  if (deferredSignals.length > 0) {
    return `Review required: deferred_review_signals (${deferredSignals.join(", ")}).`;
  }
  return "Pending semantic review.";
}

function readDeferredReviewSignalsForSuggestion(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  suggestion: AssistantWorkflowDefinitionTuningReviewArtifact["suggestions"]["applied"][number],
): string[] {
  if (!suggestion.intentId) return [];
  return uniqueStrings(
    artifact.suggestions.reviewOnly
      .filter((reviewOnly) => reviewOnly.intentId === suggestion.intentId)
      .map((reviewOnly) => reviewOnly.signal ?? reviewOnly.action),
  );
}

function isMatchingSuggestionReviewReason(
  value: unknown,
  suggestion: AssistantWorkflowDefinitionTuningReviewArtifact["suggestions"]["applied"][number],
): boolean {
  if (!isRecord(value) || !isRecord(value["details"])) return false;
  const details = value["details"];
  const intentMatches = typeof details["intentId"] !== "string" || details["intentId"] === suggestion.intentId;
  const toolMatches = typeof details["toolName"] !== "string" || details["toolName"] === suggestion.toolName;
  return intentMatches && toolMatches;
}

function isApprovalDecisionKind(value: unknown): value is AssistantWorkflowDefinitionTuningApprovalDecisionKind {
  return value === "pending" || value === "approved" || value === "rejected";
}

function normalizeGeneratedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeOptionalNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRequiredString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value.length || out.includes(value)) continue;
    out.push(value);
  }
  return out.sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}
