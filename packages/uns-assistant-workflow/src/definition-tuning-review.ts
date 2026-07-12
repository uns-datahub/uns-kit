import type { AssistantWorkflowDefinitionPackageSmokeSuiteResult } from "./definition-package-smoke.js";
import type { AssistantWorkflowDefinitionTuningApplyResult } from "./definition-tuning.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionTuningReviewStatus =
  | "ready"
  | "warning"
  | "blocked";

export type AssistantWorkflowDefinitionTuningReviewReasonSeverity =
  | "warning"
  | "blocked";

export type AssistantWorkflowDefinitionTuningReviewReasonCode =
  | "no_change"
  | "smoke_required_failures"
  | "smoke_failures"
  | "smoke_not_run"
  | "too_many_applied_suggestions"
  | "too_many_changed_intents"
  | "too_many_changed_direct_routes"
  | "too_many_hints_for_intent"
  | "tool_output_presentation_mismatch";

export type AssistantWorkflowDefinitionTuningReviewReason = {
  severity: AssistantWorkflowDefinitionTuningReviewReasonSeverity;
  code: AssistantWorkflowDefinitionTuningReviewReasonCode;
  message: string;
  details: Record<string, AssistantWorkflowJsonValue>;
};

export type AssistantWorkflowDefinitionTuningReviewOptions = {
  maxAppliedSuggestions?: number;
  maxChangedIntents?: number;
  maxChangedDirectRoutes?: number;
  maxAddedToolHintsPerIntent?: number;
  requireSmokePass?: boolean;
  checkToolCompatibility?: boolean;
};

export type AssistantWorkflowDefinitionTuningReviewSummary = {
  changed: boolean;
  appliedCount: number;
  skippedCount: number;
  changedIntentCount: number;
  changedDirectRouteCount: number;
  addedToolHintCount: number;
  addedDirectRouteStrategyCount: number;
  maxAddedToolHintsPerIntent: number;
  changedIntents: {
    intentId: string;
    addedToolHintCount: number;
    addedToolHints: string[];
  }[];
  changedDirectRoutes: {
    routeId: string;
    addedStrategyCount: number;
    addedStrategyIds: string[];
  }[];
  smoke: {
    caseCount: number;
    passCount: number;
    failCount: number;
    requiredFailCount: number;
    failedCaseIds: string[];
    requiredFailedCaseIds: string[];
  } | null;
};

export type AssistantWorkflowDefinitionTuningReview = {
  status: AssistantWorkflowDefinitionTuningReviewStatus;
  workflowId: string;
  workflowVersion: number;
  summary: AssistantWorkflowDefinitionTuningReviewSummary;
  thresholds: Required<AssistantWorkflowDefinitionTuningReviewOptions>;
  reasons: AssistantWorkflowDefinitionTuningReviewReason[];
};

const DEFAULT_MAX_APPLIED_SUGGESTIONS = 10;
const DEFAULT_MAX_CHANGED_INTENTS = 3;
const DEFAULT_MAX_CHANGED_DIRECT_ROUTES = 5;
const DEFAULT_MAX_ADDED_TOOL_HINTS_PER_INTENT = 5;

export function buildAssistantWorkflowDefinitionTuningReview(
  applyResult: AssistantWorkflowDefinitionTuningApplyResult,
  smoke: AssistantWorkflowDefinitionPackageSmokeSuiteResult | null = null,
  options: AssistantWorkflowDefinitionTuningReviewOptions = {},
): AssistantWorkflowDefinitionTuningReview {
  const thresholds = normalizeReviewOptions(options);
  const summary = buildReviewSummary(applyResult, smoke);
  const reasons = buildReviewReasons(summary, thresholds, applyResult);
  const hasBlockedReason = reasons.some((reason) => reason.severity === "blocked");
  const status: AssistantWorkflowDefinitionTuningReviewStatus = hasBlockedReason
    ? "blocked"
    : reasons.length > 0
      ? "warning"
      : "ready";

  return {
    status,
    workflowId: applyResult.definition.id,
    workflowVersion: applyResult.definition.version,
    summary,
    thresholds,
    reasons,
  };
}

export function buildAssistantWorkflowDefinitionTuningReviewTracePayload(
  review: AssistantWorkflowDefinitionTuningReview,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    status: review.status,
    workflowId: review.workflowId,
    workflowVersion: review.workflowVersion,
    summary: {
      changed: review.summary.changed,
      appliedCount: review.summary.appliedCount,
      skippedCount: review.summary.skippedCount,
      changedIntentCount: review.summary.changedIntentCount,
      changedDirectRouteCount: review.summary.changedDirectRouteCount,
      addedToolHintCount: review.summary.addedToolHintCount,
      addedDirectRouteStrategyCount: review.summary.addedDirectRouteStrategyCount,
      maxAddedToolHintsPerIntent: review.summary.maxAddedToolHintsPerIntent,
      changedIntents: review.summary.changedIntents.map((intent) => ({
        intentId: intent.intentId,
        addedToolHintCount: intent.addedToolHintCount,
        addedToolHints: intent.addedToolHints,
      })),
      changedDirectRoutes: review.summary.changedDirectRoutes.map((route) => ({
        routeId: route.routeId,
        addedStrategyCount: route.addedStrategyCount,
        addedStrategyIds: route.addedStrategyIds,
      })),
      smoke: review.summary.smoke,
    },
    thresholds: review.thresholds,
    reasons: review.reasons.map((reason) => ({
      severity: reason.severity,
      code: reason.code,
      message: reason.message,
      details: reason.details,
    })),
  };
}

function buildReviewSummary(
  applyResult: AssistantWorkflowDefinitionTuningApplyResult,
  smoke: AssistantWorkflowDefinitionPackageSmokeSuiteResult | null,
): AssistantWorkflowDefinitionTuningReviewSummary {
  const changedIntents = applyResult.diff.intentDiffs
    .filter((intentDiff) => intentDiff.addedToolHints.length > 0)
    .map((intentDiff) => ({
      intentId: intentDiff.intentId,
      addedToolHintCount: intentDiff.addedToolHints.length,
      addedToolHints: intentDiff.addedToolHints,
    }));
  const addedToolHintCount = changedIntents.reduce(
    (total, intent) => total + intent.addedToolHintCount,
    0,
  );
  const changedDirectRoutes = applyResult.diff.directRouteDiffs
    .filter((routeDiff) => routeDiff.addedStrategyIds.length > 0)
    .map((routeDiff) => ({
      routeId: routeDiff.routeId,
      addedStrategyCount: routeDiff.addedStrategyIds.length,
      addedStrategyIds: routeDiff.addedStrategyIds,
    }));
  const addedDirectRouteStrategyCount = changedDirectRoutes.reduce(
    (total, route) => total + route.addedStrategyCount,
    0,
  );

  return {
    changed: applyResult.changed,
    appliedCount: applyResult.appliedCount,
    skippedCount: applyResult.skippedCount,
    changedIntentCount: changedIntents.length,
    changedDirectRouteCount: changedDirectRoutes.length,
    addedToolHintCount,
    addedDirectRouteStrategyCount,
    maxAddedToolHintsPerIntent: Math.max(0, ...changedIntents.map((intent) => intent.addedToolHintCount)),
    changedIntents,
    changedDirectRoutes,
    smoke: smoke
      ? {
          caseCount: smoke.summary.caseCount,
          passCount: smoke.summary.passCount,
          failCount: smoke.summary.failCount,
          requiredFailCount: smoke.summary.requiredFailCount,
          failedCaseIds: smoke.summary.failedCaseIds,
          requiredFailedCaseIds: smoke.summary.requiredFailedCaseIds,
        }
      : null,
  };
}

function buildReviewReasons(
  summary: AssistantWorkflowDefinitionTuningReviewSummary,
  thresholds: Required<AssistantWorkflowDefinitionTuningReviewOptions>,
  applyResult: AssistantWorkflowDefinitionTuningApplyResult,
): AssistantWorkflowDefinitionTuningReviewReason[] {
  const reasons: AssistantWorkflowDefinitionTuningReviewReason[] = [];

  if (!summary.changed) {
    reasons.push(reason(
      "blocked",
      "no_change",
      "No definition changes were applied.",
      {},
    ));
  }

  if (summary.appliedCount > thresholds.maxAppliedSuggestions) {
    reasons.push(reason(
      "warning",
      "too_many_applied_suggestions",
      `Applied ${summary.appliedCount} suggestions, above the review threshold ${thresholds.maxAppliedSuggestions}.`,
      {
        appliedCount: summary.appliedCount,
        maxAppliedSuggestions: thresholds.maxAppliedSuggestions,
      },
    ));
  }

  if (summary.changedIntentCount > thresholds.maxChangedIntents) {
    reasons.push(reason(
      "warning",
      "too_many_changed_intents",
      `Changed ${summary.changedIntentCount} intents, above the review threshold ${thresholds.maxChangedIntents}.`,
      {
        changedIntentCount: summary.changedIntentCount,
        maxChangedIntents: thresholds.maxChangedIntents,
      },
    ));
  }

  if (summary.changedDirectRouteCount > thresholds.maxChangedDirectRoutes) {
    reasons.push(reason(
      "warning",
      "too_many_changed_direct_routes",
      `Changed ${summary.changedDirectRouteCount} direct routes, above the review threshold ${thresholds.maxChangedDirectRoutes}.`,
      {
        changedDirectRouteCount: summary.changedDirectRouteCount,
        maxChangedDirectRoutes: thresholds.maxChangedDirectRoutes,
      },
    ));
  }

  for (const changedIntent of summary.changedIntents) {
    if (changedIntent.addedToolHintCount <= thresholds.maxAddedToolHintsPerIntent) continue;
    reasons.push(reason(
      "warning",
      "too_many_hints_for_intent",
      `Intent ${changedIntent.intentId} gained ${changedIntent.addedToolHintCount} tool hints, above the review threshold ${thresholds.maxAddedToolHintsPerIntent}.`,
      {
        intentId: changedIntent.intentId,
        addedToolHintCount: changedIntent.addedToolHintCount,
        maxAddedToolHintsPerIntent: thresholds.maxAddedToolHintsPerIntent,
        addedToolHints: changedIntent.addedToolHints,
      },
    ));
  }

  if (summary.smoke) {
    if (summary.smoke.requiredFailCount > 0) {
      reasons.push(reason(
        "blocked",
        "smoke_required_failures",
        `${summary.smoke.requiredFailCount} required smoke cases failed.`,
        {
          requiredFailCount: summary.smoke.requiredFailCount,
          requiredFailedCaseIds: summary.smoke.requiredFailedCaseIds,
        },
      ));
    } else if (summary.smoke.failCount > 0) {
      reasons.push(reason(
        "warning",
        "smoke_failures",
        `${summary.smoke.failCount} optional smoke cases failed.`,
        {
          failCount: summary.smoke.failCount,
          failedCaseIds: summary.smoke.failedCaseIds,
        },
      ));
    }
  } else if (thresholds.requireSmokePass) {
    reasons.push(reason(
      "warning",
      "smoke_not_run",
      "Smoke suite was not run for this tuning review.",
      {},
    ));
  }

  if (thresholds.checkToolCompatibility) {
    reasons.push(...buildToolCompatibilityReasons(applyResult));
  }

  return reasons;
}

function buildToolCompatibilityReasons(
  applyResult: AssistantWorkflowDefinitionTuningApplyResult,
): AssistantWorkflowDefinitionTuningReviewReason[] {
  const reasons: AssistantWorkflowDefinitionTuningReviewReason[] = [];
  const intentsById = new Map(applyResult.definition.intents.map((intent) => [intent.id, intent]));
  const toolsByName = new Map((applyResult.definition.tools ?? []).map((tool) => [tool.name, tool]));

  for (const intentDiff of applyResult.diff.intentDiffs) {
    const intent = intentsById.get(intentDiff.intentId);
    if (!intent?.defaultPresentation) continue;
    for (const toolName of intentDiff.addedToolHints) {
      const tool = toolsByName.get(toolName);
      if (!tool) continue;
      if (!hasToolOutputPresentationMismatch(intent.defaultPresentation, tool.outputKinds)) continue;
      reasons.push(reason(
        "warning",
        "tool_output_presentation_mismatch",
        `Tool ${toolName} only produces ${tool.outputKinds.join(", ")} output, which may not fit intent ${intent.id} default presentation ${intent.defaultPresentation}.`,
        {
          intentId: intent.id,
          toolName,
          defaultPresentation: intent.defaultPresentation,
          outputKinds: [...tool.outputKinds],
        },
      ));
    }
  }

  return reasons;
}

function hasToolOutputPresentationMismatch(
  presentation: string,
  outputKinds: readonly string[],
): boolean {
  const normalizedPresentation = presentation.trim().toLowerCase();
  const normalizedOutputKinds = outputKinds.map((outputKind) => outputKind.trim().toLowerCase());
  if (normalizedPresentation === "text") {
    return normalizedOutputKinds.length > 0 &&
      normalizedOutputKinds.every((outputKind) => outputKind === "chart" || outputKind === "artifact");
  }
  if (normalizedPresentation === "table") {
    return normalizedOutputKinds.length > 0 &&
      normalizedOutputKinds.every((outputKind) => outputKind === "chart");
  }
  if (normalizedPresentation === "chart") {
    return normalizedOutputKinds.length > 0 &&
      normalizedOutputKinds.every((outputKind) =>
        !["chart", "data", "table", "artifact"].includes(outputKind)
      );
  }
  return false;
}

function reason(
  severity: AssistantWorkflowDefinitionTuningReviewReasonSeverity,
  code: AssistantWorkflowDefinitionTuningReviewReasonCode,
  message: string,
  details: Record<string, AssistantWorkflowJsonValue>,
): AssistantWorkflowDefinitionTuningReviewReason {
  return { severity, code, message, details };
}

function normalizeReviewOptions(
  options: AssistantWorkflowDefinitionTuningReviewOptions,
): Required<AssistantWorkflowDefinitionTuningReviewOptions> {
  return {
    maxAppliedSuggestions: normalizeNonNegativeInteger(
      options.maxAppliedSuggestions,
      DEFAULT_MAX_APPLIED_SUGGESTIONS,
    ),
    maxChangedIntents: normalizeNonNegativeInteger(
      options.maxChangedIntents,
      DEFAULT_MAX_CHANGED_INTENTS,
    ),
    maxChangedDirectRoutes: normalizeNonNegativeInteger(
      options.maxChangedDirectRoutes,
      DEFAULT_MAX_CHANGED_DIRECT_ROUTES,
    ),
    maxAddedToolHintsPerIntent: normalizeNonNegativeInteger(
      options.maxAddedToolHintsPerIntent,
      DEFAULT_MAX_ADDED_TOOL_HINTS_PER_INTENT,
    ),
    requireSmokePass: options.requireSmokePass !== false,
    checkToolCompatibility: options.checkToolCompatibility !== false,
  };
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) return fallback;
  return Math.floor(value);
}
