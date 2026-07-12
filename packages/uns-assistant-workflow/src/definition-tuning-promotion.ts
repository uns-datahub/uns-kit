import type {
  AssistantWorkflowDefinitionTuningReviewArtifact,
  AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary,
} from "./definition-tuning-review-artifact.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";
import {
  readAssistantWorkflowBoolean as readBoolean,
  readAssistantWorkflowNumber as readNumber,
  readAssistantWorkflowRecord as readRecord,
  readAssistantWorkflowString,
  readAssistantWorkflowStringArray,
} from "./value-readers.js";

export type AssistantWorkflowDefinitionTuningPromotionStatus =
  | "promotable"
  | "needs_review"
  | "blocked";

export type AssistantWorkflowDefinitionTuningPromotionReasonSeverity =
  | "warning"
  | "blocked";

export type AssistantWorkflowDefinitionTuningPromotionReasonCode =
  | "workflow_id_mismatch"
  | "workflow_version_mismatch"
  | "patched_definition_invalid"
  | "missing_review_status"
  | "review_blocked"
  | "review_warning"
  | "no_change"
  | "missing_smoke"
  | "smoke_required_failures"
  | "smoke_failures"
  | "missing_applied_suggestion_details"
  | "unapproved_suggestions"
  | "deferred_review_signals";

export type AssistantWorkflowDefinitionTuningPromotionReason = {
  severity: AssistantWorkflowDefinitionTuningPromotionReasonSeverity;
  code: AssistantWorkflowDefinitionTuningPromotionReasonCode;
  message: string;
  details: Record<string, AssistantWorkflowJsonValue>;
};

export type AssistantWorkflowDefinitionTuningPromotionOptions = {
  expectedWorkflowId?: string;
  expectedFromVersion?: number;
  expectedToVersion?: number;
  allowReviewWarnings?: boolean;
  requireSmoke?: boolean;
  requireApprovedSuggestions?: boolean;
  approvedSuggestionIds?: readonly string[];
};

export type AssistantWorkflowDefinitionTuningPromotionSummary = {
  workflowId: string;
  workflowVersion: number;
  reviewStatus: string | null;
  changed: boolean | null;
  fromVersion: number | null;
  toVersion: number | null;
  appliedCount: number | null;
  changedIntentCount: number | null;
  smokeCaseCount: number | null;
  smokeFailCount: number | null;
  smokeRequiredFailCount: number | null;
  patchedDefinitionValid: boolean;
  appliedSuggestionIds: string[];
  appliedSuggestionCount: number;
};

type NormalizedPromotionOptions = {
  expectedWorkflowId: string;
  expectedFromVersion: number;
  expectedToVersion: number;
  allowReviewWarnings: boolean;
  requireSmoke: boolean;
  requireApprovedSuggestions: boolean;
  approvedSuggestionIds: string[];
};

export type AssistantWorkflowDefinitionTuningPromotion = {
  status: AssistantWorkflowDefinitionTuningPromotionStatus;
  summary: AssistantWorkflowDefinitionTuningPromotionSummary;
  options: NormalizedPromotionOptions;
  reasons: AssistantWorkflowDefinitionTuningPromotionReason[];
};

export type AssistantWorkflowDefinitionTuningPromotionBriefSuggestion = {
  id: string;
  action: string;
  intentId: string | null;
  toolName: string | null;
  count: number;
  requestIds: string[];
  rationale: string;
  suggestedAction: string;
  approved: boolean | null;
};

export type AssistantWorkflowDefinitionTuningPromotionBriefIntentChange = {
  intentId: string;
  addedToolHints: string[];
  addedPlanningSteps: string[];
  addedToolSelectionProfileIds: string[];
  addedPlanningStepProfileIds: string[];
  appliedSuggestions: AssistantWorkflowDefinitionTuningPromotionBriefSuggestion[];
};

export type AssistantWorkflowDefinitionTuningPromotionBriefDirectRouteChange = {
  routeId: string;
  addedStrategyIds: string[];
  appliedSuggestions: AssistantWorkflowDefinitionTuningPromotionBriefSuggestion[];
};

export type AssistantWorkflowDefinitionTuningPromotionBriefDeferredSuggestion = {
  id: string;
  action: string;
  intentId: string | null;
  toolName: string | null;
  signal: string | null;
  count: number;
  requestIds: string[];
  rationale: string;
  suggestedAction: string;
};

export type AssistantWorkflowDefinitionTuningPromotionBriefSkippedSuggestion = {
  id: string;
  reason: string;
  suggestion: AssistantWorkflowDefinitionTuningPromotionBriefDeferredSuggestion | null;
};

export type AssistantWorkflowDefinitionTuningPromotionBrief = {
  workflowId: string;
  fromVersion: number | null;
  toVersion: number | null;
  status: AssistantWorkflowDefinitionTuningPromotionStatus;
  changedIntentCount: number;
  changedDirectRouteCount: number;
  addedToolHintCount: number;
  addedDirectRouteStrategyCount: number;
  appliedSuggestionCount: number;
  changes: AssistantWorkflowDefinitionTuningPromotionBriefIntentChange[];
  directRouteChanges: AssistantWorkflowDefinitionTuningPromotionBriefDirectRouteChange[];
  suggestionSummary: AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary;
  skippedSuggestions: AssistantWorkflowDefinitionTuningPromotionBriefSkippedSuggestion[];
  reviewOnlySuggestions: AssistantWorkflowDefinitionTuningPromotionBriefDeferredSuggestion[];
  reviewReasons: {
    severity: string;
    code: string;
    message: string;
    details: Record<string, AssistantWorkflowJsonValue>;
  }[];
  reasons: AssistantWorkflowDefinitionTuningPromotionReason[];
};

export function buildAssistantWorkflowDefinitionTuningPromotion(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  options: AssistantWorkflowDefinitionTuningPromotionOptions = {},
): AssistantWorkflowDefinitionTuningPromotion {
  const normalizedOptions = normalizePromotionOptions(artifact, options);
  const summary = buildPromotionSummary(artifact);
  const reasons = buildPromotionReasons(artifact, summary, normalizedOptions);
  const status = reasons.some((reason) => reason.severity === "blocked")
    ? "blocked"
    : reasons.some((reason) => reason.severity === "warning")
      ? "needs_review"
      : "promotable";

  return {
    status,
    summary,
    options: normalizedOptions,
    reasons,
  };
}

export function buildAssistantWorkflowDefinitionTuningPromotionBrief(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  promotion: AssistantWorkflowDefinitionTuningPromotion = buildAssistantWorkflowDefinitionTuningPromotion(artifact),
): AssistantWorkflowDefinitionTuningPromotionBrief {
  const intentDiffs = readIntentDiffs(artifact);
  const directRouteDiffs = readDirectRouteDiffs(artifact);
  const approvedIds = promotion.options.requireApprovedSuggestions
    ? new Set(promotion.options.approvedSuggestionIds)
    : null;
  const appliedSuggestions = artifact.suggestions.applied.map((suggestion) => ({
    id: suggestion.id,
    action: suggestion.action,
    intentId: suggestion.intentId,
    toolName: suggestion.toolName,
    count: suggestion.count,
    requestIds: [...suggestion.requestIds],
    rationale: suggestion.rationale,
    suggestedAction: suggestion.suggestedAction,
    approved: approvedIds ? approvedIds.has(suggestion.id) : null,
  }));
  const suggestionsByIntent = new Map<string, AssistantWorkflowDefinitionTuningPromotionBriefSuggestion[]>();
  const suggestionsByDirectRoute = new Map<string, AssistantWorkflowDefinitionTuningPromotionBriefSuggestion[]>();

  for (const suggestion of appliedSuggestions) {
    if (suggestion.action === "add_direct_route_strategy" && suggestion.intentId) {
      const suggestions = suggestionsByDirectRoute.get(suggestion.intentId) ?? [];
      suggestions.push(suggestion);
      suggestionsByDirectRoute.set(suggestion.intentId, suggestions);
      continue;
    }
    if (suggestion.intentId) {
      const suggestions = suggestionsByIntent.get(suggestion.intentId) ?? [];
      suggestions.push(suggestion);
      suggestionsByIntent.set(suggestion.intentId, suggestions);
    }
  }

  const changes = intentDiffs.map((intentDiff) => ({
    intentId: intentDiff.intentId,
    addedToolHints: intentDiff.addedToolHints,
    addedPlanningSteps: intentDiff.addedPlanningSteps,
    addedToolSelectionProfileIds: intentDiff.addedToolSelectionProfileIds,
    addedPlanningStepProfileIds: intentDiff.addedPlanningStepProfileIds,
    appliedSuggestions: suggestionsByIntent.get(intentDiff.intentId) ?? [],
  }));
  const directRouteChanges = directRouteDiffs.map((routeDiff) => ({
    routeId: routeDiff.routeId,
    addedStrategyIds: routeDiff.addedStrategyIds,
    appliedSuggestions: suggestionsByDirectRoute.get(routeDiff.routeId) ?? [],
  }));

  return {
    workflowId: artifact.workflowId,
    fromVersion: promotion.summary.fromVersion,
    toVersion: promotion.summary.toVersion,
    status: promotion.status,
    changedIntentCount: changes.length,
    changedDirectRouteCount: directRouteChanges.length,
    addedToolHintCount: changes.reduce((total, change) => total + change.addedToolHints.length, 0),
    addedDirectRouteStrategyCount: directRouteChanges.reduce(
      (total, change) => total + change.addedStrategyIds.length,
      0,
    ),
    appliedSuggestionCount: appliedSuggestions.length,
    changes,
    directRouteChanges,
    suggestionSummary: cloneSuggestionSummary(artifact.suggestions.summary),
    skippedSuggestions: artifact.suggestions.skipped.map((skipped) => ({
      id: skipped.id,
      reason: skipped.reason,
      suggestion: skipped.suggestion ? toBriefDeferredSuggestion(skipped.suggestion) : null,
    })),
    reviewOnlySuggestions: artifact.suggestions.reviewOnly.map(toBriefDeferredSuggestion),
    reviewReasons: readReviewReasons(artifact),
    reasons: promotion.reasons,
  };
}

export function buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(
  brief: AssistantWorkflowDefinitionTuningPromotionBrief,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    workflowId: brief.workflowId,
    fromVersion: brief.fromVersion,
    toVersion: brief.toVersion,
    status: brief.status,
    changedIntentCount: brief.changedIntentCount,
    changedDirectRouteCount: brief.changedDirectRouteCount,
    addedToolHintCount: brief.addedToolHintCount,
    addedDirectRouteStrategyCount: brief.addedDirectRouteStrategyCount,
    appliedSuggestionCount: brief.appliedSuggestionCount,
    changes: brief.changes.map((change) => ({
      intentId: change.intentId,
      addedToolHints: change.addedToolHints,
      addedPlanningSteps: change.addedPlanningSteps,
      addedToolSelectionProfileIds: change.addedToolSelectionProfileIds,
      addedPlanningStepProfileIds: change.addedPlanningStepProfileIds,
      appliedSuggestions: change.appliedSuggestions.map((suggestion) => ({
        id: suggestion.id,
        action: suggestion.action,
        intentId: suggestion.intentId,
        toolName: suggestion.toolName,
        count: suggestion.count,
        requestIds: suggestion.requestIds,
        rationale: suggestion.rationale,
        suggestedAction: suggestion.suggestedAction,
        approved: suggestion.approved,
      })),
    })),
    directRouteChanges: brief.directRouteChanges.map((change) => ({
      routeId: change.routeId,
      addedStrategyIds: change.addedStrategyIds,
      appliedSuggestions: change.appliedSuggestions.map((suggestion) => ({
        id: suggestion.id,
        action: suggestion.action,
        intentId: suggestion.intentId,
        toolName: suggestion.toolName,
        count: suggestion.count,
        requestIds: suggestion.requestIds,
        rationale: suggestion.rationale,
        suggestedAction: suggestion.suggestedAction,
        approved: suggestion.approved,
      })),
    })),
    suggestionSummary: {
      appliedCount: brief.suggestionSummary.appliedCount,
      skippedCount: brief.suggestionSummary.skippedCount,
      reviewOnlyCount: brief.suggestionSummary.reviewOnlyCount,
      skipReasonCounts: brief.suggestionSummary.skipReasonCounts.map((count) => ({
        key: count.key,
        count: count.count,
      })),
      reviewOnlyActionCounts: brief.suggestionSummary.reviewOnlyActionCounts.map((count) => ({
        key: count.key,
        count: count.count,
      })),
      reviewOnlySignalCounts: brief.suggestionSummary.reviewOnlySignalCounts.map((count) => ({
        key: count.key,
        count: count.count,
      })),
    },
    skippedSuggestions: brief.skippedSuggestions.map((skipped) => ({
      id: skipped.id,
      reason: skipped.reason,
      suggestion: skipped.suggestion ? serializeBriefDeferredSuggestion(skipped.suggestion) : null,
    })),
    reviewOnlySuggestions: brief.reviewOnlySuggestions.map(serializeBriefDeferredSuggestion),
    reviewReasons: brief.reviewReasons.map((reason) => ({
      severity: reason.severity,
      code: reason.code,
      message: reason.message,
      details: reason.details,
    })),
    reasons: brief.reasons.map((reason) => ({
      severity: reason.severity,
      code: reason.code,
      message: reason.message,
      details: reason.details,
    })),
  };
}

function toBriefDeferredSuggestion(
  suggestion: AssistantWorkflowDefinitionTuningReviewArtifact["suggestions"]["reviewOnly"][number],
): AssistantWorkflowDefinitionTuningPromotionBriefDeferredSuggestion {
  return {
    id: suggestion.id,
    action: suggestion.action,
    intentId: suggestion.intentId,
    toolName: suggestion.toolName,
    signal: suggestion.signal,
    count: suggestion.count,
    requestIds: [...suggestion.requestIds],
    rationale: suggestion.rationale,
    suggestedAction: suggestion.suggestedAction,
  };
}

function serializeBriefDeferredSuggestion(
  suggestion: AssistantWorkflowDefinitionTuningPromotionBriefDeferredSuggestion,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    id: suggestion.id,
    action: suggestion.action,
    intentId: suggestion.intentId,
    toolName: suggestion.toolName,
    signal: suggestion.signal,
    count: suggestion.count,
    requestIds: suggestion.requestIds,
    rationale: suggestion.rationale,
    suggestedAction: suggestion.suggestedAction,
  };
}

function cloneSuggestionSummary(
  summary: AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary,
): AssistantWorkflowDefinitionTuningReviewArtifactSuggestionSummary {
  return {
    appliedCount: summary.appliedCount,
    skippedCount: summary.skippedCount,
    reviewOnlyCount: summary.reviewOnlyCount,
    skipReasonCounts: summary.skipReasonCounts.map((count) => ({ ...count })),
    reviewOnlyActionCounts: summary.reviewOnlyActionCounts.map((count) => ({ ...count })),
    reviewOnlySignalCounts: summary.reviewOnlySignalCounts.map((count) => ({ ...count })),
  };
}

function readReviewReasons(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
): AssistantWorkflowDefinitionTuningPromotionBrief["reviewReasons"] {
  const rawReasons = artifact.review["reasons"];
  if (!Array.isArray(rawReasons)) return [];
  return rawReasons.flatMap((value) => {
    const rawReason = readRecord(value);
    if (!rawReason) return [];
    const severity = readString(rawReason["severity"]);
    const code = readString(rawReason["code"]);
    const message = readString(rawReason["message"]);
    const details = readRecord<Record<string, AssistantWorkflowJsonValue>>(rawReason["details"]) ?? {};
    if (!severity || !code || !message) return [];
    return [{ severity, code, message, details }];
  });
}

export function buildAssistantWorkflowDefinitionTuningPromotionTracePayload(
  promotion: AssistantWorkflowDefinitionTuningPromotion,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    status: promotion.status,
    summary: {
      workflowId: promotion.summary.workflowId,
      workflowVersion: promotion.summary.workflowVersion,
      reviewStatus: promotion.summary.reviewStatus,
      changed: promotion.summary.changed,
      fromVersion: promotion.summary.fromVersion,
      toVersion: promotion.summary.toVersion,
      appliedCount: promotion.summary.appliedCount,
      changedIntentCount: promotion.summary.changedIntentCount,
      smokeCaseCount: promotion.summary.smokeCaseCount,
      smokeFailCount: promotion.summary.smokeFailCount,
      smokeRequiredFailCount: promotion.summary.smokeRequiredFailCount,
      patchedDefinitionValid: promotion.summary.patchedDefinitionValid,
      appliedSuggestionIds: promotion.summary.appliedSuggestionIds,
      appliedSuggestionCount: promotion.summary.appliedSuggestionCount,
    },
    options: {
      expectedWorkflowId: promotion.options.expectedWorkflowId,
      expectedFromVersion: promotion.options.expectedFromVersion,
      expectedToVersion: promotion.options.expectedToVersion,
      allowReviewWarnings: promotion.options.allowReviewWarnings,
      requireSmoke: promotion.options.requireSmoke,
      requireApprovedSuggestions: promotion.options.requireApprovedSuggestions,
      approvedSuggestionIds: promotion.options.approvedSuggestionIds,
    },
    reasons: promotion.reasons.map((reason) => ({
      severity: reason.severity,
      code: reason.code,
      message: reason.message,
      details: reason.details,
    })),
  };
}

function readIntentDiffs(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
): {
  intentId: string;
  addedToolHints: string[];
  addedPlanningSteps: string[];
  addedToolSelectionProfileIds: string[];
  addedPlanningStepProfileIds: string[];
}[] {
  const diff = readRecord(artifact.apply["diff"]);
  const intentDiffs = diff?.["intentDiffs"];
  if (!Array.isArray(intentDiffs)) return [];

  return intentDiffs.flatMap((value) => {
    const intentDiff = readRecord(value);
    if (!intentDiff) return [];
    const intentId = readString(intentDiff["intentId"]);
    const addedToolHints = readStringArray(intentDiff["addedToolHints"]);
    const addedPlanningSteps = readStringArray(intentDiff["addedPlanningSteps"]);
    const addedToolSelectionProfileIds = readStringArray(intentDiff["addedToolSelectionProfileIds"]);
    const addedPlanningStepProfileIds = readStringArray(intentDiff["addedPlanningStepProfileIds"]);
    if (
      !intentId ||
      (
        addedToolHints.length === 0 &&
        addedPlanningSteps.length === 0 &&
        addedToolSelectionProfileIds.length === 0 &&
        addedPlanningStepProfileIds.length === 0
      )
    ) {
      return [];
    }
    return [{
      intentId,
      addedToolHints,
      addedPlanningSteps,
      addedToolSelectionProfileIds,
      addedPlanningStepProfileIds,
    }];
  });
}

function readDirectRouteDiffs(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
): {
  routeId: string;
  addedStrategyIds: string[];
}[] {
  const diff = readRecord(artifact.apply["diff"]);
  const directRouteDiffs = diff?.["directRouteDiffs"];
  if (!Array.isArray(directRouteDiffs)) return [];

  return directRouteDiffs.flatMap((value) => {
    const routeDiff = readRecord(value);
    if (!routeDiff) return [];
    const routeId = readString(routeDiff["routeId"]);
    const addedStrategyIds = readStringArray(routeDiff["addedStrategyIds"]);
    if (!routeId || addedStrategyIds.length === 0) return [];
    return [{
      routeId,
      addedStrategyIds,
    }];
  });
}

function buildPromotionSummary(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
): AssistantWorkflowDefinitionTuningPromotionSummary {
  const reviewSummary = readRecord(artifact.review["summary"]);
  const smoke = readRecord(artifact.smoke);
  const smokeSummary = smoke ? readRecord(smoke["summary"]) : null;
  const applyDiff = readRecord(artifact.apply["diff"]);

  return {
    workflowId: artifact.workflowId,
    workflowVersion: artifact.workflowVersion,
    reviewStatus: readString(artifact.review["status"]),
    changed: readBoolean(artifact.apply["changed"]),
    fromVersion: applyDiff ? readNumber(applyDiff["fromVersion"]) : null,
    toVersion: applyDiff ? readNumber(applyDiff["toVersion"]) : null,
    appliedCount: readNumber(artifact.apply["appliedCount"]),
    changedIntentCount: reviewSummary ? readNumber(reviewSummary["changedIntentCount"]) : null,
    smokeCaseCount: smokeSummary ? readNumber(smokeSummary["caseCount"]) : null,
    smokeFailCount: smokeSummary ? readNumber(smokeSummary["failCount"]) : null,
    smokeRequiredFailCount: smokeSummary ? readNumber(smokeSummary["requiredFailCount"]) : null,
    patchedDefinitionValid: artifact.patchedDefinition.summary.valid,
    appliedSuggestionIds: artifact.suggestions.applied.map((suggestion) => suggestion.id),
    appliedSuggestionCount: artifact.suggestions.applied.length,
  };
}

function buildPromotionReasons(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  summary: AssistantWorkflowDefinitionTuningPromotionSummary,
  options: NormalizedPromotionOptions,
): AssistantWorkflowDefinitionTuningPromotionReason[] {
  const reasons: AssistantWorkflowDefinitionTuningPromotionReason[] = [];

  if (summary.workflowId !== options.expectedWorkflowId) {
    reasons.push(reason(
      "blocked",
      "workflow_id_mismatch",
      `Artifact workflow id ${summary.workflowId} does not match expected workflow id ${options.expectedWorkflowId}.`,
      {
        workflowId: summary.workflowId,
        expectedWorkflowId: options.expectedWorkflowId,
      },
    ));
  }

  if (summary.fromVersion !== options.expectedFromVersion) {
    reasons.push(reason(
      "blocked",
      "workflow_version_mismatch",
      `Artifact source version ${summary.fromVersion ?? "unknown"} does not match expected source version ${options.expectedFromVersion}.`,
      {
        fromVersion: summary.fromVersion,
        expectedFromVersion: options.expectedFromVersion,
      },
    ));
  }

  if (summary.toVersion !== options.expectedToVersion || summary.workflowVersion !== options.expectedToVersion) {
    reasons.push(reason(
      "blocked",
      "workflow_version_mismatch",
      `Artifact target version ${summary.toVersion ?? "unknown"} does not match expected target version ${options.expectedToVersion}.`,
      {
        workflowVersion: summary.workflowVersion,
        toVersion: summary.toVersion,
        expectedToVersion: options.expectedToVersion,
      },
    ));
  }

  if (!summary.patchedDefinitionValid) {
    reasons.push(reason(
      "blocked",
      "patched_definition_invalid",
      "Patched workflow definition is not valid.",
      {},
    ));
  }

  if (summary.reviewStatus === null) {
    reasons.push(reason(
      "blocked",
      "missing_review_status",
      "Review artifact does not contain a review status.",
      {},
    ));
  } else if (summary.reviewStatus === "blocked") {
    reasons.push(reason(
      "blocked",
      "review_blocked",
      "Review decision is blocked.",
      {
        reviewStatus: summary.reviewStatus,
      },
    ));
  } else if (summary.reviewStatus === "warning" && !options.allowReviewWarnings) {
    reasons.push(reason(
      "warning",
      "review_warning",
      "Review decision contains warnings and warning promotion is not allowed.",
      {
        reviewStatus: summary.reviewStatus,
      },
    ));
  }

  if (summary.changed !== true) {
    reasons.push(reason(
      "blocked",
      "no_change",
      "Artifact does not contain an applied definition change.",
      {
        changed: summary.changed,
      },
    ));
  }

  if (options.requireSmoke && summary.smokeCaseCount === null) {
    reasons.push(reason(
      "blocked",
      "missing_smoke",
      "Promotion requires smoke results, but the artifact does not contain a smoke summary.",
      {},
    ));
  }

  if ((summary.smokeRequiredFailCount ?? 0) > 0) {
    reasons.push(reason(
      "blocked",
      "smoke_required_failures",
      `${summary.smokeRequiredFailCount} required smoke cases failed.`,
      {
        smokeRequiredFailCount: summary.smokeRequiredFailCount,
      },
    ));
  } else if ((summary.smokeFailCount ?? 0) > 0) {
    reasons.push(reason(
      "warning",
      "smoke_failures",
      `${summary.smokeFailCount} optional smoke cases failed.`,
      {
        smokeFailCount: summary.smokeFailCount,
      },
    ));
  }

  if (options.requireApprovedSuggestions) {
    if ((summary.appliedCount ?? 0) > 0 && summary.appliedSuggestionIds.length === 0) {
      reasons.push(reason(
        "blocked",
        "missing_applied_suggestion_details",
        "Promotion requires approved suggestion ids, but the artifact does not include applied suggestion details.",
        {
          appliedCount: summary.appliedCount,
        },
      ));
    } else {
      const approvedIds = new Set(options.approvedSuggestionIds);
      const unapprovedSuggestionIds = summary.appliedSuggestionIds.filter((id) => !approvedIds.has(id));
      if (unapprovedSuggestionIds.length > 0) {
        reasons.push(reason(
          "blocked",
          "unapproved_suggestions",
          `${unapprovedSuggestionIds.length} applied suggestion(s) are not approved for promotion.`,
          {
            unapprovedSuggestionIds,
            approvedSuggestionIds: options.approvedSuggestionIds,
          },
        ));
      }
    }
  }

  if (!options.allowReviewWarnings) {
    const deferredSignals = buildDeferredReviewSignalWarnings(artifact);
    if (deferredSignals.length > 0) {
      reasons.push(reason(
        "warning",
        "deferred_review_signals",
        `${deferredSignals.length} intent(s) have applied suggestions alongside deferred review-only trace signals.`,
        {
          intents: deferredSignals,
        },
      ));
    }
  }

  return reasons;
}

function buildDeferredReviewSignalWarnings(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
): Record<string, AssistantWorkflowJsonValue>[] {
  const appliedIntentIds = new Set(
    artifact.suggestions.applied
      .map((suggestion) => suggestion.intentId)
      .filter((intentId): intentId is string => typeof intentId === "string" && intentId.length > 0),
  );
  const signalsByIntent = new Map<string, Set<string>>();

  for (const suggestion of artifact.suggestions.reviewOnly) {
    if (!suggestion.intentId || !appliedIntentIds.has(suggestion.intentId)) continue;
    const signals = signalsByIntent.get(suggestion.intentId) ?? new Set<string>();
    signals.add(suggestion.signal ?? suggestion.action);
    signalsByIntent.set(suggestion.intentId, signals);
  }

  return [...signalsByIntent.entries()]
    .map(([intentId, signals]) => ({
      intentId,
      signals: [...signals].sort(),
    }))
    .sort((left, right) => String(left.intentId).localeCompare(String(right.intentId)));
}

function reason(
  severity: AssistantWorkflowDefinitionTuningPromotionReasonSeverity,
  code: AssistantWorkflowDefinitionTuningPromotionReasonCode,
  message: string,
  details: Record<string, AssistantWorkflowJsonValue>,
): AssistantWorkflowDefinitionTuningPromotionReason {
  return { severity, code, message, details };
}

function normalizePromotionOptions(
  artifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  options: AssistantWorkflowDefinitionTuningPromotionOptions,
): NormalizedPromotionOptions {
  const applyDiff = readRecord(artifact.apply["diff"]);
  const fromVersion = applyDiff ? readNumber(applyDiff["fromVersion"]) : null;
  const toVersion = applyDiff ? readNumber(applyDiff["toVersion"]) : null;

  return {
    expectedWorkflowId: options.expectedWorkflowId ?? artifact.workflowId,
    expectedFromVersion: options.expectedFromVersion ?? fromVersion ?? artifact.workflowVersion - 1,
    expectedToVersion: options.expectedToVersion ?? toVersion ?? artifact.workflowVersion,
    allowReviewWarnings: options.allowReviewWarnings === true,
    requireSmoke: options.requireSmoke !== false,
    requireApprovedSuggestions: options.requireApprovedSuggestions === true,
    approvedSuggestionIds: uniqueStrings(options.approvedSuggestionIds ?? []),
  };
}

function readString(value: unknown): string | null {
  return readAssistantWorkflowString(value, { trim: false, allowEmpty: true });
}

function readStringArray(value: unknown): string[] {
  return readAssistantWorkflowStringArray(value, { trim: false, allowEmpty: true, unique: false });
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value.length || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}
