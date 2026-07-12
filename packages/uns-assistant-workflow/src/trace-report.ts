import {
  buildAssistantWorkflowTraceEvalCandidate,
  buildAssistantWorkflowTraceSummary,
  collectAssistantWorkflowTraceTuningSignals,
  getAssistantWorkflowUnmodeledToolCalls,
  getMissingWorkflowSelectionCandidateTools,
  hasAssistantWorkflowConstrainedToolSelectionEvidence,
  type AssistantWorkflowTraceEvalCandidate,
  type AssistantWorkflowTraceSummary,
  type AssistantWorkflowTraceTuningSignal,
  type AssistantWorkflowTraceTuningSignalName,
} from "./trace-replay.js";
import {
  readAssistantWorkflowTraceString as normalizeNullableString,
  type AssistantWorkflowTraceEvent,
} from "./trace-events.js";
import {
  ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
  type AssistantWorkflowSerializedRunReport,
} from "./run-report-json.js";
import { ASSISTANT_WORKFLOW_TRACE_STAGE } from "./trace-stages.js";
import type { AssistantWorkflowRunEvaluationSignal } from "./run-evaluation.js";
import type { AssistantWorkflowRunReportStatus } from "./run-report.js";
import type {
  AssistantWorkflowDefinition,
  AssistantWorkflowDirectRouteDefinition,
} from "./definition.js";
import { buildAssistantWorkflowToolSelectionProfileKey } from "./tool-selection-policy.js";

export type AssistantWorkflowTraceReportSourceRow = {
  debugId?: string | null;
  requestId: string;
  threadId?: string | null;
  userId?: string | null;
  provider?: string | null;
  model?: string | null;
  feedback?: string | null;
  feedbackAt?: string | null;
  createdAt?: string | null;
  traceEvents: readonly AssistantWorkflowTraceEvent[];
};

export type AssistantWorkflowTraceReportOptions = {
  onlyInteresting?: boolean;
  workflow?: AssistantWorkflowDefinition | null;
  /**
   * Restrict all report aggregates, suggestions, tuning candidates, and
   * serialized run-report inputs to trace rows emitted by these workflow ids.
   * Rows without a recorded workflow identity are excluded when a scope is set.
   */
  workflowIds?: readonly string[] | null;
  /**
   * Restrict all report aggregates, suggestions, tuning candidates, and
   * serialized run-report inputs to trace rows emitted by these workflow versions.
   * Rows without a recorded workflow identity are excluded when a scope is set.
   */
  workflowVersions?: readonly number[] | null;
};

export type AssistantWorkflowTraceReportRow = {
  debugId: string | null;
  requestId: string;
  threadId: string | null;
  userId: string | null;
  provider: string | null;
  model: string | null;
  feedback: string | null;
  feedbackAt: string | null;
  createdAt: string | null;
  summary: AssistantWorkflowTraceSummary;
  evalCandidate: AssistantWorkflowTraceEvalCandidate | null;
  tuningSignals: AssistantWorkflowTraceTuningSignal[];
  directRouteStrategies: AssistantWorkflowTraceReportDirectRouteStrategy[];
};

export type AssistantWorkflowTraceReportCount = {
  key: string;
  count: number;
};

/**
 * Aggregates actual provider tool sets rather than pre-runtime candidates.
 * Numeric totals are accompanied by observation counts because older trace
 * records may not include every metric.
 */
export type AssistantWorkflowTraceReportToolSelectionSegment = {
  segmentKey: string;
  workflowId: string | null;
  workflowVersion: number | null;
  workflowProfileKey: string | null;
  intentId: string;
  hop: number | null;
  mode: string | null;
  selectionReason: string | null;
  pruningEnabled: boolean | null;
  /** Order-insensitive signature of the actual provider tool definitions. */
  toolSignature: string;
  toolNames: string[];
  authoritySource: string | null;
  authorityReason: string | null;
  selectionCount: number;
  toolCountObservationCount: number;
  toolCountTotal: number;
  averageToolCount: number | null;
  totalToolCountObservationCount: number;
  totalToolCountTotal: number;
  averageTotalToolCount: number | null;
  schemaCostSource: string | null;
  schemaCharsObservationCount: number;
  schemaCharsTotal: number;
  averageSchemaChars: number | null;
  savedCharsObservationCount: number;
  savedCharsTotal: number;
  averageSavedChars: number | null;
};

export type AssistantWorkflowTraceReportTuningSignalCount = {
  name: AssistantWorkflowTraceTuningSignalName;
  severity: "info" | "warning";
  count: number;
};

export type AssistantWorkflowTraceReportDirectRouteStrategyStatus =
  | "declared"
  | "workflow_not_provided"
  | "route_not_declared"
  | "strategy_not_declared";

export type AssistantWorkflowTraceReportDirectRouteStrategy = {
  route: string;
  strategy: string;
  definitionRouteId: string | null;
  declared: boolean | null;
  status: AssistantWorkflowTraceReportDirectRouteStrategyStatus;
};

export type AssistantWorkflowTraceReportSuggestionKind =
  | "review_missing_required_tool"
  | "review_workflow_tool_selection_gap"
  | "review_unmodeled_selected_tool"
  | "review_classifier_extra_tool"
  | "review_clarification_policy"
  | "review_memory_patch_equivalence"
  | "review_direct_route_strategy"
  | "review_trace_error"
  | "review_quality_signal"
  | "promote_bad_feedback_eval";

export type AssistantWorkflowTraceReportSuggestion = {
  id: string;
  kind: AssistantWorkflowTraceReportSuggestionKind;
  severity: "info" | "warning";
  intent: string | null;
  tool: string | null;
  signal: string | null;
  count: number;
  requestIds: string[];
  rationale: string;
  suggestedAction: string;
};

export type AssistantWorkflowTraceReport = {
  generatedAt: string;
  /** Requested workflow-id scope, normalized and sorted. */
  workflowIds: string[];
  /** Requested workflow-version scope, normalized and sorted. */
  workflowVersions: number[];
  rowCount: number;
  /** Source rows remaining after a requested workflow scope, before `onlyInteresting`. */
  scopedSourceRowCount: number;
  sourceRowCount: number;
  evalCandidateCount: number;
  interestingRowCount: number;
  qualityFlaggedRowCount: number;
  errorRowCount: number;
  feedbackCounts: AssistantWorkflowTraceReportCount[];
  intentCounts: AssistantWorkflowTraceReportCount[];
  authorityCounts: AssistantWorkflowTraceReportCount[];
  authorityReasonCounts: AssistantWorkflowTraceReportCount[];
  workflowSelectionOptionalToolModeCounts: AssistantWorkflowTraceReportCount[];
  workflowSelectionExcludedOptionalToolCounts: AssistantWorkflowTraceReportCount[];
  workflowSelectionActiveProfileCounts: AssistantWorkflowTraceReportCount[];
  workflowSelectionProfileToolCounts: AssistantWorkflowTraceReportCount[];
  activePlanningStepProfileCounts: AssistantWorkflowTraceReportCount[];
  profileStepCounts: AssistantWorkflowTraceReportCount[];
  outcomeKindCounts: AssistantWorkflowTraceReportCount[];
  handledOutcomeKindCounts: AssistantWorkflowTraceReportCount[];
  clarificationComparisonMatchedCounts: AssistantWorkflowTraceReportCount[];
  clarificationComparisonMissingRuleCounts: AssistantWorkflowTraceReportCount[];
  clarificationComparisonUnexpectedRuleCounts: AssistantWorkflowTraceReportCount[];
  directRoutePolicyEnabledCounts: AssistantWorkflowTraceReportCount[];
  directRoutePolicyDisabledReasonCounts: AssistantWorkflowTraceReportCount[];
  directRouteGapReasonCounts: AssistantWorkflowTraceReportCount[];
  directRouteObservedStrategyCounts: AssistantWorkflowTraceReportCount[];
  directRouteUndeclaredStrategyCounts: AssistantWorkflowTraceReportCount[];
  directRouteDoneCounts: AssistantWorkflowTraceReportCount[];
  directRouteRecoveredCounts: AssistantWorkflowTraceReportCount[];
  directRouteErrorCounts: AssistantWorkflowTraceReportCount[];
  directRouteSkipReasonCounts: AssistantWorkflowTraceReportCount[];
  memoryChangedSlotCounts: AssistantWorkflowTraceReportCount[];
  memoryChangedProfileFieldCounts: AssistantWorkflowTraceReportCount[];
  memorySkippedPatchReasonCounts: AssistantWorkflowTraceReportCount[];
  memoryPatchEquivalenceCounts: AssistantWorkflowTraceReportCount[];
  memoryPatchDerivationCounts: AssistantWorkflowTraceReportCount[];
  memoryPatchMismatchedProfileFieldCounts: AssistantWorkflowTraceReportCount[];
  memoryPatchWriteSourceCounts: AssistantWorkflowTraceReportCount[];
  memoryPatchWriteReasonCounts: AssistantWorkflowTraceReportCount[];
  memoryIntentWritePolicyIntentCounts: AssistantWorkflowTraceReportCount[];
  memoryIntentWritePolicyEquivalenceCounts: AssistantWorkflowTraceReportCount[];
  memoryIntentWritePolicySkippedPatchReasonCounts: AssistantWorkflowTraceReportCount[];
  memoryIntentWritePolicyMismatchedProfileFieldCounts: AssistantWorkflowTraceReportCount[];
  threadProfileWriteChangedFieldCounts: AssistantWorkflowTraceReportCount[];
  threadProfileWriteSourceCounts: AssistantWorkflowTraceReportCount[];
  threadProfileWriteReasonCounts: AssistantWorkflowTraceReportCount[];
  toolRuntimeBindingStatusCounts: AssistantWorkflowTraceReportCount[];
  toolRuntimeBindingAdapterCounts: AssistantWorkflowTraceReportCount[];
  toolRuntimeBindingPolicyMismatchCounts: AssistantWorkflowTraceReportCount[];
  effectiveToolSelectionModeCounts: AssistantWorkflowTraceReportCount[];
  effectiveToolSelectionReasonCounts: AssistantWorkflowTraceReportCount[];
  effectiveToolSelectionToolCounts: AssistantWorkflowTraceReportCount[];
  effectiveToolSelectionSegments: AssistantWorkflowTraceReportToolSelectionSegment[];
  toolCallCounts: AssistantWorkflowTraceReportCount[];
  tuningSignalCounts: AssistantWorkflowTraceReportTuningSignalCount[];
  suggestions: AssistantWorkflowTraceReportSuggestion[];
  rows: AssistantWorkflowTraceReportRow[];
};

export type AssistantWorkflowMemoryPatchReadinessStatus =
  | "ready"
  | "blocked"
  | "insufficient_evidence";

export type AssistantWorkflowMemoryPatchReadinessOptions = {
  /** Restrict evidence to trace rows emitted by these workflow ids. */
  workflowIds?: readonly string[] | null;
  /** Restrict evidence to trace rows emitted by these workflow versions. */
  workflowVersions?: readonly number[] | null;
  minEquivalentPatchCount?: number | null;
  minGuardedWorkflowWriteCount?: number | null;
  minWorkflowPatchWriteCount?: number | null;
  minWorkflowModePatchWriteCount?: number | null;
  minPatchDerivationCounts?: readonly AssistantWorkflowMemoryPatchDerivationReadinessRequirement[] | null;
};

export type AssistantWorkflowMemoryPatchDerivationReadinessRequirement = {
  key: string;
  minCount: number;
};

export type AssistantWorkflowMemoryPatchReadiness = {
  status: AssistantWorkflowMemoryPatchReadinessStatus;
  ready: boolean;
  workflowIds: string[];
  workflowVersions: number[];
  scopedRowCount: number;
  minEquivalentPatchCount: number;
  equivalentPatchCount: number;
  mismatchPatchCount: number;
  unknownPatchCount: number;
  totalPatchCount: number;
  guardedWorkflowWriteCount: number;
  workflowModePatchWriteCount: number;
  minWorkflowModePatchWriteCount: number;
  workflowPatchWriteCount: number;
  minWorkflowPatchWriteCount: number;
  guardedLegacyFallbackCount: number;
  patchDerivationCounts: AssistantWorkflowTraceReportCount[];
  requiredPatchDerivationCounts: AssistantWorkflowTraceReportCount[];
  mismatchedProfileFieldCounts: AssistantWorkflowTraceReportCount[];
  writeSourceCounts: AssistantWorkflowTraceReportCount[];
  writeReasonCounts: AssistantWorkflowTraceReportCount[];
  blockingReasons: string[];
};

export type AssistantWorkflowIntentMemoryPolicyReadinessStatus =
  | "ready"
  | "blocked"
  | "insufficient_evidence";

export type AssistantWorkflowIntentMemoryPolicyReadinessOptions = {
  /** Restrict evidence to trace rows emitted by these workflow ids. */
  workflowIds?: readonly string[] | null;
  /** Restrict evidence to trace rows emitted by these workflow versions. */
  workflowVersions?: readonly number[] | null;
  minObservedPolicyCount?: number | null;
  minEquivalentPolicyCount?: number | null;
  maxMismatchPolicyCount?: number | null;
  maxUnknownPolicyCount?: number | null;
  maxWriteNotAllowedCount?: number | null;
};

export type AssistantWorkflowIntentMemoryPolicyReadiness = {
  status: AssistantWorkflowIntentMemoryPolicyReadinessStatus;
  ready: boolean;
  workflowIds: string[];
  workflowVersions: number[];
  scopedRowCount: number;
  minObservedPolicyCount: number;
  minEquivalentPolicyCount: number;
  maxMismatchPolicyCount: number;
  maxUnknownPolicyCount: number;
  maxWriteNotAllowedCount: number;
  observedPolicyCount: number;
  equivalentPolicyCount: number;
  mismatchPolicyCount: number;
  unknownPolicyCount: number;
  writeNotAllowedCount: number;
  intentCounts: AssistantWorkflowTraceReportCount[];
  mismatchedProfileFieldCounts: AssistantWorkflowTraceReportCount[];
  skippedPatchReasonCounts: AssistantWorkflowTraceReportCount[];
  blockingReasons: string[];
};

export type AssistantWorkflowToolSelectionMetricReadinessStatus =
  | "ready_for_review"
  | "blocked"
  | "insufficient_evidence";

/**
 * Evidence requirements for actual tool sets delivered to a model provider.
 * The caller may scope the gate to one intent or exact trace segment before
 * reviewing a runtime policy change.
 */
export type AssistantWorkflowToolSelectionMetricReadinessOptions = {
  workflowIds?: readonly string[] | null;
  workflowVersions?: readonly number[] | null;
  workflowProfileKeys?: readonly string[] | null;
  authoritySources?: readonly string[] | null;
  intentIds?: readonly string[] | null;
  segmentKeys?: readonly string[] | null;
  schemaCostSource?: string | null;
  minSelectionCount?: number | null;
  maxQualityFlaggedSelectionCount?: number | null;
  maxErrorSelectionCount?: number | null;
  maxBadFeedbackSelectionCount?: number | null;
  maxUnavailableOutcomeSelectionCount?: number | null;
};

export type AssistantWorkflowToolSelectionMetricReadinessSegment =
  AssistantWorkflowTraceReportToolSelectionSegment & {
    qualityFlaggedSelectionCount: number;
    errorSelectionCount: number;
    badFeedbackSelectionCount: number;
    unavailableOutcomeSelectionCount: number;
    status: AssistantWorkflowToolSelectionMetricReadinessStatus;
    readyForReview: boolean;
    blockingReasons: string[];
  };

/**
 * A review-only gate for actual provider tool-selection evidence. A ready
 * segment is eligible for human policy review, not an automatic runtime
 * change. Older or incompatible schema-cost sources are reported separately.
 */
export type AssistantWorkflowToolSelectionMetricReadiness = {
  status: AssistantWorkflowToolSelectionMetricReadinessStatus;
  readyForReview: boolean;
  workflowIds: string[];
  workflowVersions: number[];
  workflowProfileKeys: string[];
  authoritySources: string[];
  intentIds: string[];
  segmentKeys: string[];
  requiredSchemaCostSource: string | null;
  minSelectionCount: number;
  maxQualityFlaggedSelectionCount: number;
  maxErrorSelectionCount: number;
  maxBadFeedbackSelectionCount: number;
  maxUnavailableOutcomeSelectionCount: number;
  evaluatedSelectionCount: number;
  readySegmentCount: number;
  blockedSegmentCount: number;
  insufficientEvidenceSegmentCount: number;
  ignoredSchemaCostSourceSegmentCount: number;
  ignoredSchemaCostSourceSelectionCount: number;
  ignoredSchemaCostSourceCounts: AssistantWorkflowTraceReportCount[];
  segments: AssistantWorkflowToolSelectionMetricReadinessSegment[];
  blockingReasons: string[];
};

export type AssistantWorkflowTraceReportRunReportExportOptions = {
  workflowId?: string | null;
  workflowVersion?: number | null;
};

export function buildAssistantWorkflowMemoryPatchReadiness(
  report: AssistantWorkflowTraceReport,
  options: AssistantWorkflowMemoryPatchReadinessOptions = {},
): AssistantWorkflowMemoryPatchReadiness {
  const workflowIds = normalizeStringScope(options.workflowIds);
  const workflowVersions = normalizeNumberScope(options.workflowVersions);
  const scopedRows = selectWorkflowScopedTraceRows(report.rows, workflowIds, workflowVersions);
  const scopedPatches = scopedRows.flatMap((row) => row.summary.memoryPatches);
  const minEquivalentPatchCount = normalizePositiveInt(options.minEquivalentPatchCount, 1);
  const minGuardedWorkflowWriteCount = normalizeNonNegativeInt(options.minGuardedWorkflowWriteCount, 0);
  const minWorkflowPatchWriteCount = normalizeNonNegativeInt(options.minWorkflowPatchWriteCount, 0);
  const minWorkflowModePatchWriteCount = normalizeNonNegativeInt(options.minWorkflowModePatchWriteCount, 0);
  const requiredPatchDerivationCounts = normalizePatchDerivationRequirements(options.minPatchDerivationCounts);
  const equivalenceCounts = buildStringCounts(scopedPatches.map(buildMemoryPatchEquivalenceKey));
  const derivationCounts = buildStringCounts(scopedPatches.map(buildMemoryPatchDerivationKey));
  const mismatchedProfileFieldCounts = buildStringCounts(
    scopedPatches.flatMap((patch) => patch.profilePatchMismatchedFields),
  );
  const writeSourceCounts = buildStringCounts(scopedPatches.map(buildMemoryPatchWriteSourceKey));
  const writeReasonCounts = buildStringCounts(scopedPatches.map(buildMemoryPatchWriteReasonKey));
  const equivalentPatchCount = findReportCount(equivalenceCounts, "equivalent");
  const mismatchPatchCount = findReportCount(equivalenceCounts, "mismatch");
  const unknownPatchCount = findReportCount(equivalenceCounts, "unknown");
  const totalPatchCount = equivalenceCounts.reduce((sum, item) => sum + item.count, 0);
  const guardedWorkflowWriteCount = findReportCount(writeSourceCounts, "guarded:workflow_patch");
  const workflowModePatchWriteCount = findReportCount(writeSourceCounts, "workflow:workflow_patch");
  const workflowPatchWriteCount = sumWriteSourceCountsBySource(writeSourceCounts, "workflow_patch");
  const guardedLegacyFallbackCount = findReportCount(writeSourceCounts, "guarded:legacy_fallback");
  const blockingReasons: string[] = [];

  if (equivalentPatchCount < minEquivalentPatchCount) {
    blockingReasons.push(`equivalent_patch_count_below_minimum:${equivalentPatchCount}/${minEquivalentPatchCount}`);
  }
  if (mismatchPatchCount > 0) {
    blockingReasons.push(`profile_patch_mismatch:${mismatchPatchCount}`);
  }
  if (unknownPatchCount > 0) {
    blockingReasons.push(`profile_patch_equivalence_unknown:${unknownPatchCount}`);
  }
  if (guardedLegacyFallbackCount > 0) {
    blockingReasons.push(`guarded_legacy_fallback:${guardedLegacyFallbackCount}`);
  }
  if (guardedWorkflowWriteCount < minGuardedWorkflowWriteCount) {
    blockingReasons.push(`guarded_workflow_write_count_below_minimum:${guardedWorkflowWriteCount}/${minGuardedWorkflowWriteCount}`);
  }
  if (workflowPatchWriteCount < minWorkflowPatchWriteCount) {
    blockingReasons.push(`workflow_patch_write_count_below_minimum:${workflowPatchWriteCount}/${minWorkflowPatchWriteCount}`);
  }
  if (workflowModePatchWriteCount < minWorkflowModePatchWriteCount) {
    blockingReasons.push(`workflow_mode_patch_write_count_below_minimum:${workflowModePatchWriteCount}/${minWorkflowModePatchWriteCount}`);
  }
  for (const requirement of requiredPatchDerivationCounts) {
    const observedCount = findReportCount(derivationCounts, requirement.key);
    if (observedCount < requirement.count) {
      blockingReasons.push(`patch_derivation_count_below_minimum:${requirement.key}:${observedCount}/${requirement.count}`);
    }
  }

  const status: AssistantWorkflowMemoryPatchReadinessStatus =
    mismatchPatchCount > 0 || unknownPatchCount > 0 || guardedLegacyFallbackCount > 0
      ? "blocked"
      : blockingReasons.length > 0
        ? "insufficient_evidence"
        : "ready";

  return {
    status,
    ready: status === "ready",
    workflowIds,
    workflowVersions,
    scopedRowCount: scopedRows.length,
    minEquivalentPatchCount,
    equivalentPatchCount,
    mismatchPatchCount,
    unknownPatchCount,
    totalPatchCount,
    guardedWorkflowWriteCount,
    workflowModePatchWriteCount,
    minWorkflowModePatchWriteCount,
    workflowPatchWriteCount,
    minWorkflowPatchWriteCount,
    guardedLegacyFallbackCount,
    patchDerivationCounts: derivationCounts,
    requiredPatchDerivationCounts,
    mismatchedProfileFieldCounts,
    writeSourceCounts,
    writeReasonCounts,
    blockingReasons,
  };
}

export function buildAssistantWorkflowIntentMemoryPolicyReadiness(
  report: AssistantWorkflowTraceReport,
  options: AssistantWorkflowIntentMemoryPolicyReadinessOptions = {},
): AssistantWorkflowIntentMemoryPolicyReadiness {
  const workflowIds = normalizeStringScope(options.workflowIds);
  const workflowVersions = normalizeNumberScope(options.workflowVersions);
  const scopedRows = selectWorkflowScopedTraceRows(report.rows, workflowIds, workflowVersions);
  const scopedIntentPolicies = scopedRows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) =>
    patch.intentWritePolicy ? [patch.intentWritePolicy] : []
  ));
  const minObservedPolicyCount = normalizePositiveInt(options.minObservedPolicyCount, 3);
  const minEquivalentPolicyCount = options.minEquivalentPolicyCount === null || options.minEquivalentPolicyCount === undefined
    ? minObservedPolicyCount
    : normalizeNonNegativeInt(options.minEquivalentPolicyCount, minObservedPolicyCount);
  const maxMismatchPolicyCount = normalizeNonNegativeInt(options.maxMismatchPolicyCount, 0);
  const maxUnknownPolicyCount = normalizeNonNegativeInt(options.maxUnknownPolicyCount, 0);
  const maxWriteNotAllowedCount = normalizeNonNegativeInt(options.maxWriteNotAllowedCount, 0);
  const intentCounts = buildStringCounts(scopedIntentPolicies.flatMap((policy) => policy.intentId ? [policy.intentId] : []));
  const equivalenceCounts = buildStringCounts(scopedIntentPolicies.map(buildMemoryPatchEquivalenceKey));
  const skippedPatchReasonCounts = buildStringCounts(
    scopedIntentPolicies.flatMap((policy) => policy.skippedPatches.map(buildMemorySkippedPatchReasonKey)),
  );
  const mismatchedProfileFieldCounts = buildStringCounts(
    scopedIntentPolicies.flatMap((policy) => policy.profilePatchMismatchedFields),
  );
  const equivalentPolicyCount = findReportCount(equivalenceCounts, "equivalent");
  const mismatchPolicyCount = findReportCount(equivalenceCounts, "mismatch");
  const unknownPolicyCount = findReportCount(equivalenceCounts, "unknown");
  const observedPolicyCount = equivalenceCounts
    .reduce((sum, item) => sum + item.count, 0);
  const writeNotAllowedCount = skippedPatchReasonCounts
    .filter((item) => item.key.endsWith(":write-not-allowed"))
    .reduce((sum, item) => sum + item.count, 0);
  const blockingReasons: string[] = [];

  if (mismatchPolicyCount > maxMismatchPolicyCount) {
    blockingReasons.push(`intent_write_policy_mismatch:${mismatchPolicyCount}/${maxMismatchPolicyCount}`);
  }
  if (unknownPolicyCount > maxUnknownPolicyCount) {
    blockingReasons.push(`intent_write_policy_equivalence_unknown:${unknownPolicyCount}/${maxUnknownPolicyCount}`);
  }
  if (writeNotAllowedCount > maxWriteNotAllowedCount) {
    blockingReasons.push(`intent_write_policy_write_not_allowed:${writeNotAllowedCount}/${maxWriteNotAllowedCount}`);
  }
  if (observedPolicyCount < minObservedPolicyCount) {
    blockingReasons.push(`intent_write_policy_observed_count_below_minimum:${observedPolicyCount}/${minObservedPolicyCount}`);
  }
  if (equivalentPolicyCount < minEquivalentPolicyCount) {
    blockingReasons.push(`intent_write_policy_equivalent_count_below_minimum:${equivalentPolicyCount}/${minEquivalentPolicyCount}`);
  }

  const hardBlock = mismatchPolicyCount > maxMismatchPolicyCount ||
    unknownPolicyCount > maxUnknownPolicyCount ||
    writeNotAllowedCount > maxWriteNotAllowedCount;
  const status: AssistantWorkflowIntentMemoryPolicyReadinessStatus =
    hardBlock
      ? "blocked"
      : blockingReasons.length > 0
        ? "insufficient_evidence"
        : "ready";

  return {
    status,
    ready: status === "ready",
    workflowIds,
    workflowVersions,
    scopedRowCount: scopedRows.length,
    minObservedPolicyCount,
    minEquivalentPolicyCount,
    maxMismatchPolicyCount,
    maxUnknownPolicyCount,
    maxWriteNotAllowedCount,
    observedPolicyCount,
    equivalentPolicyCount,
    mismatchPolicyCount,
    unknownPolicyCount,
    writeNotAllowedCount,
    intentCounts,
    mismatchedProfileFieldCounts,
    skippedPatchReasonCounts,
    blockingReasons,
  };
}

export function buildAssistantWorkflowToolSelectionMetricReadiness(
  report: AssistantWorkflowTraceReport,
  options: AssistantWorkflowToolSelectionMetricReadinessOptions = {},
): AssistantWorkflowToolSelectionMetricReadiness {
  const workflowIds = normalizeStringScope(options.workflowIds);
  const workflowVersions = normalizeNumberScope(options.workflowVersions);
  const workflowProfileKeys = normalizeStringScope(options.workflowProfileKeys);
  const authoritySources = normalizeStringScope(options.authoritySources);
  const intentIds = normalizeStringScope(options.intentIds);
  const segmentKeys = normalizeStringScope(options.segmentKeys);
  const requiredSchemaCostSource = normalizeOptionalString(options.schemaCostSource);
  const minSelectionCount = normalizePositiveInt(options.minSelectionCount, 3);
  const maxQualityFlaggedSelectionCount = normalizeNonNegativeInt(options.maxQualityFlaggedSelectionCount, 0);
  const maxErrorSelectionCount = normalizeNonNegativeInt(options.maxErrorSelectionCount, 0);
  const maxBadFeedbackSelectionCount = normalizeNonNegativeInt(options.maxBadFeedbackSelectionCount, 0);
  const maxUnavailableOutcomeSelectionCount = normalizeNonNegativeInt(options.maxUnavailableOutcomeSelectionCount, 0);
  const scopedSegments = report.effectiveToolSelectionSegments.filter((segment) =>
    isToolSelectionMetricSegmentInScope(
      segment,
      workflowIds,
      workflowVersions,
      workflowProfileKeys,
      authoritySources,
      intentIds,
      segmentKeys,
    )
  );
  const ignoredSchemaCostSourceSegments = requiredSchemaCostSource
    ? scopedSegments.filter((segment) => segment.schemaCostSource !== requiredSchemaCostSource)
    : [];
  const evaluatedSegments = requiredSchemaCostSource
    ? scopedSegments.filter((segment) => segment.schemaCostSource === requiredSchemaCostSource)
    : scopedSegments;
  const evidenceCounters = buildToolSelectionMetricEvidenceCounters(report.rows);
  const segments = evaluatedSegments.map((segment) => {
    const counters = evidenceCounters.get(segment.segmentKey) ?? EMPTY_TOOL_SELECTION_METRIC_EVIDENCE_COUNTERS;
    const blockingReasons: string[] = [];
    if (counters.qualityFlaggedSelectionCount > maxQualityFlaggedSelectionCount) {
      blockingReasons.push(
        `quality_flagged_selection_count_exceeds_maximum:${counters.qualityFlaggedSelectionCount}/${maxQualityFlaggedSelectionCount}`,
      );
    }
    if (counters.errorSelectionCount > maxErrorSelectionCount) {
      blockingReasons.push(
        `error_selection_count_exceeds_maximum:${counters.errorSelectionCount}/${maxErrorSelectionCount}`,
      );
    }
    if (counters.badFeedbackSelectionCount > maxBadFeedbackSelectionCount) {
      blockingReasons.push(
        `bad_feedback_selection_count_exceeds_maximum:${counters.badFeedbackSelectionCount}/${maxBadFeedbackSelectionCount}`,
      );
    }
    if (counters.unavailableOutcomeSelectionCount > maxUnavailableOutcomeSelectionCount) {
      blockingReasons.push(
        `unavailable_outcome_selection_count_exceeds_maximum:${counters.unavailableOutcomeSelectionCount}/${maxUnavailableOutcomeSelectionCount}`,
      );
    }
    if (segment.selectionCount < minSelectionCount) {
      blockingReasons.push(`selection_count_below_minimum:${segment.selectionCount}/${minSelectionCount}`);
    }
    const hardBlock = counters.qualityFlaggedSelectionCount > maxQualityFlaggedSelectionCount ||
      counters.errorSelectionCount > maxErrorSelectionCount ||
      counters.badFeedbackSelectionCount > maxBadFeedbackSelectionCount ||
      counters.unavailableOutcomeSelectionCount > maxUnavailableOutcomeSelectionCount;
    const status: AssistantWorkflowToolSelectionMetricReadinessStatus = hardBlock
      ? "blocked"
      : segment.selectionCount < minSelectionCount
        ? "insufficient_evidence"
        : "ready_for_review";
    return {
      ...segment,
      ...counters,
      status,
      readyForReview: status === "ready_for_review",
      blockingReasons,
    };
  });
  const readySegmentCount = segments.filter((segment) => segment.status === "ready_for_review").length;
  const blockedSegmentCount = segments.filter((segment) => segment.status === "blocked").length;
  const insufficientEvidenceSegmentCount = segments.filter((segment) => segment.status === "insufficient_evidence").length;
  const blockingReasons: string[] = [];
  if (!segments.length) {
    blockingReasons.push("no_tool_selection_segments_in_scope");
  }
  if (blockedSegmentCount > 0) {
    blockingReasons.push(`blocked_segments:${blockedSegmentCount}`);
  }
  if (insufficientEvidenceSegmentCount > 0) {
    blockingReasons.push(`insufficient_evidence_segments:${insufficientEvidenceSegmentCount}`);
  }
  const status: AssistantWorkflowToolSelectionMetricReadinessStatus = blockedSegmentCount > 0
    ? "blocked"
    : !segments.length || insufficientEvidenceSegmentCount > 0
      ? "insufficient_evidence"
      : "ready_for_review";

  return {
    status,
    readyForReview: status === "ready_for_review",
    workflowIds,
    workflowVersions,
    workflowProfileKeys,
    authoritySources,
    intentIds,
    segmentKeys,
    requiredSchemaCostSource,
    minSelectionCount,
    maxQualityFlaggedSelectionCount,
    maxErrorSelectionCount,
    maxBadFeedbackSelectionCount,
    maxUnavailableOutcomeSelectionCount,
    evaluatedSelectionCount: segments.reduce((sum, segment) => sum + segment.selectionCount, 0),
    readySegmentCount,
    blockedSegmentCount,
    insufficientEvidenceSegmentCount,
    ignoredSchemaCostSourceSegmentCount: ignoredSchemaCostSourceSegments.length,
    ignoredSchemaCostSourceSelectionCount: ignoredSchemaCostSourceSegments
      .reduce((sum, segment) => sum + segment.selectionCount, 0),
    ignoredSchemaCostSourceCounts: buildStringCounts(
      ignoredSchemaCostSourceSegments.map((segment) => segment.schemaCostSource ?? "unknown"),
    ),
    segments,
    blockingReasons,
  };
}

export function buildAssistantWorkflowTraceReport(
  sourceRows: readonly AssistantWorkflowTraceReportSourceRow[],
  options: AssistantWorkflowTraceReportOptions = {},
): AssistantWorkflowTraceReport {
  const directRouteDefinitionLookup = buildDirectRouteDefinitionLookup(options.workflow ?? null);
  const workflowIds = normalizeStringScope(options.workflowIds);
  const workflowVersions = normalizeNumberScope(options.workflowVersions);
  const allRows = sourceRows.map((row) => {
    const summary = buildAssistantWorkflowTraceSummary(row.traceEvents);
    const tuningSignals = collectAssistantWorkflowTraceTuningSignals(summary);
    return {
      debugId: normalizeNullableString(row.debugId),
      requestId: row.requestId,
      threadId: normalizeNullableString(row.threadId),
      userId: normalizeNullableString(row.userId),
      provider: normalizeNullableString(row.provider),
      model: normalizeNullableString(row.model),
      feedback: normalizeNullableString(row.feedback),
      feedbackAt: normalizeNullableString(row.feedbackAt),
      createdAt: normalizeNullableString(row.createdAt),
      summary,
      evalCandidate: buildAssistantWorkflowTraceEvalCandidate(summary),
      tuningSignals,
      directRouteStrategies: buildDirectRouteStrategySummaries(summary, directRouteDefinitionLookup),
    };
  });

  const workflowScopedRows = selectWorkflowScopedTraceRows(allRows, workflowIds, workflowVersions);
  const rows = options.onlyInteresting === true
    ? workflowScopedRows.filter((row) => isInterestingReportRow(row))
    : workflowScopedRows;

  return {
    generatedAt: new Date().toISOString(),
    workflowIds,
    workflowVersions,
    rowCount: rows.length,
    scopedSourceRowCount: workflowScopedRows.length,
    sourceRowCount: sourceRows.length,
    evalCandidateCount: rows.filter((row) => row.evalCandidate !== null).length,
    interestingRowCount: rows.filter(isInterestingReportRow).length,
    qualityFlaggedRowCount: rows.filter((row) => row.summary.quality.flagged).length,
    errorRowCount: rows.filter((row) => row.summary.errorStages.length > 0).length,
    feedbackCounts: buildStringCounts(rows.map((row) => row.feedback ?? "none")),
    intentCounts: buildStringCounts(rows.map((row) => row.summary.classifier?.intent ?? row.summary.workflow?.intent ?? "unknown")),
    authorityCounts: buildStringCounts(rows.map((row) => row.summary.workflow?.authority?.source ?? "none")),
    authorityReasonCounts: buildStringCounts(rows.map((row) => row.summary.workflow?.authority?.reason ?? "none")),
    workflowSelectionOptionalToolModeCounts: buildStringCounts(
      rows.map((row) => row.summary.workflow?.workflowSelectionOptionalToolMode ?? "none"),
    ),
    workflowSelectionExcludedOptionalToolCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.workflow?.workflowSelectionExcludedOptionalTools ?? []),
    ),
    workflowSelectionActiveProfileCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.workflow?.workflowSelectionActiveProfileIds ?? []),
    ),
    workflowSelectionProfileToolCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.workflow?.workflowSelectionProfileTools ?? []),
    ),
    activePlanningStepProfileCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.workflow?.plan?.activePlanningStepProfileIds ?? []),
    ),
    profileStepCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.workflow?.plan?.profileStepIds ?? []),
    ),
    outcomeKindCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.outcomes.map((outcome) => outcome.kind)),
    ),
    handledOutcomeKindCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.outcomes.filter((outcome) => outcome.handled).map((outcome) => outcome.kind)),
    ),
    clarificationComparisonMatchedCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.clarificationComparisons
          .filter((comparison) => comparison.matched === true)
          .map(buildClarificationComparisonMatchedKey),
      ),
    ),
    clarificationComparisonMissingRuleCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.clarificationComparisons.flatMap((comparison) => comparison.missingExpectedRuleIds),
      ),
    ),
    clarificationComparisonUnexpectedRuleCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.clarificationComparisons
          .map((comparison) => comparison.unexpectedObservedRuleId)
          .filter((ruleId): ruleId is string => ruleId !== null),
      ),
    ),
    directRoutePolicyEnabledCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.directRoutePolicies
          .filter((policy) => policy.enabled === true)
          .map((policy) => policy.route ?? "unknown"),
      ),
    ),
    directRoutePolicyDisabledReasonCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.directRoutePolicies
          .filter((policy) => policy.enabled === false)
          .map(buildDirectRoutePolicyDisabledReasonKey),
      ),
    ),
    directRouteGapReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.directRouteGaps.map(buildDirectRouteGapReasonKey)),
    ),
    directRouteObservedStrategyCounts: buildStringCounts(
      rows.flatMap((row) => row.directRouteStrategies.map(buildDirectRouteStrategyKey)),
    ),
    directRouteUndeclaredStrategyCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.directRouteStrategies
          .filter((strategy) => strategy.declared === false)
          .map(buildDirectRouteStrategyKey),
      ),
    ),
    directRouteDoneCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.directRoutes
          .filter((route) => route.outcome === "done")
          .map((route) => route.route),
      ),
    ),
    directRouteRecoveredCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.directRoutes
          .filter((route) => route.outcome === "recovered")
          .map((route) => route.route),
      ),
    ),
    directRouteErrorCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.directRoutes
          .filter((route) => route.outcome === "error")
          .map((route) => route.route),
      ),
    ),
    directRouteSkipReasonCounts: buildStringCounts(
      rows.flatMap((row) =>
        row.summary.directRoutes
          .filter((route) => route.outcome === "skip")
          .map(buildDirectRouteSkipReasonKey)
          .filter((key): key is string => key !== null),
      ),
    ),
    memoryChangedSlotCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) => patch.changedSlots)),
    ),
    memoryChangedProfileFieldCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) => patch.changedProfileFields)),
    ),
    memorySkippedPatchReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) => patch.skippedPatches.map(buildMemorySkippedPatchReasonKey))),
    ),
    memoryPatchEquivalenceCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.map(buildMemoryPatchEquivalenceKey)),
    ),
    memoryPatchDerivationCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.map(buildMemoryPatchDerivationKey)),
    ),
    memoryPatchMismatchedProfileFieldCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) => patch.profilePatchMismatchedFields)),
    ),
    memoryPatchWriteSourceCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.map(buildMemoryPatchWriteSourceKey)),
    ),
    memoryPatchWriteReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.map(buildMemoryPatchWriteReasonKey)),
    ),
    memoryIntentWritePolicyIntentCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) =>
        patch.intentWritePolicy?.intentId ? [patch.intentWritePolicy.intentId] : [],
      )),
    ),
    memoryIntentWritePolicyEquivalenceCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) =>
        patch.intentWritePolicy ? [buildMemoryPatchEquivalenceKey(patch.intentWritePolicy)] : [],
      )),
    ),
    memoryIntentWritePolicySkippedPatchReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) =>
        patch.intentWritePolicy?.skippedPatches.map(buildMemorySkippedPatchReasonKey) ?? [],
      )),
    ),
    memoryIntentWritePolicyMismatchedProfileFieldCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.memoryPatches.flatMap((patch) =>
        patch.intentWritePolicy?.profilePatchMismatchedFields ?? [],
      )),
    ),
    threadProfileWriteChangedFieldCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.threadProfileWrites.flatMap((write) => write.changedFields)),
    ),
    threadProfileWriteSourceCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.threadProfileWrites.map(buildThreadProfileWriteSourceKey)),
    ),
    threadProfileWriteReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.threadProfileWrites.map(buildThreadProfileWriteReasonKey)),
    ),
    toolRuntimeBindingStatusCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.toolRuntimeBindings.map((binding) => binding.status ?? "unknown")),
    ),
    toolRuntimeBindingAdapterCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.toolRuntimeBindings.map((binding) => binding.runtimeAdapterId ?? "unknown")),
    ),
    toolRuntimeBindingPolicyMismatchCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.toolRuntimeBindings.flatMap((binding) =>
        binding.policyMismatchFields.map((field) => `${binding.toolName ?? "unknown"}:${field}`),
      )),
    ),
    effectiveToolSelectionModeCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.toolSelections.map((selection) => selection.mode ?? "unknown")),
    ),
    effectiveToolSelectionReasonCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.toolSelections.map((selection) => selection.reason ?? "unknown")),
    ),
    effectiveToolSelectionToolCounts: buildStringCounts(
      rows.flatMap((row) => row.summary.toolSelections.flatMap((selection) => selection.toolNames)),
    ),
    effectiveToolSelectionSegments: buildEffectiveToolSelectionSegments(rows),
    toolCallCounts: buildStringCounts(rows.flatMap((row) => row.summary.toolCallNames)),
    tuningSignalCounts: buildTuningSignalCounts(rows.flatMap((row) => row.tuningSignals)),
    suggestions: buildReportSuggestions(rows),
    rows,
  };
}

export function buildAssistantWorkflowSerializedRunReportFromTraceReportRow(
  row: AssistantWorkflowTraceReportRow,
  options: AssistantWorkflowTraceReportRunReportExportOptions = {},
): AssistantWorkflowSerializedRunReport {
  const signals = buildTraceDerivedRunEvaluationSignals(row);
  const warningCount = signals.filter((signal) => signal.severity === "warning").length;
  const status = buildTraceDerivedRunReportStatus(row, warningCount);
  const intent = row.summary.classifier?.intent ?? row.summary.workflow?.intent ?? null;
  const handledOutcome = row.summary.handledOutcome;
  const outcomeKind = handledOutcome?.kind ?? "trace_summary";
  const outcomeHandled = handledOutcome?.handled ?? status !== "not_handled";
  const outcomeReason = handledOutcome?.reason ?? buildTraceDerivedOutcomeReason(row, status);
  const directRouteDoneRoutes = row.summary.directRoutes
    .filter((route) => route.outcome === "done")
    .map((route) => route.route);
  const directRouteRecoveredRoutes = row.summary.directRoutes
    .filter((route) => route.outcome === "recovered")
    .map((route) => route.route);
  const directRouteErrorRoutes = row.summary.directRoutes
    .filter((route) => route.outcome === "error")
    .map((route) => route.route);
  const directRouteSkipReasons = row.summary.directRoutes
    .filter((route) => route.outcome === "skip")
    .map(buildDirectRouteSkipReasonKey)
    .filter((key): key is string => key !== null);
  const directRoutePolicyEnabledRoutes = row.summary.directRoutePolicies
    .filter((policy) => policy.enabled === true)
    .map((policy) => policy.route ?? "unknown");
  const directRoutePolicyDisabledReasons = row.summary.directRoutePolicies
    .filter((policy) => policy.enabled === false)
    .map(buildDirectRoutePolicyDisabledReasonKey);
  const directRouteGapReasons = row.summary.directRouteGaps.map(buildDirectRouteGapReasonKey);
  const directRouteObservedStrategies = row.directRouteStrategies.map(buildDirectRouteStrategyKey);
  const directRouteUndeclaredStrategies = row.directRouteStrategies
    .filter((strategy) => strategy.declared === false)
    .map(buildDirectRouteStrategyKey);
  const memoryChangedSlots = uniqueStrings(row.summary.memoryPatches.flatMap((patch) => patch.changedSlots));
  const memoryChangedProfileFields = uniqueStrings(
    row.summary.memoryPatches.flatMap((patch) => patch.changedProfileFields),
  );
  const memorySkippedPatchReasons = row.summary.memoryPatches.flatMap((patch) =>
    patch.skippedPatches.map(buildMemorySkippedPatchReasonKey)
  );
  const memoryPatchEquivalence = uniqueStrings(row.summary.memoryPatches.map(buildMemoryPatchEquivalenceKey));
  const memoryPatchDerivations = uniqueStrings(row.summary.memoryPatches.map(buildMemoryPatchDerivationKey));
  const memoryPatchMismatchedProfileFields = uniqueStrings(
    row.summary.memoryPatches.flatMap((patch) => patch.profilePatchMismatchedFields),
  );
  const memoryPatchWriteSources = uniqueStrings(row.summary.memoryPatches.map(buildMemoryPatchWriteSourceKey));
  const memoryPatchWriteReasons = uniqueStrings(row.summary.memoryPatches.map(buildMemoryPatchWriteReasonKey));
  const threadProfileWriteSources = uniqueStrings(row.summary.threadProfileWrites.map(buildThreadProfileWriteSourceKey));
  const threadProfileWriteReasons = uniqueStrings(row.summary.threadProfileWrites.map(buildThreadProfileWriteReasonKey));
  const threadProfileWriteChangedFields = uniqueStrings(
    row.summary.threadProfileWrites.flatMap((write) => write.changedFields),
  );
  const clarificationMatchedRules = row.summary.clarificationComparisons
    .filter((comparison) => comparison.matched === true)
    .map(buildClarificationComparisonMatchedKey);
  const clarificationMissingRules = row.summary.clarificationComparisons.flatMap((comparison) =>
    comparison.missingExpectedRuleIds
  );
  const clarificationUnexpectedRules = row.summary.clarificationComparisons
    .map((comparison) => comparison.unexpectedObservedRuleId)
    .filter((ruleId): ruleId is string => ruleId !== null);
  const toolResultStatus = row.summary.errorStages.length > 0
    ? "failed"
    : row.summary.toolCalls.length > 0
      ? "complete"
      : null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_RUN_REPORT_JSON_SCHEMA_VERSION,
    workflowId: normalizeRunReportWorkflowId(options.workflowId),
    workflowVersion: normalizeRunReportWorkflowVersion(options.workflowVersion),
    status,
    run: {
      source: "trace_report",
      requestId: row.requestId,
      debugId: row.debugId,
      threadId: row.threadId,
      createdAt: row.createdAt,
      status: status === "not_handled" ? "blocked" : status === "failed" ? "partial" : "ready",
      decision: {
        intent,
        presentation: row.summary.classifier?.presentation ?? row.summary.workflow?.effectivePresentation ?? null,
        confidence: row.summary.classifier?.confidence ?? null,
        toolsToExpose: row.summary.classifier?.toolsToExpose ?? [],
        plan: row.summary.workflow?.plan ?? null,
        authority: row.summary.workflow?.authority ?? null,
      },
      toolInvocationQueue: {
        invocationCount: row.summary.toolCalls.length,
        toolNames: row.summary.toolCallNames,
      },
      directRoutes: row.summary.directRoutes.map((route) => ({
        route: route.route,
        outcome: route.outcome,
        reason: route.reason ?? null,
        strategy: route.strategy ?? null,
        topic: route.topic ?? null,
        tool: route.tool ?? null,
        mode: route.mode ?? null,
        handled: route.handled ?? null,
        contentChars: route.contentChars ?? null,
        tookMs: route.tookMs ?? null,
      })),
      directRoutePolicies: row.summary.directRoutePolicies.map((policy) => ({
        intent: policy.intent ?? null,
        route: policy.route ?? null,
        enabled: policy.enabled ?? null,
        reason: policy.reason ?? null,
        policyRouteIds: policy.policyRouteIds,
      })),
      directRouteGaps: row.summary.directRouteGaps.map((gap) => ({
        handlerId: gap.handlerId ?? null,
        layer: gap.layer ?? null,
        route: gap.route ?? null,
        reason: gap.reason ?? null,
      })),
      directRouteStrategies: row.directRouteStrategies.map((strategy) => ({
        route: strategy.route,
        strategy: strategy.strategy,
        definitionRouteId: strategy.definitionRouteId,
        declared: strategy.declared,
        status: strategy.status,
      })),
      memoryPatches: row.summary.memoryPatches.map((patch) => ({
        changedSlots: patch.changedSlots,
        changedProfileFields: patch.changedProfileFields,
        appliedPatchCount: patch.appliedPatchCount,
        skippedPatchCount: patch.skippedPatchCount,
        appliedPatches: patch.appliedPatches.map((appliedPatch) => ({ ...appliedPatch })),
        skippedPatches: patch.skippedPatches.map((skippedPatch) => ({ ...skippedPatch })),
        profilePatchEquivalent: patch.profilePatchEquivalent,
        profilePatchComparedFields: patch.profilePatchComparedFields,
        profilePatchMismatchedFields: patch.profilePatchMismatchedFields,
        patchDerivation: patch.patchDerivation,
        profileWriteMode: patch.profileWriteMode,
        profileWriteSource: patch.profileWriteSource,
        profileWriteReason: patch.profileWriteReason,
        intentWritePolicy: patch.intentWritePolicy ? {
          intentId: patch.intentWritePolicy.intentId,
          writeSlots: patch.intentWritePolicy.writeSlots,
          missingMemorySlots: patch.intentWritePolicy.missingMemorySlots,
          changedSlots: patch.intentWritePolicy.changedSlots,
          appliedPatchCount: patch.intentWritePolicy.appliedPatchCount,
          skippedPatchCount: patch.intentWritePolicy.skippedPatchCount,
          skippedPatches: patch.intentWritePolicy.skippedPatches.map((skippedPatch) => ({ ...skippedPatch })),
          profilePatchEquivalent: patch.intentWritePolicy.profilePatchEquivalent,
          profilePatchComparedFields: patch.intentWritePolicy.profilePatchComparedFields,
          profilePatchMismatchedFields: patch.intentWritePolicy.profilePatchMismatchedFields,
        } : null,
      })),
      threadProfileWrites: row.summary.threadProfileWrites.map((write) => ({
        changed: write.changed,
        changedFields: write.changedFields,
        writeMode: write.writeMode,
        writeSource: write.writeSource,
        writeReason: write.writeReason,
      })),
      outcomes: row.summary.outcomes.map((outcome) => ({
        kind: outcome.kind,
        handled: outcome.handled,
        contentChars: outcome.contentChars ?? null,
        reason: outcome.reason ?? null,
        delivery: outcome.delivery ?? null,
        artifactKind: outcome.artifactKind ?? null,
        route: outcome.route ?? null,
        source: outcome.source ?? null,
        layer: outcome.layer ?? null,
        skipEvent: outcome.skipEvent ?? null,
        mode: outcome.mode ?? null,
        submode: outcome.submode ?? null,
        tool: outcome.tool ?? null,
        ruleId: outcome.ruleId ?? null,
        streamed: outcome.streamed ?? null,
      })),
      clarificationComparisons: row.summary.clarificationComparisons.map((comparison) => ({
        intent: comparison.intent ?? null,
        expectedRuleIds: comparison.expectedRuleIds,
        expectedBlockingRuleIds: comparison.expectedBlockingRuleIds,
        expectedSuggestedRuleIds: comparison.expectedSuggestedRuleIds,
        produced: comparison.produced ?? null,
        observedRuleId: comparison.observedRuleId ?? null,
        equivalentRuleIds: comparison.equivalentRuleIds,
        matched: comparison.matched ?? null,
        missingExpectedRuleIds: comparison.missingExpectedRuleIds,
        unexpectedObservedRuleId: comparison.unexpectedObservedRuleId ?? null,
        source: comparison.source ?? null,
        layer: comparison.layer ?? null,
        reason: comparison.reason ?? null,
      })),
    },
    toolExecution: toolResultStatus === null
      ? null
      : {
          status: toolResultStatus,
          totalInvocations: row.summary.toolCalls.length,
          successCount: row.summary.toolCalls.filter((call) => call.success).length,
          errorCount: row.summary.toolCalls.filter((call) => !call.success).length,
        },
    outcome: {
      kind: outcomeKind,
      handled: outcomeHandled,
      reason: outcomeReason,
      delivery: handledOutcome?.delivery ?? null,
      artifactKind: handledOutcome?.artifactKind ?? null,
      route: handledOutcome?.route ?? null,
      contentChars: handledOutcome?.contentChars ?? null,
      source: handledOutcome?.source ?? "trace_summary",
      layer: handledOutcome?.layer ?? null,
      mode: handledOutcome?.mode ?? null,
      submode: handledOutcome?.submode ?? null,
      tool: handledOutcome?.tool ?? null,
      ruleId: handledOutcome?.ruleId ?? null,
      streamed: handledOutcome?.streamed ?? null,
      qualityFlagged: row.summary.quality.flagged,
      feedback: row.feedback,
    },
    evaluation: {
      workflowId: normalizeRunReportWorkflowId(options.workflowId),
      workflowVersion: normalizeRunReportWorkflowVersion(options.workflowVersion),
      status,
      intent,
      outcomeKind,
      handled: outcomeHandled,
      toolResultStatus,
      readyToolCount: row.summary.workflow?.workflowSelectionCandidateTools.length ?? 0,
      invokedToolCount: row.summary.toolCalls.length,
      activePlanningStepProfileIds: row.summary.workflow?.plan?.activePlanningStepProfileIds ?? [],
      profileStepIds: row.summary.workflow?.plan?.profileStepIds ?? [],
      directRouteDoneRoutes,
      directRouteRecoveredRoutes,
      directRouteErrorRoutes,
      directRouteSkipReasons,
      directRoutePolicyEnabledRoutes,
      directRoutePolicyDisabledReasons,
      directRouteGapReasons,
      directRouteObservedStrategies,
      directRouteUndeclaredStrategies,
      memoryChangedSlots,
      memoryChangedProfileFields,
      memorySkippedPatchReasons,
      memoryPatchEquivalence,
      memoryPatchDerivations,
      memoryPatchMismatchedProfileFields,
      memoryPatchWriteSources,
      memoryPatchWriteReasons,
      threadProfileWriteSources,
      threadProfileWriteReasons,
      threadProfileWriteChangedFields,
      clarificationMatchedRules,
      clarificationMissingRules,
      clarificationUnexpectedRules,
      signalCount: signals.length,
      warningCount,
      signals,
    },
  };
}

export function buildAssistantWorkflowSerializedRunReportsFromTraceReport(
  report: AssistantWorkflowTraceReport,
  options: AssistantWorkflowTraceReportRunReportExportOptions = {},
): AssistantWorkflowSerializedRunReport[] {
  return report.rows.map((row) => buildAssistantWorkflowSerializedRunReportFromTraceReportRow(row, options));
}

function isInterestingReportRow(row: AssistantWorkflowTraceReportRow): boolean {
  return row.feedback === "bad" ||
    row.summary.quality.flagged ||
    row.summary.errorStages.length > 0 ||
    row.tuningSignals.some((signal) => signal.severity === "warning");
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowTraceReportCount[] {
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

function buildEffectiveToolSelectionSegments(
  rows: readonly AssistantWorkflowTraceReportRow[],
): AssistantWorkflowTraceReportToolSelectionSegment[] {
  type Aggregate = Omit<AssistantWorkflowTraceReportToolSelectionSegment,
    "averageToolCount" | "averageTotalToolCount" | "averageSchemaChars" | "averageSavedChars">;
  const aggregates = new Map<string, Aggregate>();

  for (const row of rows) {
    const workflowId = row.summary.workflow?.workflowId ?? null;
    const workflowVersion = row.summary.workflow?.workflowVersion ?? null;
    const intentId = row.summary.classifier?.intent ?? row.summary.workflow?.intent ?? "unknown";
    const workflowProfileKey = buildAssistantWorkflowToolSelectionProfileKey({
      intentId: row.summary.workflow?.intent ?? intentId,
      profileIds: row.summary.workflow?.workflowSelectionActiveProfileIds ?? [],
    });
    const authoritySource = row.summary.workflow?.authority?.source ?? null;
    const authorityReason = row.summary.workflow?.authority?.reason ?? null;
    for (const selection of row.summary.toolSelections) {
      const toolSet = buildEffectiveToolSelectionToolSet(selection.toolNames);
      const segmentKey = buildEffectiveToolSelectionSegmentKey({
        workflowId,
        workflowVersion,
        workflowProfileKey,
        intentId,
        hop: selection.hop,
        mode: selection.mode,
        selectionReason: selection.reason,
        pruningEnabled: selection.pruningEnabled,
        toolSignature: toolSet.signature,
        schemaCostSource: selection.schemaCostSource,
        authoritySource,
        authorityReason,
      });
      const aggregate = aggregates.get(segmentKey) ?? {
        segmentKey,
        workflowId,
        workflowVersion,
        workflowProfileKey,
        intentId,
        hop: selection.hop,
        mode: selection.mode,
        selectionReason: selection.reason,
        pruningEnabled: selection.pruningEnabled,
        toolSignature: toolSet.signature,
        toolNames: toolSet.toolNames,
        schemaCostSource: selection.schemaCostSource,
        authoritySource,
        authorityReason,
        selectionCount: 0,
        toolCountObservationCount: 0,
        toolCountTotal: 0,
        totalToolCountObservationCount: 0,
        totalToolCountTotal: 0,
        schemaCharsObservationCount: 0,
        schemaCharsTotal: 0,
        savedCharsObservationCount: 0,
        savedCharsTotal: 0,
      };
      aggregate.selectionCount += 1;
      addToolSelectionMetric(aggregate, "toolCount", selection.toolCount);
      addToolSelectionMetric(aggregate, "totalToolCount", selection.totalToolCount);
      addToolSelectionMetric(aggregate, "schemaChars", selection.approxSchemaChars);
      addToolSelectionMetric(aggregate, "savedChars", selection.approxSavedChars);
      aggregates.set(segmentKey, aggregate);
    }
  }

  return [...aggregates.values()]
    .map((aggregate) => ({
      ...aggregate,
      averageToolCount: calculateAverage(aggregate.toolCountTotal, aggregate.toolCountObservationCount),
      averageTotalToolCount: calculateAverage(aggregate.totalToolCountTotal, aggregate.totalToolCountObservationCount),
      averageSchemaChars: calculateAverage(aggregate.schemaCharsTotal, aggregate.schemaCharsObservationCount),
      averageSavedChars: calculateAverage(aggregate.savedCharsTotal, aggregate.savedCharsObservationCount),
    }))
    .sort((left, right) => {
      if (right.selectionCount !== left.selectionCount) return right.selectionCount - left.selectionCount;
      return left.segmentKey.localeCompare(right.segmentKey);
    });
}

function buildEffectiveToolSelectionSegmentKey(input: {
  workflowId: string | null;
  workflowVersion: number | null;
  workflowProfileKey: string | null;
  intentId: string;
  hop: number | null;
  mode: string | null;
  selectionReason: string | null;
  pruningEnabled: boolean | null;
  toolSignature: string;
  schemaCostSource: string | null;
  authoritySource: string | null;
  authorityReason: string | null;
}): string {
  return [
    `workflow_id:${input.workflowId ?? "unknown"}`,
    `workflow_version:${input.workflowVersion ?? "unknown"}`,
    `workflow_profile:${input.workflowProfileKey ?? "none"}`,
    `intent:${input.intentId}`,
    `hop:${input.hop ?? "unknown"}`,
    `mode:${input.mode ?? "unknown"}`,
    `reason:${input.selectionReason ?? "unknown"}`,
    `pruning:${input.pruningEnabled === null ? "unknown" : String(input.pruningEnabled)}`,
    `tools:${input.toolSignature}`,
    `schema_cost:${input.schemaCostSource ?? "unknown"}`,
    `authority:${input.authoritySource ?? "unknown"}`,
    `authority_reason:${input.authorityReason ?? "unknown"}`,
  ].join("|");
}

function addToolSelectionMetric(
  aggregate: {
    toolCountObservationCount: number;
    toolCountTotal: number;
    totalToolCountObservationCount: number;
    totalToolCountTotal: number;
    schemaCharsObservationCount: number;
    schemaCharsTotal: number;
    savedCharsObservationCount: number;
    savedCharsTotal: number;
  },
  metric: "toolCount" | "totalToolCount" | "schemaChars" | "savedChars",
  value: number | null,
): void {
  if (value === null || !Number.isFinite(value)) return;
  const normalized = Math.max(0, value);
  switch (metric) {
    case "toolCount":
      aggregate.toolCountObservationCount += 1;
      aggregate.toolCountTotal += normalized;
      return;
    case "totalToolCount":
      aggregate.totalToolCountObservationCount += 1;
      aggregate.totalToolCountTotal += normalized;
      return;
    case "schemaChars":
      aggregate.schemaCharsObservationCount += 1;
      aggregate.schemaCharsTotal += normalized;
      return;
    case "savedChars":
      aggregate.savedCharsObservationCount += 1;
      aggregate.savedCharsTotal += normalized;
  }
}

function calculateAverage(total: number, count: number): number | null {
  return count > 0 ? total / count : null;
}

type AssistantWorkflowToolSelectionMetricEvidenceCounters = {
  qualityFlaggedSelectionCount: number;
  errorSelectionCount: number;
  badFeedbackSelectionCount: number;
  unavailableOutcomeSelectionCount: number;
};

const EMPTY_TOOL_SELECTION_METRIC_EVIDENCE_COUNTERS: AssistantWorkflowToolSelectionMetricEvidenceCounters = {
  qualityFlaggedSelectionCount: 0,
  errorSelectionCount: 0,
  badFeedbackSelectionCount: 0,
  unavailableOutcomeSelectionCount: 0,
};

function buildToolSelectionMetricEvidenceCounters(
  rows: readonly AssistantWorkflowTraceReportRow[],
): Map<string, AssistantWorkflowToolSelectionMetricEvidenceCounters> {
  const counters = new Map<string, AssistantWorkflowToolSelectionMetricEvidenceCounters>();
  for (const row of rows) {
    const workflowId = row.summary.workflow?.workflowId ?? null;
    const workflowVersion = row.summary.workflow?.workflowVersion ?? null;
    const intentId = row.summary.classifier?.intent ?? row.summary.workflow?.intent ?? "unknown";
    const workflowProfileKey = buildAssistantWorkflowToolSelectionProfileKey({
      intentId: row.summary.workflow?.intent ?? intentId,
      profileIds: row.summary.workflow?.workflowSelectionActiveProfileIds ?? [],
    });
    const authoritySource = row.summary.workflow?.authority?.source ?? null;
    const authorityReason = row.summary.workflow?.authority?.reason ?? null;
    for (const selection of row.summary.toolSelections) {
      const toolSet = buildEffectiveToolSelectionToolSet(selection.toolNames);
      const segmentKey = buildEffectiveToolSelectionSegmentKey({
        workflowId,
        workflowVersion,
        workflowProfileKey,
        intentId,
        hop: selection.hop,
        mode: selection.mode,
        selectionReason: selection.reason,
        pruningEnabled: selection.pruningEnabled,
        toolSignature: toolSet.signature,
        schemaCostSource: selection.schemaCostSource,
        authoritySource,
        authorityReason,
      });
      const current = counters.get(segmentKey) ?? {
        qualityFlaggedSelectionCount: 0,
        errorSelectionCount: 0,
        badFeedbackSelectionCount: 0,
        unavailableOutcomeSelectionCount: 0,
      };
      if (row.summary.quality.flagged) current.qualityFlaggedSelectionCount += 1;
      if (row.summary.errorStages.length > 0) current.errorSelectionCount += 1;
      if (row.feedback === "bad") current.badFeedbackSelectionCount += 1;
      if (row.summary.handledOutcome?.kind === "unavailable") {
        current.unavailableOutcomeSelectionCount += 1;
      }
      counters.set(segmentKey, current);
    }
  }
  return counters;
}

function buildEffectiveToolSelectionToolSet(toolNames: readonly string[]): {
  signature: string;
  toolNames: string[];
} {
  const normalized = uniqueStrings(toolNames
    .map((toolName) => toolName.trim())
    .filter((toolName) => toolName.length > 0))
    .sort((left, right) => left.localeCompare(right));
  return {
    signature: normalized.length ? normalized.join(",") : "none",
    toolNames: normalized,
  };
}

function isToolSelectionMetricSegmentInScope(
  segment: AssistantWorkflowTraceReportToolSelectionSegment,
  workflowIds: readonly string[],
  workflowVersions: readonly number[],
  workflowProfileKeys: readonly string[],
  authoritySources: readonly string[],
  intentIds: readonly string[],
  segmentKeys: readonly string[],
): boolean {
  return (!workflowIds.length || (segment.workflowId !== null && workflowIds.includes(segment.workflowId))) &&
    (!workflowVersions.length || (segment.workflowVersion !== null && workflowVersions.includes(segment.workflowVersion))) &&
    (!workflowProfileKeys.length || (
      segment.workflowProfileKey !== null && workflowProfileKeys.includes(segment.workflowProfileKey)
    )) &&
    (!authoritySources.length || (
      segment.authoritySource !== null && authoritySources.includes(segment.authoritySource)
    )) &&
    (!intentIds.length || intentIds.includes(segment.intentId)) &&
    (!segmentKeys.length || segmentKeys.includes(segment.segmentKey));
}

function selectWorkflowScopedTraceRows(
  rows: readonly AssistantWorkflowTraceReportRow[],
  workflowIds: readonly string[],
  workflowVersions: readonly number[],
): AssistantWorkflowTraceReportRow[] {
  if (!workflowIds.length && !workflowVersions.length) return [...rows];
  return rows.filter((row) => {
    const workflow = row.summary.workflow;
    if (!workflow) return false;
    return (!workflowIds.length || (
      workflow.workflowId !== null && workflowIds.includes(workflow.workflowId)
    )) && (!workflowVersions.length || (
      workflow.workflowVersion !== null && workflowVersions.includes(workflow.workflowVersion)
    ));
  });
}

function normalizeStringScope(values: readonly string[] | null | undefined): string[] {
  const normalized = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed.length) normalized.add(trimmed);
  }
  return [...normalized].sort();
}

function normalizeNumberScope(values: readonly number[] | null | undefined): number[] {
  const normalized = new Set<number>();
  for (const value of values ?? []) {
    if (Number.isInteger(value) && value > 0) normalized.add(value);
  }
  return [...normalized].sort((left, right) => left - right);
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : null;
}

function findReportCount(counts: readonly AssistantWorkflowTraceReportCount[], key: string): number {
  return counts.find((item) => item.key === key)?.count ?? 0;
}

function sumWriteSourceCountsBySource(counts: readonly AssistantWorkflowTraceReportCount[], source: string): number {
  const suffix = `:${source}`;
  return counts.reduce((sum, item) => item.key.endsWith(suffix) ? sum + item.count : sum, 0);
}

function normalizePositiveInt(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function normalizeNonNegativeInt(value: number | null | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  return normalized >= 0 ? normalized : fallback;
}

function normalizePatchDerivationRequirements(
  requirements: readonly AssistantWorkflowMemoryPatchDerivationReadinessRequirement[] | null | undefined,
): AssistantWorkflowTraceReportCount[] {
  if (!requirements?.length) return [];
  const out = new Map<string, number>();
  for (const requirement of requirements) {
    const key = requirement.key.trim();
    if (!key.length) continue;
    const minCount = normalizePositiveInt(requirement.minCount, 1);
    out.set(key, Math.max(out.get(key) ?? 0, minCount));
  }
  return [...out.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function buildTuningSignalCounts(
  values: readonly AssistantWorkflowTraceTuningSignal[],
): AssistantWorkflowTraceReportTuningSignalCount[] {
  const counts = new Map<string, AssistantWorkflowTraceReportTuningSignalCount>();
  for (const signal of values) {
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

function buildDirectRouteSkipReasonKey(input: {
  route: string;
  reason: string | null;
}): string | null {
  if (input.reason === "runtime_policy_disabled" || input.reason === "runtime_disabled") return null;
  return input.reason ? `${input.route}:${input.reason}` : `${input.route}:unknown`;
}

function buildDirectRoutePolicyDisabledReasonKey(input: {
  route: string | null;
  reason: string | null;
}): string {
  return `${input.route ?? "unknown"}:${input.reason ?? "unknown"}`;
}

function buildDirectRouteGapReasonKey(input: {
  route: string | null;
  reason: string | null;
}): string {
  return `${input.route ?? "unknown"}:${input.reason ?? "unknown"}`;
}

function buildMemorySkippedPatchReasonKey(input: {
  slotId: string | null;
  operation: string | null;
  reason: string;
}): string {
  return `${input.slotId ?? "unknown"}:${input.operation ?? "unknown"}:${input.reason}`;
}

function buildMemoryPatchEquivalenceKey(input: {
  profilePatchEquivalent: boolean | null;
}): string {
  if (input.profilePatchEquivalent === true) return "equivalent";
  if (input.profilePatchEquivalent === false) return "mismatch";
  return "unknown";
}

function buildMemoryPatchDerivationKey(input: {
  patchDerivation: string | null;
}): string {
  return input.patchDerivation ?? "unknown";
}

function buildMemoryPatchWriteSourceKey(input: {
  profileWriteMode: string | null;
  profileWriteSource: string | null;
}): string {
  const mode = input.profileWriteMode ?? "unknown";
  const source = input.profileWriteSource ?? "unknown";
  return `${mode}:${source}`;
}

function buildMemoryPatchWriteReasonKey(input: {
  profileWriteReason: string | null;
}): string {
  return input.profileWriteReason ?? "unknown";
}

function buildThreadProfileWriteSourceKey(input: {
  writeMode: string | null;
  writeSource: string | null;
}): string {
  const mode = input.writeMode ?? "unknown";
  const source = input.writeSource ?? "unknown";
  return `${mode}:${source}`;
}

function buildThreadProfileWriteReasonKey(input: {
  writeReason: string | null;
}): string {
  return input.writeReason ?? "unknown";
}

type DirectRouteDefinitionLookup = Map<string, AssistantWorkflowDirectRouteDefinition> | null;

function buildDirectRouteDefinitionLookup(
  workflow: AssistantWorkflowDefinition | null,
): DirectRouteDefinitionLookup {
  if (!workflow) return null;
  const lookup = new Map<string, AssistantWorkflowDirectRouteDefinition>();
  for (const directRoute of workflow.directRoutes ?? []) {
    addDirectRouteLookupEntry(lookup, directRoute.id, directRoute);
    if (directRoute.outcomeRoute) {
      addDirectRouteLookupEntry(lookup, directRoute.outcomeRoute, directRoute);
    }
  }
  return lookup;
}

function addDirectRouteLookupEntry(
  lookup: Map<string, AssistantWorkflowDirectRouteDefinition>,
  routeId: string,
  definition: AssistantWorkflowDirectRouteDefinition,
): void {
  const normalized = routeId.trim();
  if (!normalized.length || lookup.has(normalized)) return;
  lookup.set(normalized, definition);
}

function buildDirectRouteStrategySummaries(
  summary: AssistantWorkflowTraceSummary,
  directRouteDefinitionLookup: DirectRouteDefinitionLookup,
): AssistantWorkflowTraceReportDirectRouteStrategy[] {
  return summary.directRoutes.flatMap((route): AssistantWorkflowTraceReportDirectRouteStrategy[] => {
    const strategy = route.strategy?.trim();
    if (!strategy) return [];
    if (directRouteDefinitionLookup === null) {
      return [{
        route: route.route,
        strategy,
        definitionRouteId: null,
        declared: null,
        status: "workflow_not_provided",
      }];
    }

    const definition = directRouteDefinitionLookup.get(route.route);
    if (!definition) {
      return [{
        route: route.route,
        strategy,
        definitionRouteId: null,
        declared: false,
        status: "route_not_declared",
      }];
    }

    const declaredStrategyIds = new Set((definition.strategies ?? []).map((item) => item.id));
    const declared = declaredStrategyIds.has(strategy);
    return [{
      route: route.route,
      strategy,
      definitionRouteId: definition.id,
      declared,
      status: declared ? "declared" : "strategy_not_declared",
    }];
  });
}

function buildDirectRouteStrategyKey(input: {
  route: string;
  strategy: string;
}): string {
  return `${input.route}:${input.strategy}`;
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value.length || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function buildClarificationComparisonMatchedKey(input: {
  observedRuleId: string | null;
}): string {
  return input.observedRuleId ?? "none";
}

function isClarificationBlockingRuleSatisfiedByRuntime(
  row: AssistantWorkflowTraceReportRow,
  ruleId: string,
): boolean {
  return row.summary.clarificationComparisons.some((comparison) =>
    comparison.matched === true &&
    comparison.produced === true &&
    (
      comparison.expectedBlockingRuleIds.includes(ruleId) ||
      comparison.expectedRuleIds.includes(ruleId)
    ),
  );
}

function buildReportSuggestions(
  rows: readonly AssistantWorkflowTraceReportRow[],
): AssistantWorkflowTraceReportSuggestion[] {
  const builder = new SuggestionBuilder();
  for (const row of rows) {
    const intent = row.summary.classifier?.intent ?? row.summary.workflow?.intent ?? null;
    const workflow = row.summary.workflow;

    for (const tool of workflow?.missingRequiredToolHints ?? []) {
      builder.add({
        kind: "review_missing_required_tool",
        severity: "warning",
        intent,
        tool,
        signal: null,
        requestId: row.requestId,
      });
    }
    if (workflow && hasAssistantWorkflowConstrainedToolSelectionEvidence(workflow)) {
      for (const tool of getMissingWorkflowSelectionCandidateTools(workflow)) {
        builder.add({
          kind: "review_workflow_tool_selection_gap",
          severity: "info",
          intent,
          tool,
          signal: null,
          requestId: row.requestId,
        });
      }
      for (const tool of getAssistantWorkflowUnmodeledToolCalls(workflow, row.summary.toolCallNames)) {
        builder.add({
          kind: "review_unmodeled_selected_tool",
          severity: "info",
          intent,
          tool,
          signal: null,
          requestId: row.requestId,
        });
      }
    }
    for (const tool of workflow?.extraClassifierTools ?? []) {
      builder.add({
        kind: "review_classifier_extra_tool",
        severity: "info",
        intent,
        tool,
        signal: null,
        requestId: row.requestId,
      });
    }
    for (const ruleId of workflow?.clarification?.blockingRuleIds ?? []) {
      if (isClarificationBlockingRuleSatisfiedByRuntime(row, ruleId)) continue;
      builder.add({
        kind: "review_clarification_policy",
        severity: "warning",
        intent,
        tool: null,
        signal: ruleId,
        requestId: row.requestId,
      });
    }
    for (const comparison of row.summary.clarificationComparisons) {
      for (const ruleId of comparison.missingExpectedRuleIds) {
        builder.add({
          kind: "review_clarification_policy",
          severity: "warning",
          intent: comparison.intent ?? intent,
          tool: null,
          signal: ruleId,
          requestId: row.requestId,
        });
      }
      if (comparison.unexpectedObservedRuleId) {
        builder.add({
          kind: "review_clarification_policy",
          severity: "warning",
          intent: comparison.intent ?? intent,
          tool: null,
          signal: comparison.unexpectedObservedRuleId,
          requestId: row.requestId,
        });
      }
    }
    for (const patch of row.summary.memoryPatches) {
      if (patch.profilePatchEquivalent !== false) continue;
      builder.add({
        kind: "review_memory_patch_equivalence",
        severity: "warning",
        intent,
        tool: null,
        signal: patch.profilePatchMismatchedFields.join(", ") || "profile_patch_mismatch",
        requestId: row.requestId,
      });
    }
    for (const strategy of row.directRouteStrategies) {
      if (strategy.declared !== false) continue;
      builder.add({
        kind: "review_direct_route_strategy",
        severity: "info",
        intent: strategy.definitionRouteId ?? strategy.route,
        tool: null,
        signal: buildDirectRouteStrategyKey(strategy),
        requestId: row.requestId,
      });
    }
    for (const stage of row.summary.errorStages) {
      builder.add({
        kind: "review_trace_error",
        severity: "warning",
        intent,
        tool: null,
        signal: stage,
        requestId: row.requestId,
      });
    }
    for (const signal of row.summary.quality.signalNames) {
      builder.add({
        kind: "review_quality_signal",
        severity: "warning",
        intent,
        tool: null,
        signal,
        requestId: row.requestId,
      });
    }
    if (row.feedback === "bad" && row.evalCandidate) {
      builder.add({
        kind: "promote_bad_feedback_eval",
        severity: "warning",
        intent,
        tool: null,
        signal: "bad_feedback",
        requestId: row.requestId,
      });
    }
  }
  return builder.toSuggestions();
}

function buildTraceDerivedRunReportStatus(
  row: AssistantWorkflowTraceReportRow,
  warningCount: number,
): AssistantWorkflowRunReportStatus {
  if (row.summary.handledOutcome?.kind === "clarification") return "clarification";
  if (row.summary.handledOutcome?.kind === "degraded") return "degraded";
  if (row.summary.errorStages.length > 0) return "failed";
  if (warningCount > 0 || row.feedback === "bad" || row.summary.quality.flagged) return "degraded";
  if (row.summary.handledOutcome) return "completed";
  if (!row.summary.workflow) return "not_handled";
  return "completed";
}

function buildTraceDerivedRunEvaluationSignals(
  row: AssistantWorkflowTraceReportRow,
): AssistantWorkflowRunEvaluationSignal[] {
  const signals: AssistantWorkflowRunEvaluationSignal[] = [];
  const workflow = row.summary.workflow;

  if (!workflow && !row.summary.handledOutcome) {
    signals.push({
      name: "run_not_handled",
      severity: "warning",
      detail: "trace did not include a workflow decision",
    });
  }
  if (row.summary.errorStages.length > 0) {
    signals.push({
      name: "run_failed",
      severity: "warning",
      detail: row.summary.errorStages.join(", "),
    });
  }
  if (workflow?.missingRequiredToolHints.length) {
    signals.push({
      name: "missing_required_tools",
      severity: "warning",
      detail: workflow.missingRequiredToolHints.join(", "),
    });
  }
  if (workflow?.plan?.missingRequiredToolHints.length) {
    signals.push({
      name: "missing_required_tools",
      severity: "warning",
      detail: workflow.plan.missingRequiredToolHints.join(", "),
    });
  }
  if (row.summary.errorStages.some((stage) => stage === ASSISTANT_WORKFLOW_TRACE_STAGE.toolCallError)) {
    signals.push({
      name: "tool_execution_failed",
      severity: "warning",
      detail: row.summary.errorStages.join(", "),
    });
  }
  if (row.feedback === "bad" || row.summary.quality.flagged) {
    signals.push({
      name: "run_degraded",
      severity: "warning",
      detail: row.summary.quality.flagged
        ? row.summary.quality.signalNames.join(", ") || "quality flagged"
        : "bad feedback",
    });
  }
  for (const comparison of row.summary.clarificationComparisons) {
    if (comparison.matched !== false) continue;
    signals.push({
      name: "clarification_policy_mismatch",
      severity: "warning",
      detail: buildClarificationPolicyMismatchDetail(comparison),
    });
  }

  return dedupeRunEvaluationSignals(signals);
}

function buildClarificationPolicyMismatchDetail(input: {
  missingExpectedRuleIds: readonly string[];
  unexpectedObservedRuleId: string | null;
  observedRuleId: string | null;
}): string {
  if (input.missingExpectedRuleIds.length) return `missing ${input.missingExpectedRuleIds.join(", ")}`;
  if (input.unexpectedObservedRuleId) return `unexpected ${input.unexpectedObservedRuleId}`;
  if (input.observedRuleId) return `unmatched ${input.observedRuleId}`;
  return "clarification policy mismatch";
}

function dedupeRunEvaluationSignals(
  signals: readonly AssistantWorkflowRunEvaluationSignal[],
): AssistantWorkflowRunEvaluationSignal[] {
  const out: AssistantWorkflowRunEvaluationSignal[] = [];
  const seen = new Set<string>();
  for (const signal of signals) {
    const key = `${signal.name}:${signal.detail ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(signal);
  }
  return out;
}

function buildTraceDerivedOutcomeReason(
  row: AssistantWorkflowTraceReportRow,
  status: AssistantWorkflowRunReportStatus,
): string | null {
  if (status === "completed") return null;
  if (!row.summary.workflow) return "trace did not include a workflow decision";
  if (row.summary.errorStages.length > 0) return row.summary.errorStages.join(", ");
  if (row.summary.quality.flagged) return row.summary.quality.signalNames.join(", ") || "quality flagged";
  if (row.feedback === "bad") return "bad feedback";
  return "trace-derived warning";
}

function normalizeRunReportWorkflowId(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized?.length ? normalized : "trace-derived-assistant-workflow";
}

function normalizeRunReportWorkflowVersion(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

type PendingSuggestion = {
  kind: AssistantWorkflowTraceReportSuggestionKind;
  severity: "info" | "warning";
  intent: string | null;
  tool: string | null;
  signal: string | null;
  requestId: string;
};

type SuggestionAccumulator = Omit<PendingSuggestion, "requestId"> & {
  count: number;
  requestIds: string[];
};

class SuggestionBuilder {
  private readonly suggestions = new Map<string, SuggestionAccumulator>();

  add(input: PendingSuggestion): void {
    const id = buildSuggestionId(input);
    const existing = this.suggestions.get(id);
    if (existing) {
      existing.count += 1;
      if (!existing.requestIds.includes(input.requestId) && existing.requestIds.length < 5) {
        existing.requestIds.push(input.requestId);
      }
      if (input.severity === "warning") existing.severity = "warning";
      return;
    }
    this.suggestions.set(id, {
      kind: input.kind,
      severity: input.severity,
      intent: input.intent,
      tool: input.tool,
      signal: input.signal,
      count: 1,
      requestIds: [input.requestId],
    });
  }

  toSuggestions(): AssistantWorkflowTraceReportSuggestion[] {
    return [...this.suggestions.entries()]
      .map(([id, item]) => ({
        id,
        kind: item.kind,
        severity: item.severity,
        intent: item.intent,
        tool: item.tool,
        signal: item.signal,
        count: item.count,
        requestIds: item.requestIds,
        ...describeSuggestion(item),
      }))
      .sort((left, right) => {
        if (left.severity !== right.severity) return left.severity === "warning" ? -1 : 1;
        if (right.count !== left.count) return right.count - left.count;
        return left.id.localeCompare(right.id);
      });
  }
}

function buildSuggestionId(input: Omit<PendingSuggestion, "requestId">): string {
  return [
    input.kind,
    input.intent ?? "unknown",
    input.tool ?? input.signal ?? "all",
  ].map((part) => part.replace(/[^a-zA-Z0-9_.-]+/g, "_").toLowerCase()).join(":");
}

function describeSuggestion(
  item: Omit<SuggestionAccumulator, "count" | "requestIds">,
): Pick<AssistantWorkflowTraceReportSuggestion, "rationale" | "suggestedAction"> {
  const intent = item.intent ?? "unknown intent";
  const tool = item.tool ?? "unknown tool";
  const signal = item.signal ?? "unknown signal";
  switch (item.kind) {
    case "review_missing_required_tool":
      return {
        rationale: `Workflow required ${tool} for ${intent}, but the tool was not available in these traces.`,
        suggestedAction: "Check tool registration/policy or relax the requiredToolHint/planning-step requirement if it is no longer valid.",
      };
    case "review_workflow_tool_selection_gap":
      return {
        rationale: `Workflow suggested ${tool} for ${intent}, but existing tool pruning did not select it.`,
        suggestedAction: "Compare pruning rules against workflow hints before migrating this route to workflow-owned selection.",
      };
    case "review_unmodeled_selected_tool":
      return {
        rationale: `Existing runtime selected ${tool} for ${intent}, but the workflow did not suggest it.`,
        suggestedAction: "If this is intentional, add a tool hint or conditional planning step; otherwise tighten the runtime pruning path.",
      };
    case "review_classifier_extra_tool":
      return {
        rationale: `Classifier exposed ${tool} for ${intent} outside the workflow hint set.`,
        suggestedAction: "Add an explicit workflow hint/condition or update classifier prompt facts so the contract stays consistent.",
      };
    case "review_clarification_policy":
      return {
        rationale: `Clarification rule ${signal} blocked confident execution for ${intent}.`,
        suggestedAction: "Check whether the runtime already clarified correctly; if repeated, promote examples into evals before changing the clarification rule.",
      };
    case "review_memory_patch_equivalence":
      return {
        rationale: `Workflow memory patches did not reproduce legacy profile fields (${signal}) for ${intent}.`,
        suggestedAction: "Keep memory writes in shadow mode; inspect the slot mapping/coercion before cutting over profile persistence.",
      };
    case "review_direct_route_strategy":
      return {
        rationale: `Runtime direct-route strategy ${signal} was observed for ${intent}, but it is not declared in the workflow route catalog.`,
        suggestedAction: "Review whether this branch should be added to route strategy metadata or split into a narrower direct-route definition.",
      };
    case "review_trace_error":
      return {
        rationale: `Trace stage ${signal} occurred for ${intent}.`,
        suggestedAction: "Debug the request path first; tune workflow only after the implementation error is understood.",
      };
    case "review_quality_signal":
      return {
        rationale: `Quality signal ${signal} fired for ${intent}.`,
        suggestedAction: "Promote representative prompts to eval cases, then adjust intent, tool, artifact, or clarification policy if repeated.",
      };
    case "promote_bad_feedback_eval":
      return {
        rationale: `Bad user feedback was recorded for ${intent}.`,
        suggestedAction: "Review the trace and promote the prompt into an eval case before changing workflow definitions.",
      };
  }
}
