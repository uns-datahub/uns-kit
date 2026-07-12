import type { AssistantWorkflowJsonValue } from "./run-report-json.js";
import type { AssistantWorkflowSerializedToolSelectionDecision } from "./tool-selection-json.js";
import { buildAssistantWorkflowToolSelectionSegmentKey } from "./tool-selection-policy.js";
import {
  readAssistantWorkflowNumber as readNumber,
  readAssistantWorkflowString as readString,
  readAssistantWorkflowStringArray,
} from "./value-readers.js";

export type AssistantWorkflowToolSelectionEvaluationSeverity = "info" | "warning";

export type AssistantWorkflowToolSelectionEvaluationSignalName =
  | "legacy_authority"
  | "workflow_unavailable"
  | "workflow_authority_not_enabled"
  | "workflow_blocked"
  | "workflow_differs"
  | "workflow_candidate_not_selected"
  | "selected_outside_workflow_candidate"
  | "selected_outside_workflow_suggestions"
  | "selected_policy_excluded_optional_tool";

export type AssistantWorkflowToolSelectionEvaluationSignal = {
  name: AssistantWorkflowToolSelectionEvaluationSignalName;
  severity: AssistantWorkflowToolSelectionEvaluationSeverity;
  detail: string | null;
};

export type AssistantWorkflowToolSelectionEvaluation = {
  intentId: string | null;
  hop: number | null;
  selectedReason: string | null;
  authoritySource: string;
  authorityReason: string;
  workflowStatus: string | null;
  workflowAuthorityEnabled: boolean | null;
  workflowAuthoritySegmentKey: string;
  workflowAuthoritySegmentEnabled: boolean | null;
  effectiveReason: string | null;
  selectedToolCount: number;
  effectiveToolCount: number;
  workflowSuggestedToolCount: number;
  workflowSelectionCandidateToolCount: number;
  workflowSelectionActiveProfileIds: string[];
  workflowSelectionProfileToolNames: string[];
  workflowSelectionProfileToolCount: number;
  signalCount: number;
  warningCount: number;
  signals: AssistantWorkflowToolSelectionEvaluationSignal[];
};

export type AssistantWorkflowToolSelectionEvaluationBatchOptions = {
  onlyInteresting?: boolean;
};

export type AssistantWorkflowToolSelectionEvaluationBatchCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowToolSelectionEvaluationBatchSignalCount = {
  name: AssistantWorkflowToolSelectionEvaluationSignalName;
  severity: AssistantWorkflowToolSelectionEvaluationSeverity;
  count: number;
};

export type AssistantWorkflowToolSelectionEvaluationIntentReadiness = {
  intentId: string;
  decisionCount: number;
  workflowAuthorityCount: number;
  shadowEquivalentCount: number;
  workflowDiffersCount: number;
  workflowBlockedCount: number;
  workflowUnavailableCount: number;
  warningCount: number;
  workflowAuthorityConfirmed: boolean;
  readyForWorkflowAuthority: boolean;
};

export type AssistantWorkflowToolSelectionEvaluationSegmentReadiness =
  AssistantWorkflowToolSelectionEvaluationIntentReadiness & {
    segmentKey: string;
    hop: number | null;
    selectedReason: string | null;
  };

export type AssistantWorkflowToolSelectionEvaluationReadinessSummary = {
  readyIntentCount: number;
  confirmedIntentCount: number;
  readySegmentCount: number;
  confirmedSegmentCount: number;
  warningIntentCount: number;
  warningSegmentCount: number;
};

export type AssistantWorkflowToolSelectionMigrationCandidateKind = "intent" | "segment";

export type AssistantWorkflowToolSelectionMigrationCandidateStatus =
  | "ready_for_workflow_authority"
  | "workflow_authority_confirmed"
  | "needs_review";

export type AssistantWorkflowToolSelectionMigrationRecommendedAction =
  | "add_intent_to_authority_allow_list"
  | "keep_runtime_authority"
  | "review_segment_before_authority_change"
  | "review_blockers_before_migration";

export type AssistantWorkflowToolSelectionMigrationCandidate = {
  kind: AssistantWorkflowToolSelectionMigrationCandidateKind;
  key: string;
  intentId: string;
  segmentKey: string | null;
  hop: number | null;
  selectedReason: string | null;
  decisionCount: number;
  workflowAuthorityCount: number;
  shadowEquivalentCount: number;
  workflowDiffersCount: number;
  workflowBlockedCount: number;
  workflowUnavailableCount: number;
  warningCount: number;
  status: AssistantWorkflowToolSelectionMigrationCandidateStatus;
  recommendedAction: AssistantWorkflowToolSelectionMigrationRecommendedAction;
  blockingReasons: string[];
  rationale: string;
};

export type AssistantWorkflowToolSelectionMigrationReportOptions = {
  minDecisionCount?: number | null;
};

export type AssistantWorkflowToolSelectionMigrationReport = {
  generatedAt: string;
  minDecisionCount: number;
  sourceDecisionCount: number;
  rowCount: number;
  suggestedAuthorityIntentIds: string[];
  suggestedAuthoritySegmentKeys: string[];
  candidateCount: number;
  readyIntentCandidates: AssistantWorkflowToolSelectionMigrationCandidate[];
  readySegmentCandidates: AssistantWorkflowToolSelectionMigrationCandidate[];
  confirmedIntentCandidates: AssistantWorkflowToolSelectionMigrationCandidate[];
  confirmedSegmentCandidates: AssistantWorkflowToolSelectionMigrationCandidate[];
  reviewCandidates: AssistantWorkflowToolSelectionMigrationCandidate[];
};

export type AssistantWorkflowToolSelectionAuthorityAllowListProposalOptions = {
  currentAuthorityIntentIds?: readonly string[] | null;
  currentAuthoritySegmentKeys?: readonly string[] | null;
};

export type AssistantWorkflowToolSelectionAuthorityAllowListProposal = {
  generatedAt: string;
  minDecisionCount: number;
  sourceDecisionCount: number;
  rowCount: number;
  currentAuthorityIntentIds: string[];
  currentAuthoritySegmentKeys: string[];
  suggestedAuthorityIntentIds: string[];
  suggestedAuthoritySegmentKeys: string[];
  addIntentIds: string[];
  addSegmentKeys: string[];
  keepIntentIds: string[];
  keepSegmentKeys: string[];
  proposedAuthorityIntentIds: string[];
  proposedAuthoritySegmentKeys: string[];
  readyIntentCandidateCount: number;
  readySegmentCandidateCount: number;
  confirmedIntentCandidateCount: number;
  confirmedSegmentCandidateCount: number;
  reviewIntentCandidateCount: number;
  reviewSegmentCandidateCount: number;
  reviewIntentIds: string[];
  reviewSegmentKeys: string[];
  currentIntentIdsWithReviewEvidence: string[];
  currentSegmentKeysWithReviewEvidence: string[];
  canApplyAdditions: boolean;
  rationale: string[];
};

export type AssistantWorkflowToolSelectionMigrationReviewArtifactStatus =
  | "ready_for_runtime_change"
  | "no_runtime_change";

export type AssistantWorkflowToolSelectionMigrationReviewArtifactRecommendedAction =
  | "apply_authority_allow_list_update"
  | "keep_current_authority";

export type AssistantWorkflowToolSelectionMigrationReviewArtifactOptions = {
  title?: string | null;
  patchTargets?: readonly string[] | null;
  requiredTestIds?: readonly string[] | null;
};

export type AssistantWorkflowToolSelectionMigrationReviewArtifact = {
  generatedAt: string;
  title: string;
  status: AssistantWorkflowToolSelectionMigrationReviewArtifactStatus;
  recommendedAction: AssistantWorkflowToolSelectionMigrationReviewArtifactRecommendedAction;
  minDecisionCount: number;
  sourceDecisionCount: number;
  rowCount: number;
  patchTargets: string[];
  requiredTestIds: string[];
  runtimeChange: {
    addIntentIds: string[];
    addSegmentKeys: string[];
    keepIntentIds: string[];
    keepSegmentKeys: string[];
    proposedAuthorityIntentIds: string[];
    proposedAuthoritySegmentKeys: string[];
  };
  evidence: {
    readyIntentCandidateKeys: string[];
    readySegmentCandidateKeys: string[];
    confirmedIntentCandidateKeys: string[];
    confirmedSegmentCandidateKeys: string[];
  };
  review: {
    reviewIntentIds: string[];
    reviewSegmentKeys: string[];
    currentIntentIdsWithReviewEvidence: string[];
    currentSegmentKeysWithReviewEvidence: string[];
    blockerCount: number;
    blockers: AssistantWorkflowToolSelectionMigrationCandidate[];
  };
  rationale: string[];
};

export type AssistantWorkflowToolSelectionEvaluationBatch = {
  generatedAt: string;
  sourceDecisionCount: number;
  rowCount: number;
  interestingRowCount: number;
  warningRowCount: number;
  intentCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  intentReadiness: AssistantWorkflowToolSelectionEvaluationIntentReadiness[];
  segmentReadiness: AssistantWorkflowToolSelectionEvaluationSegmentReadiness[];
  readinessSummary: AssistantWorkflowToolSelectionEvaluationReadinessSummary;
  authoritySourceCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  authorityReasonCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  workflowStatusCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  effectiveReasonCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  workflowSelectionProfileCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  workflowSelectionProfileToolCounts: AssistantWorkflowToolSelectionEvaluationBatchCount[];
  signalCounts: AssistantWorkflowToolSelectionEvaluationBatchSignalCount[];
  rows: AssistantWorkflowToolSelectionEvaluation[];
};

export function evaluateAssistantWorkflowToolSelectionDecision(
  decision: AssistantWorkflowSerializedToolSelectionDecision,
): AssistantWorkflowToolSelectionEvaluation {
  const signals = collectAssistantWorkflowToolSelectionEvaluationSignals(decision);
  const workflowSelectionCandidateToolNames = readStringArray(
    decision.comparisonPayload?.["workflowSelectionCandidateTools"],
  );
  const workflowSelectionActiveProfileIds = readStringArray(
    decision.comparisonPayload?.["workflowSelectionActiveProfileIds"],
  );
  const workflowSelectionProfileToolNames = readStringArray(
    decision.comparisonPayload?.["workflowSelectionProfileTools"],
  );
  const intentId = readString(decision.comparisonPayload?.["intent"]);
  const workflowAuthorityIntentIds = readStringArray(
    decision.comparisonPayload?.["workflowAuthorityIntentIds"],
  );
  const workflowAuthoritySegmentKeys = readStringArray(
    decision.comparisonPayload?.["workflowAuthoritySegmentKeys"],
  );
  const workflowAuthoritySegmentKey = readString(decision.comparisonPayload?.["workflowAuthoritySegmentKey"]) ??
    buildAssistantWorkflowToolSelectionSegmentKey({
      intentId,
      hop: readNumber(decision.comparisonPayload?.["hop"]),
      selectedReason: readString(decision.comparisonPayload?.["selectedReason"]),
    });

  return {
    intentId,
    hop: readNumber(decision.comparisonPayload?.["hop"]),
    selectedReason: readString(decision.comparisonPayload?.["selectedReason"]),
    authoritySource: decision.authority.source,
    authorityReason: decision.authority.reason,
    workflowStatus: decision.authority.workflowStatus,
    workflowAuthorityEnabled: intentId && workflowAuthorityIntentIds.length > 0
      ? workflowAuthorityIntentIds.includes(intentId)
      : null,
    workflowAuthoritySegmentKey,
    workflowAuthoritySegmentEnabled: workflowAuthoritySegmentKeys.length > 0
      ? workflowAuthoritySegmentKeys.includes(workflowAuthoritySegmentKey)
      : null,
    effectiveReason: decision.effectiveReason,
    selectedToolCount: decision.authority.selectedToolNames.length,
    effectiveToolCount: decision.effectiveToolNames.length,
    workflowSuggestedToolCount: decision.authority.workflowSuggestedToolNames.length,
    workflowSelectionCandidateToolCount: workflowSelectionCandidateToolNames.length,
    workflowSelectionActiveProfileIds,
    workflowSelectionProfileToolNames: workflowSelectionProfileToolNames,
    workflowSelectionProfileToolCount: workflowSelectionProfileToolNames.length,
    signalCount: signals.length,
    warningCount: signals.filter((signal) => signal.severity === "warning").length,
    signals,
  };
}

export function collectAssistantWorkflowToolSelectionEvaluationSignals(
  decision: AssistantWorkflowSerializedToolSelectionDecision,
): AssistantWorkflowToolSelectionEvaluationSignal[] {
  const signals: AssistantWorkflowToolSelectionEvaluationSignal[] = [];
  const missingCandidateTools = readStringArray(
    decision.comparisonPayload?.["missingWorkflowSelectionCandidateTools"],
  );
  const selectedOutsideCandidate = readStringArray(
    decision.comparisonPayload?.["selectedOutsideWorkflowSelectionCandidate"],
  );
  const selectedOutsideSuggestions = readStringArray(
    decision.comparisonPayload?.["selectedOutsideWorkflowSuggestions"],
  );
  const excludedOptionalTools = readStringArray(
    decision.comparisonPayload?.["workflowSelectionExcludedOptionalTools"],
  );
  const selectedPolicyExcludedOptionalTools = selectedOutsideCandidate.filter((toolName) =>
    excludedOptionalTools.includes(toolName)
  );

  if (decision.authority.source === "legacy-pruner") {
    signals.push({
      name: "legacy_authority",
      severity: "info",
      detail: decision.authority.reason,
    });
  }

  if (decision.authority.reason === "workflow_unavailable") {
    signals.push({
      name: "workflow_unavailable",
      severity: "warning",
      detail: "tool selection ran without a workflow comparison payload",
    });
  }

  if (decision.authority.reason === "workflow_authority_not_enabled") {
    signals.push({
      name: "workflow_authority_not_enabled",
      severity: "info",
      detail: readString(decision.comparisonPayload?.["intent"]),
    });
  }

  if (decision.authority.reason === "workflow_blocked") {
    signals.push({
      name: "workflow_blocked",
      severity: "warning",
      detail: decision.authority.workflowStatus,
    });
  }

  if (decision.authority.reason === "workflow_differs") {
    signals.push({
      name: "workflow_differs",
      severity: "info",
      detail: summarizeDifference(missingCandidateTools, selectedOutsideCandidate),
    });
  }

  if (missingCandidateTools.length > 0) {
    signals.push({
      name: "workflow_candidate_not_selected",
      severity: "warning",
      detail: missingCandidateTools.join(", "),
    });
  }

  if (selectedOutsideCandidate.length > 0) {
    signals.push({
      name: "selected_outside_workflow_candidate",
      severity: "info",
      detail: selectedOutsideCandidate.join(", "),
    });
  }

  if (selectedOutsideSuggestions.length > 0) {
    signals.push({
      name: "selected_outside_workflow_suggestions",
      severity: "info",
      detail: selectedOutsideSuggestions.join(", "),
    });
  }

  if (selectedPolicyExcludedOptionalTools.length > 0) {
    signals.push({
      name: "selected_policy_excluded_optional_tool",
      severity: "info",
      detail: selectedPolicyExcludedOptionalTools.join(", "),
    });
  }

  return signals;
}

export function buildAssistantWorkflowToolSelectionEvaluationBatch(
  decisions: readonly AssistantWorkflowSerializedToolSelectionDecision[],
  options: AssistantWorkflowToolSelectionEvaluationBatchOptions = {},
): AssistantWorkflowToolSelectionEvaluationBatch {
  const allRows = decisions.map(evaluateAssistantWorkflowToolSelectionDecision);
  const rows = options.onlyInteresting === true ? allRows.filter(isInterestingRow) : allRows;
  const intentReadiness = buildIntentReadiness(rows);
  const segmentReadiness = buildSegmentReadiness(rows);

  return {
    generatedAt: new Date().toISOString(),
    sourceDecisionCount: decisions.length,
    rowCount: rows.length,
    interestingRowCount: rows.filter(isInterestingRow).length,
    warningRowCount: rows.filter((row) => row.warningCount > 0).length,
    intentCounts: buildStringCounts(rows.map((row) => row.intentId ?? "unknown")),
    intentReadiness,
    segmentReadiness,
    readinessSummary: buildReadinessSummary(intentReadiness, segmentReadiness),
    authoritySourceCounts: buildStringCounts(rows.map((row) => row.authoritySource)),
    authorityReasonCounts: buildStringCounts(rows.map((row) => row.authorityReason)),
    workflowStatusCounts: buildStringCounts(rows.map((row) => row.workflowStatus ?? "none")),
    effectiveReasonCounts: buildStringCounts(rows.map((row) => row.effectiveReason ?? "none")),
    workflowSelectionProfileCounts: buildStringCounts(rows.flatMap((row) => row.workflowSelectionActiveProfileIds)),
    workflowSelectionProfileToolCounts: buildStringCounts(rows.flatMap((row) => row.workflowSelectionProfileToolNames)),
    signalCounts: buildSignalCounts(rows.flatMap((row) => row.signals)),
    rows,
  };
}

export function buildAssistantWorkflowToolSelectionEvaluationTracePayload(
  evaluation: AssistantWorkflowToolSelectionEvaluation,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    authoritySource: evaluation.authoritySource,
    authorityReason: evaluation.authorityReason,
    workflowStatus: evaluation.workflowStatus,
    intentId: evaluation.intentId,
    hop: evaluation.hop,
    selectedReason: evaluation.selectedReason,
    workflowAuthorityEnabled: evaluation.workflowAuthorityEnabled,
    workflowAuthoritySegmentKey: evaluation.workflowAuthoritySegmentKey,
    workflowAuthoritySegmentEnabled: evaluation.workflowAuthoritySegmentEnabled,
    effectiveReason: evaluation.effectiveReason,
    selectedToolCount: evaluation.selectedToolCount,
    effectiveToolCount: evaluation.effectiveToolCount,
    workflowSuggestedToolCount: evaluation.workflowSuggestedToolCount,
    workflowSelectionCandidateToolCount: evaluation.workflowSelectionCandidateToolCount,
    workflowSelectionActiveProfileIds: evaluation.workflowSelectionActiveProfileIds,
    workflowSelectionProfileToolNames: evaluation.workflowSelectionProfileToolNames,
    workflowSelectionProfileToolCount: evaluation.workflowSelectionProfileToolCount,
    signalCount: evaluation.signalCount,
    warningCount: evaluation.warningCount,
    signals: evaluation.signals.map((signal) => ({
      name: signal.name,
      severity: signal.severity,
      detail: signal.detail,
    })),
  };
}

export function buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload(
  batch: AssistantWorkflowToolSelectionEvaluationBatch,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: batch.generatedAt,
    sourceDecisionCount: batch.sourceDecisionCount,
    rowCount: batch.rowCount,
    interestingRowCount: batch.interestingRowCount,
    warningRowCount: batch.warningRowCount,
    intentCounts: batch.intentCounts,
    readinessSummary: {
      readyIntentCount: batch.readinessSummary.readyIntentCount,
      confirmedIntentCount: batch.readinessSummary.confirmedIntentCount,
      readySegmentCount: batch.readinessSummary.readySegmentCount,
      confirmedSegmentCount: batch.readinessSummary.confirmedSegmentCount,
      warningIntentCount: batch.readinessSummary.warningIntentCount,
      warningSegmentCount: batch.readinessSummary.warningSegmentCount,
    },
    intentReadiness: batch.intentReadiness.map((intent) => ({
      intentId: intent.intentId,
      decisionCount: intent.decisionCount,
      workflowAuthorityCount: intent.workflowAuthorityCount,
      shadowEquivalentCount: intent.shadowEquivalentCount,
      workflowDiffersCount: intent.workflowDiffersCount,
      workflowBlockedCount: intent.workflowBlockedCount,
      workflowUnavailableCount: intent.workflowUnavailableCount,
      warningCount: intent.warningCount,
      workflowAuthorityConfirmed: intent.workflowAuthorityConfirmed,
      readyForWorkflowAuthority: intent.readyForWorkflowAuthority,
    })),
    segmentReadiness: batch.segmentReadiness.map((segment) => ({
      segmentKey: segment.segmentKey,
      intentId: segment.intentId,
      hop: segment.hop,
      selectedReason: segment.selectedReason,
      decisionCount: segment.decisionCount,
      workflowAuthorityCount: segment.workflowAuthorityCount,
      shadowEquivalentCount: segment.shadowEquivalentCount,
      workflowDiffersCount: segment.workflowDiffersCount,
      workflowBlockedCount: segment.workflowBlockedCount,
      workflowUnavailableCount: segment.workflowUnavailableCount,
      warningCount: segment.warningCount,
      workflowAuthorityConfirmed: segment.workflowAuthorityConfirmed,
      readyForWorkflowAuthority: segment.readyForWorkflowAuthority,
    })),
    authoritySourceCounts: batch.authoritySourceCounts,
    authorityReasonCounts: batch.authorityReasonCounts,
    workflowStatusCounts: batch.workflowStatusCounts,
    effectiveReasonCounts: batch.effectiveReasonCounts,
    workflowSelectionProfileCounts: batch.workflowSelectionProfileCounts,
    workflowSelectionProfileToolCounts: batch.workflowSelectionProfileToolCounts,
    signalCounts: batch.signalCounts,
  };
}

export function buildAssistantWorkflowToolSelectionMigrationReport(
  batch: AssistantWorkflowToolSelectionEvaluationBatch,
  options: AssistantWorkflowToolSelectionMigrationReportOptions = {},
): AssistantWorkflowToolSelectionMigrationReport {
  const minDecisionCount = normalizeMinDecisionCount(options.minDecisionCount);
  const intentCandidates = batch.intentReadiness.map((readiness) =>
    buildMigrationCandidate("intent", readiness, minDecisionCount)
  );
  const segmentCandidates = batch.segmentReadiness.map((readiness) =>
    buildMigrationCandidate("segment", readiness, minDecisionCount)
  );
  const readyIntentCandidates = intentCandidates.filter((candidate) =>
    candidate.status === "ready_for_workflow_authority"
  );
  const readySegmentCandidates = segmentCandidates.filter((candidate) =>
    candidate.status === "ready_for_workflow_authority"
  );
  const confirmedIntentCandidates = intentCandidates.filter((candidate) =>
    candidate.status === "workflow_authority_confirmed"
  );
  const confirmedSegmentCandidates = segmentCandidates.filter((candidate) =>
    candidate.status === "workflow_authority_confirmed"
  );
  const reviewCandidates = [...intentCandidates, ...segmentCandidates].filter((candidate) =>
    candidate.status === "needs_review"
  );

  return {
    generatedAt: batch.generatedAt,
    minDecisionCount,
    sourceDecisionCount: batch.sourceDecisionCount,
    rowCount: batch.rowCount,
    suggestedAuthorityIntentIds: uniqueStrings(readyIntentCandidates.map((candidate) => candidate.intentId)),
    suggestedAuthoritySegmentKeys: uniqueStrings(readySegmentCandidates.map((candidate) => candidate.segmentKey ?? "")),
    candidateCount: intentCandidates.length + segmentCandidates.length,
    readyIntentCandidates,
    readySegmentCandidates,
    confirmedIntentCandidates,
    confirmedSegmentCandidates,
    reviewCandidates,
  };
}

export function buildAssistantWorkflowToolSelectionMigrationReportTracePayload(
  report: AssistantWorkflowToolSelectionMigrationReport,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: report.generatedAt,
    minDecisionCount: report.minDecisionCount,
    sourceDecisionCount: report.sourceDecisionCount,
    rowCount: report.rowCount,
    suggestedAuthorityIntentIds: report.suggestedAuthorityIntentIds,
    suggestedAuthoritySegmentKeys: report.suggestedAuthoritySegmentKeys,
    candidateCount: report.candidateCount,
    readyIntentCandidates: report.readyIntentCandidates.map(toMigrationCandidateTracePayload),
    readySegmentCandidates: report.readySegmentCandidates.map(toMigrationCandidateTracePayload),
    confirmedIntentCandidates: report.confirmedIntentCandidates.map(toMigrationCandidateTracePayload),
    confirmedSegmentCandidates: report.confirmedSegmentCandidates.map(toMigrationCandidateTracePayload),
    reviewCandidates: report.reviewCandidates.map(toMigrationCandidateTracePayload),
  };
}

export function buildAssistantWorkflowToolSelectionAuthorityAllowListProposal(
  report: AssistantWorkflowToolSelectionMigrationReport,
  options: AssistantWorkflowToolSelectionAuthorityAllowListProposalOptions = {},
): AssistantWorkflowToolSelectionAuthorityAllowListProposal {
  const currentAuthorityIntentIds = uniqueStrings(options.currentAuthorityIntentIds ?? []);
  const currentAuthoritySegmentKeys = uniqueStrings(options.currentAuthoritySegmentKeys ?? []);
  const suggestedAuthorityIntentIds = uniqueStrings(report.suggestedAuthorityIntentIds);
  const suggestedAuthoritySegmentKeys = uniqueStrings(report.suggestedAuthoritySegmentKeys);
  const addIntentIds = suggestedAuthorityIntentIds.filter((intentId) =>
    !currentAuthorityIntentIds.includes(intentId)
  );
  const addSegmentKeys = suggestedAuthoritySegmentKeys.filter((segmentKey) =>
    !currentAuthoritySegmentKeys.includes(segmentKey)
  );
  const keepIntentIds = currentAuthorityIntentIds;
  const keepSegmentKeys = currentAuthoritySegmentKeys;
  const proposedAuthorityIntentIds = uniqueStrings([...keepIntentIds, ...addIntentIds]);
  const proposedAuthoritySegmentKeys = uniqueStrings([...keepSegmentKeys, ...addSegmentKeys]);
  const reviewIntentIds = uniqueStrings(
    report.reviewCandidates
      .filter((candidate) => candidate.kind === "intent")
      .map((candidate) => candidate.intentId),
  );
  const reviewSegmentKeys = uniqueStrings(
    report.reviewCandidates
      .filter((candidate) => candidate.kind === "segment")
      .map((candidate) => candidate.segmentKey ?? ""),
  );
  const currentIntentIdsWithReviewEvidence = currentAuthorityIntentIds.filter((intentId) =>
    reviewIntentIds.includes(intentId)
  );
  const currentSegmentKeysWithReviewEvidence = currentAuthoritySegmentKeys.filter((segmentKey) =>
    reviewSegmentKeys.includes(segmentKey)
  );

  return {
    generatedAt: report.generatedAt,
    minDecisionCount: report.minDecisionCount,
    sourceDecisionCount: report.sourceDecisionCount,
    rowCount: report.rowCount,
    currentAuthorityIntentIds,
    currentAuthoritySegmentKeys,
    suggestedAuthorityIntentIds,
    suggestedAuthoritySegmentKeys,
    addIntentIds,
    addSegmentKeys,
    keepIntentIds,
    keepSegmentKeys,
    proposedAuthorityIntentIds,
    proposedAuthoritySegmentKeys,
    readyIntentCandidateCount: report.readyIntentCandidates.length,
    readySegmentCandidateCount: report.readySegmentCandidates.length,
    confirmedIntentCandidateCount: report.confirmedIntentCandidates.length,
    confirmedSegmentCandidateCount: report.confirmedSegmentCandidates.length,
    reviewIntentCandidateCount: report.reviewCandidates.filter((candidate) =>
      candidate.kind === "intent"
    ).length,
    reviewSegmentCandidateCount: report.reviewCandidates.filter((candidate) =>
      candidate.kind === "segment"
    ).length,
    reviewIntentIds,
    reviewSegmentKeys,
    currentIntentIdsWithReviewEvidence,
    currentSegmentKeysWithReviewEvidence,
    canApplyAdditions: addIntentIds.length > 0 || addSegmentKeys.length > 0,
    rationale: buildAuthorityAllowListProposalRationale({
      addIntentIds,
      addSegmentKeys,
      currentAuthorityIntentIds,
      currentAuthoritySegmentKeys,
      currentIntentIdsWithReviewEvidence,
      currentSegmentKeysWithReviewEvidence,
      report,
      reviewIntentIds,
      reviewSegmentKeys,
    }),
  };
}

export function buildAssistantWorkflowToolSelectionAuthorityAllowListProposalTracePayload(
  proposal: AssistantWorkflowToolSelectionAuthorityAllowListProposal,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: proposal.generatedAt,
    minDecisionCount: proposal.minDecisionCount,
    sourceDecisionCount: proposal.sourceDecisionCount,
    rowCount: proposal.rowCount,
    currentAuthorityIntentIds: proposal.currentAuthorityIntentIds,
    currentAuthoritySegmentKeys: proposal.currentAuthoritySegmentKeys,
    suggestedAuthorityIntentIds: proposal.suggestedAuthorityIntentIds,
    suggestedAuthoritySegmentKeys: proposal.suggestedAuthoritySegmentKeys,
    addIntentIds: proposal.addIntentIds,
    addSegmentKeys: proposal.addSegmentKeys,
    keepIntentIds: proposal.keepIntentIds,
    keepSegmentKeys: proposal.keepSegmentKeys,
    proposedAuthorityIntentIds: proposal.proposedAuthorityIntentIds,
    proposedAuthoritySegmentKeys: proposal.proposedAuthoritySegmentKeys,
    readyIntentCandidateCount: proposal.readyIntentCandidateCount,
    readySegmentCandidateCount: proposal.readySegmentCandidateCount,
    confirmedIntentCandidateCount: proposal.confirmedIntentCandidateCount,
    confirmedSegmentCandidateCount: proposal.confirmedSegmentCandidateCount,
    reviewIntentCandidateCount: proposal.reviewIntentCandidateCount,
    reviewSegmentCandidateCount: proposal.reviewSegmentCandidateCount,
    reviewIntentIds: proposal.reviewIntentIds,
    reviewSegmentKeys: proposal.reviewSegmentKeys,
    currentIntentIdsWithReviewEvidence: proposal.currentIntentIdsWithReviewEvidence,
    currentSegmentKeysWithReviewEvidence: proposal.currentSegmentKeysWithReviewEvidence,
    canApplyAdditions: proposal.canApplyAdditions,
    rationale: proposal.rationale,
  };
}

export function buildAssistantWorkflowToolSelectionMigrationReviewArtifact(
  input: {
    report: AssistantWorkflowToolSelectionMigrationReport;
    proposal: AssistantWorkflowToolSelectionAuthorityAllowListProposal;
  },
  options: AssistantWorkflowToolSelectionMigrationReviewArtifactOptions = {},
): AssistantWorkflowToolSelectionMigrationReviewArtifact {
  const patchTargets = uniqueStrings(options.patchTargets ?? []);
  const requiredTestIds = uniqueStrings(options.requiredTestIds ?? []);
  const status: AssistantWorkflowToolSelectionMigrationReviewArtifactStatus = input.proposal.canApplyAdditions
    ? "ready_for_runtime_change"
    : "no_runtime_change";

  return {
    generatedAt: input.proposal.generatedAt,
    title: readString(options.title) ?? "Assistant workflow tool-selection migration review",
    status,
    recommendedAction: status === "ready_for_runtime_change"
      ? "apply_authority_allow_list_update"
      : "keep_current_authority",
    minDecisionCount: input.proposal.minDecisionCount,
    sourceDecisionCount: input.proposal.sourceDecisionCount,
    rowCount: input.proposal.rowCount,
    patchTargets,
    requiredTestIds,
    runtimeChange: {
      addIntentIds: input.proposal.addIntentIds,
      addSegmentKeys: input.proposal.addSegmentKeys,
      keepIntentIds: input.proposal.keepIntentIds,
      keepSegmentKeys: input.proposal.keepSegmentKeys,
      proposedAuthorityIntentIds: input.proposal.proposedAuthorityIntentIds,
      proposedAuthoritySegmentKeys: input.proposal.proposedAuthoritySegmentKeys,
    },
    evidence: {
      readyIntentCandidateKeys: input.report.readyIntentCandidates.map((candidate) => candidate.key),
      readySegmentCandidateKeys: input.report.readySegmentCandidates.map((candidate) => candidate.key),
      confirmedIntentCandidateKeys: input.report.confirmedIntentCandidates.map((candidate) => candidate.key),
      confirmedSegmentCandidateKeys: input.report.confirmedSegmentCandidates.map((candidate) => candidate.key),
    },
    review: {
      reviewIntentIds: input.proposal.reviewIntentIds,
      reviewSegmentKeys: input.proposal.reviewSegmentKeys,
      currentIntentIdsWithReviewEvidence: input.proposal.currentIntentIdsWithReviewEvidence,
      currentSegmentKeysWithReviewEvidence: input.proposal.currentSegmentKeysWithReviewEvidence,
      blockerCount: input.report.reviewCandidates.length,
      blockers: input.report.reviewCandidates,
    },
    rationale: buildMigrationReviewArtifactRationale(input.proposal, status),
  };
}

export function buildAssistantWorkflowToolSelectionMigrationReviewArtifactTracePayload(
  artifact: AssistantWorkflowToolSelectionMigrationReviewArtifact,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: artifact.generatedAt,
    title: artifact.title,
    status: artifact.status,
    recommendedAction: artifact.recommendedAction,
    minDecisionCount: artifact.minDecisionCount,
    sourceDecisionCount: artifact.sourceDecisionCount,
    rowCount: artifact.rowCount,
    patchTargets: artifact.patchTargets,
    requiredTestIds: artifact.requiredTestIds,
    runtimeChange: {
      addIntentIds: artifact.runtimeChange.addIntentIds,
      addSegmentKeys: artifact.runtimeChange.addSegmentKeys,
      keepIntentIds: artifact.runtimeChange.keepIntentIds,
      keepSegmentKeys: artifact.runtimeChange.keepSegmentKeys,
      proposedAuthorityIntentIds: artifact.runtimeChange.proposedAuthorityIntentIds,
      proposedAuthoritySegmentKeys: artifact.runtimeChange.proposedAuthoritySegmentKeys,
    },
    evidence: {
      readyIntentCandidateKeys: artifact.evidence.readyIntentCandidateKeys,
      readySegmentCandidateKeys: artifact.evidence.readySegmentCandidateKeys,
      confirmedIntentCandidateKeys: artifact.evidence.confirmedIntentCandidateKeys,
      confirmedSegmentCandidateKeys: artifact.evidence.confirmedSegmentCandidateKeys,
    },
    review: {
      reviewIntentIds: artifact.review.reviewIntentIds,
      reviewSegmentKeys: artifact.review.reviewSegmentKeys,
      currentIntentIdsWithReviewEvidence: artifact.review.currentIntentIdsWithReviewEvidence,
      currentSegmentKeysWithReviewEvidence: artifact.review.currentSegmentKeysWithReviewEvidence,
      blockerCount: artifact.review.blockerCount,
      blockers: artifact.review.blockers.map(toMigrationCandidateTracePayload),
    },
    rationale: artifact.rationale,
  };
}

function buildReadinessSummary(
  intentReadiness: readonly AssistantWorkflowToolSelectionEvaluationIntentReadiness[],
  segmentReadiness: readonly AssistantWorkflowToolSelectionEvaluationSegmentReadiness[],
): AssistantWorkflowToolSelectionEvaluationReadinessSummary {
  return {
    readyIntentCount: intentReadiness.filter((intent) => intent.readyForWorkflowAuthority).length,
    confirmedIntentCount: intentReadiness.filter((intent) => intent.workflowAuthorityConfirmed).length,
    readySegmentCount: segmentReadiness.filter((segment) => segment.readyForWorkflowAuthority).length,
    confirmedSegmentCount: segmentReadiness.filter((segment) => segment.workflowAuthorityConfirmed).length,
    warningIntentCount: intentReadiness.filter((intent) => intent.warningCount > 0).length,
    warningSegmentCount: segmentReadiness.filter((segment) => segment.warningCount > 0).length,
  };
}

function buildMigrationCandidate(
  kind: AssistantWorkflowToolSelectionMigrationCandidateKind,
  readiness: AssistantWorkflowToolSelectionEvaluationIntentReadiness | AssistantWorkflowToolSelectionEvaluationSegmentReadiness,
  minDecisionCount: number,
): AssistantWorkflowToolSelectionMigrationCandidate {
  const isSegment = isSegmentReadiness(readiness);
  const key = isSegment ? readiness.segmentKey : readiness.intentId;
  const blockingReasons = collectMigrationBlockingReasons(readiness, minDecisionCount);
  const status: AssistantWorkflowToolSelectionMigrationCandidateStatus = blockingReasons.length > 0
    ? "needs_review"
    : readiness.workflowAuthorityConfirmed
      ? "workflow_authority_confirmed"
      : readiness.readyForWorkflowAuthority
        ? "ready_for_workflow_authority"
        : "needs_review";
  const recommendedAction = buildMigrationRecommendedAction(kind, status);

  return {
    kind,
    key,
    intentId: readiness.intentId,
    segmentKey: isSegment ? readiness.segmentKey : null,
    hop: isSegment ? readiness.hop : null,
    selectedReason: isSegment ? readiness.selectedReason : null,
    decisionCount: readiness.decisionCount,
    workflowAuthorityCount: readiness.workflowAuthorityCount,
    shadowEquivalentCount: readiness.shadowEquivalentCount,
    workflowDiffersCount: readiness.workflowDiffersCount,
    workflowBlockedCount: readiness.workflowBlockedCount,
    workflowUnavailableCount: readiness.workflowUnavailableCount,
    warningCount: readiness.warningCount,
    status,
    recommendedAction,
    blockingReasons,
    rationale: buildMigrationRationale(kind, status, readiness, blockingReasons, minDecisionCount),
  };
}

function collectMigrationBlockingReasons(
  readiness: AssistantWorkflowToolSelectionEvaluationIntentReadiness,
  minDecisionCount: number,
): string[] {
  const reasons: string[] = [];
  if (readiness.intentId === "unknown") reasons.push("unknown_intent");
  if (readiness.decisionCount < minDecisionCount) reasons.push("insufficient_decisions");
  if (readiness.warningCount > 0) reasons.push("warnings_present");
  if (readiness.workflowDiffersCount > 0) reasons.push("workflow_differs");
  if (readiness.workflowBlockedCount > 0) reasons.push("workflow_blocked");
  if (readiness.workflowUnavailableCount > 0) reasons.push("workflow_unavailable");
  if (
    readiness.workflowAuthorityCount > 0 &&
    readiness.shadowEquivalentCount > 0 &&
    readiness.workflowDiffersCount === 0 &&
    readiness.workflowBlockedCount === 0 &&
    readiness.workflowUnavailableCount === 0
  ) {
    reasons.push("mixed_authority_evidence");
  }
  if (
    readiness.workflowAuthorityCount === 0 &&
    readiness.shadowEquivalentCount === 0 &&
    readiness.workflowDiffersCount === 0 &&
    readiness.workflowBlockedCount === 0 &&
    readiness.workflowUnavailableCount === 0
  ) {
    reasons.push("no_workflow_equivalence_evidence");
  }
  return reasons;
}

function buildMigrationRecommendedAction(
  kind: AssistantWorkflowToolSelectionMigrationCandidateKind,
  status: AssistantWorkflowToolSelectionMigrationCandidateStatus,
): AssistantWorkflowToolSelectionMigrationRecommendedAction {
  if (status === "workflow_authority_confirmed") return "keep_runtime_authority";
  if (status === "ready_for_workflow_authority") {
    return kind === "intent"
      ? "add_intent_to_authority_allow_list"
      : "review_segment_before_authority_change";
  }
  return "review_blockers_before_migration";
}

function buildMigrationRationale(
  kind: AssistantWorkflowToolSelectionMigrationCandidateKind,
  status: AssistantWorkflowToolSelectionMigrationCandidateStatus,
  readiness: AssistantWorkflowToolSelectionEvaluationIntentReadiness,
  blockingReasons: readonly string[],
  minDecisionCount: number,
): string {
  const scope = kind === "intent" ? `intent ${readiness.intentId}` : `segment ${getReadinessKey(readiness)}`;
  if (status === "workflow_authority_confirmed") {
    return `${scope} is already workflow-owned across ${readiness.decisionCount} decision(s) without warnings.`;
  }
  if (status === "ready_for_workflow_authority") {
    return `${scope} has ${readiness.shadowEquivalentCount} shadow-equivalent decision(s), no warnings, and meets minDecisionCount=${minDecisionCount}.`;
  }
  return `${scope} is not ready for runtime migration: ${blockingReasons.join(", ") || "unknown_reason"}.`;
}

function getReadinessKey(
  readiness: AssistantWorkflowToolSelectionEvaluationIntentReadiness,
): string {
  return isSegmentReadiness(readiness) ? readiness.segmentKey : readiness.intentId;
}

function isSegmentReadiness(
  readiness: AssistantWorkflowToolSelectionEvaluationIntentReadiness | AssistantWorkflowToolSelectionEvaluationSegmentReadiness,
): readiness is AssistantWorkflowToolSelectionEvaluationSegmentReadiness {
  return "segmentKey" in readiness;
}

function toMigrationCandidateTracePayload(
  candidate: AssistantWorkflowToolSelectionMigrationCandidate,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    kind: candidate.kind,
    key: candidate.key,
    intentId: candidate.intentId,
    segmentKey: candidate.segmentKey,
    hop: candidate.hop,
    selectedReason: candidate.selectedReason,
    decisionCount: candidate.decisionCount,
    workflowAuthorityCount: candidate.workflowAuthorityCount,
    shadowEquivalentCount: candidate.shadowEquivalentCount,
    workflowDiffersCount: candidate.workflowDiffersCount,
    workflowBlockedCount: candidate.workflowBlockedCount,
    workflowUnavailableCount: candidate.workflowUnavailableCount,
    warningCount: candidate.warningCount,
    status: candidate.status,
    recommendedAction: candidate.recommendedAction,
    blockingReasons: candidate.blockingReasons,
    rationale: candidate.rationale,
  };
}

function buildAuthorityAllowListProposalRationale(input: {
  addIntentIds: readonly string[];
  addSegmentKeys: readonly string[];
  currentAuthorityIntentIds: readonly string[];
  currentAuthoritySegmentKeys: readonly string[];
  currentIntentIdsWithReviewEvidence: readonly string[];
  currentSegmentKeysWithReviewEvidence: readonly string[];
  report: AssistantWorkflowToolSelectionMigrationReport;
  reviewIntentIds: readonly string[];
  reviewSegmentKeys: readonly string[];
}): string[] {
  const rationale: string[] = [];
  if (input.addIntentIds.length > 0) {
    rationale.push(
      `Add ${input.addIntentIds.join(", ")} to workflow authority after ${input.report.minDecisionCount} matching decision(s) with no blockers.`,
    );
  } else {
    rationale.push("No new intent-level workflow authority additions are ready.");
  }
  if (input.addSegmentKeys.length > 0) {
    rationale.push(
      `Add segment authority for ${input.addSegmentKeys.join(", ")} after ${input.report.minDecisionCount} matching decision(s) with no blockers.`,
    );
  } else {
    rationale.push("No new segment-level workflow authority additions are ready.");
  }
  if (input.currentAuthorityIntentIds.length > 0) {
    rationale.push(`Keep existing workflow authority intents: ${input.currentAuthorityIntentIds.join(", ")}.`);
  }
  if (input.currentAuthoritySegmentKeys.length > 0) {
    rationale.push(`Keep existing workflow authority segments: ${input.currentAuthoritySegmentKeys.join(", ")}.`);
  }
  if (input.currentIntentIdsWithReviewEvidence.length > 0) {
    rationale.push(
      `Review existing authority evidence for: ${input.currentIntentIdsWithReviewEvidence.join(", ")}.`,
    );
  }
  if (input.currentSegmentKeysWithReviewEvidence.length > 0) {
    rationale.push(
      `Review existing segment authority evidence for: ${input.currentSegmentKeysWithReviewEvidence.join(", ")}.`,
    );
  }
  if (input.reviewIntentIds.length > 0) {
    rationale.push(`Review blocked intent candidates before migration: ${input.reviewIntentIds.join(", ")}.`);
  }
  if (input.reviewSegmentKeys.length > 0) {
    rationale.push(`Review blocked segment candidates before migration: ${input.reviewSegmentKeys.join(", ")}.`);
  }
  return rationale;
}

function buildMigrationReviewArtifactRationale(
  proposal: AssistantWorkflowToolSelectionAuthorityAllowListProposal,
  status: AssistantWorkflowToolSelectionMigrationReviewArtifactStatus,
): string[] {
  if (status === "ready_for_runtime_change") {
    return [
      "Migration proposal has ready allow-list additions.",
      ...proposal.rationale,
    ];
  }
  return [
    "Migration proposal does not require a runtime allow-list change.",
    ...proposal.rationale,
  ];
}

function normalizeMinDecisionCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function isInterestingRow(row: AssistantWorkflowToolSelectionEvaluation): boolean {
  return row.authoritySource !== "workflow";
}

function summarizeDifference(
  missingCandidateTools: readonly string[],
  selectedOutsideCandidate: readonly string[],
): string | null {
  const parts = [
    missingCandidateTools.length > 0 ? `missing=${missingCandidateTools.join(",")}` : "",
    selectedOutsideCandidate.length > 0 ? `outside=${selectedOutsideCandidate.join(",")}` : "",
  ].filter((part) => part.length > 0);
  return parts.length ? parts.join("; ") : null;
}

function buildIntentReadiness(
  rows: readonly AssistantWorkflowToolSelectionEvaluation[],
): AssistantWorkflowToolSelectionEvaluationIntentReadiness[] {
  const byIntent = new Map<string, AssistantWorkflowToolSelectionEvaluation[]>();
  for (const row of rows) {
    const intentId = row.intentId ?? "unknown";
    const current = byIntent.get(intentId) ?? [];
    current.push(row);
    byIntent.set(intentId, current);
  }

  return [...byIntent.entries()]
    .map(([intentId, intentRows]) => {
      const workflowAuthorityCount = intentRows.filter((row) => row.authoritySource === "workflow").length;
      const shadowEquivalentCount = intentRows.filter((row) =>
        row.authorityReason === "workflow_authority_not_enabled"
      ).length;
      const workflowDiffersCount = intentRows.filter((row) =>
        row.authorityReason === "workflow_differs"
      ).length;
      const workflowBlockedCount = intentRows.filter((row) =>
        row.authorityReason === "workflow_blocked"
      ).length;
      const workflowUnavailableCount = intentRows.filter((row) =>
        row.authorityReason === "workflow_unavailable"
      ).length;
      const warningCount = intentRows.reduce((total, row) => total + row.warningCount, 0);

      return {
        intentId,
        decisionCount: intentRows.length,
        workflowAuthorityCount,
        shadowEquivalentCount,
        workflowDiffersCount,
        workflowBlockedCount,
        workflowUnavailableCount,
        warningCount,
        workflowAuthorityConfirmed: (
          intentId !== "unknown" &&
          workflowAuthorityCount > 0 &&
          shadowEquivalentCount === 0 &&
          workflowDiffersCount === 0 &&
          workflowBlockedCount === 0 &&
          workflowUnavailableCount === 0 &&
          warningCount === 0
        ),
        readyForWorkflowAuthority: (
          intentId !== "unknown" &&
          workflowAuthorityCount === 0 &&
          shadowEquivalentCount > 0 &&
          workflowDiffersCount === 0 &&
          workflowBlockedCount === 0 &&
          workflowUnavailableCount === 0 &&
          warningCount === 0
        ),
      };
    })
    .sort((left, right) => {
      if (left.readyForWorkflowAuthority !== right.readyForWorkflowAuthority) {
        return left.readyForWorkflowAuthority ? -1 : 1;
      }
      if (left.workflowAuthorityConfirmed !== right.workflowAuthorityConfirmed) {
        return left.workflowAuthorityConfirmed ? -1 : 1;
      }
      if (right.shadowEquivalentCount !== left.shadowEquivalentCount) {
        return right.shadowEquivalentCount - left.shadowEquivalentCount;
      }
      if (right.decisionCount !== left.decisionCount) return right.decisionCount - left.decisionCount;
      return left.intentId.localeCompare(right.intentId);
    });
}

function buildSegmentReadiness(
  rows: readonly AssistantWorkflowToolSelectionEvaluation[],
): AssistantWorkflowToolSelectionEvaluationSegmentReadiness[] {
  const bySegment = new Map<string, AssistantWorkflowToolSelectionEvaluation[]>();
  for (const row of rows) {
    const segmentKey = buildSegmentKey(row);
    const current = bySegment.get(segmentKey) ?? [];
    current.push(row);
    bySegment.set(segmentKey, current);
  }

  return [...bySegment.entries()]
    .map(([segmentKey, segmentRows]) => {
      const [base] = segmentRows;
      const intentReadiness = buildIntentReadiness(segmentRows)[0] ?? {
        intentId: base?.intentId ?? "unknown",
        decisionCount: 0,
        workflowAuthorityCount: 0,
        shadowEquivalentCount: 0,
        workflowDiffersCount: 0,
        workflowBlockedCount: 0,
        workflowUnavailableCount: 0,
        warningCount: 0,
        workflowAuthorityConfirmed: false,
        readyForWorkflowAuthority: false,
      };

      return {
        ...intentReadiness,
        segmentKey,
        hop: base?.hop ?? null,
        selectedReason: base?.selectedReason ?? null,
      };
    })
    .sort((left, right) => {
      if (left.readyForWorkflowAuthority !== right.readyForWorkflowAuthority) {
        return left.readyForWorkflowAuthority ? -1 : 1;
      }
      if (left.workflowAuthorityConfirmed !== right.workflowAuthorityConfirmed) {
        return left.workflowAuthorityConfirmed ? -1 : 1;
      }
      if (right.shadowEquivalentCount !== left.shadowEquivalentCount) {
        return right.shadowEquivalentCount - left.shadowEquivalentCount;
      }
      if (right.decisionCount !== left.decisionCount) return right.decisionCount - left.decisionCount;
      return left.segmentKey.localeCompare(right.segmentKey);
    });
}

function buildSegmentKey(row: AssistantWorkflowToolSelectionEvaluation): string {
  return buildAssistantWorkflowToolSelectionSegmentKey({
    intentId: row.intentId,
    hop: row.hop,
    selectedReason: row.selectedReason,
  });
}

function buildStringCounts(values: readonly string[]): AssistantWorkflowToolSelectionEvaluationBatchCount[] {
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

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed.length || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function buildSignalCounts(
  signals: readonly AssistantWorkflowToolSelectionEvaluationSignal[],
): AssistantWorkflowToolSelectionEvaluationBatchSignalCount[] {
  const counts = new Map<string, AssistantWorkflowToolSelectionEvaluationBatchSignalCount>();
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

function readStringArray(value: AssistantWorkflowJsonValue | undefined): string[] {
  return readAssistantWorkflowStringArray(value, {
    trim: false,
    allowEmpty: true,
    unique: false,
    requireAllStrings: true,
  });
}
