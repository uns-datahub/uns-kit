import type { AssistantWorkflowRunReport } from "./run-report.js";
import type {
  AssistantWorkflowRunEvaluationSignal,
  AssistantWorkflowRunEvaluationSignalName,
} from "./run-evaluation.js";

export type AssistantWorkflowRunReportBatchOptions = {
  onlyInteresting?: boolean;
};

export type AssistantWorkflowRunReportBatchCount = {
  key: string;
  count: number;
};

export type AssistantWorkflowRunReportBatchSignalCount = {
  name: AssistantWorkflowRunEvaluationSignalName;
  severity: "info" | "warning";
  count: number;
};

export type AssistantWorkflowRunReportBatchRow = {
  workflowId: string;
  workflowVersion: number;
  status: AssistantWorkflowRunReport["status"];
  intent: string | null;
  outcomeKind: string;
  handled: boolean;
  toolResultStatus: string | null;
  toolResultProviders: string[];
  activePlanningStepProfileIds: string[];
  profileStepIds: string[];
  directRouteDoneRoutes: string[];
  directRouteRecoveredRoutes: string[];
  directRouteErrorRoutes: string[];
  directRouteSkipReasons: string[];
  directRouteGapReasons: string[];
  directRouteObservedStrategies: string[];
  directRouteUndeclaredStrategies: string[];
  memoryChangedSlots: string[];
  memoryChangedProfileFields: string[];
  memorySkippedPatchReasons: string[];
  threadProfileWriteSources: string[];
  threadProfileWriteReasons: string[];
  threadProfileWriteChangedFields: string[];
  signalCount: number;
  warningCount: number;
  signals: AssistantWorkflowRunEvaluationSignal[];
};

export type AssistantWorkflowRunReportBatch = {
  generatedAt: string;
  sourceReportCount: number;
  rowCount: number;
  interestingRowCount: number;
  warningRowCount: number;
  statusCounts: AssistantWorkflowRunReportBatchCount[];
  intentCounts: AssistantWorkflowRunReportBatchCount[];
  outcomeCounts: AssistantWorkflowRunReportBatchCount[];
  toolResultStatusCounts: AssistantWorkflowRunReportBatchCount[];
  toolProviderResultCounts: AssistantWorkflowRunReportBatchCount[];
  activePlanningStepProfileCounts: AssistantWorkflowRunReportBatchCount[];
  profileStepCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteDoneCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteRecoveredCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteErrorCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteSkipReasonCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteGapReasonCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteObservedStrategyCounts: AssistantWorkflowRunReportBatchCount[];
  directRouteUndeclaredStrategyCounts: AssistantWorkflowRunReportBatchCount[];
  memoryChangedSlotCounts: AssistantWorkflowRunReportBatchCount[];
  memoryChangedProfileFieldCounts: AssistantWorkflowRunReportBatchCount[];
  memorySkippedPatchReasonCounts: AssistantWorkflowRunReportBatchCount[];
  threadProfileWriteSourceCounts: AssistantWorkflowRunReportBatchCount[];
  threadProfileWriteReasonCounts: AssistantWorkflowRunReportBatchCount[];
  threadProfileWriteChangedFieldCounts: AssistantWorkflowRunReportBatchCount[];
  signalCounts: AssistantWorkflowRunReportBatchSignalCount[];
  rows: AssistantWorkflowRunReportBatchRow[];
};

export type AssistantWorkflowPlanningProfileMigrationCandidateStatus = "ready_for_runtime_change" | "needs_review";

export type AssistantWorkflowPlanningProfileMigrationCandidate = {
  profileId: string;
  runCount: number;
  completedCount: number;
  handledCount: number;
  warningRowCount: number;
  failedCount: number;
  degradedCount: number;
  clarificationCount: number;
  notHandledCount: number;
  profileStepIds: string[];
  signalCounts: AssistantWorkflowRunReportBatchSignalCount[];
  signalDetails: string[];
  status: AssistantWorkflowPlanningProfileMigrationCandidateStatus;
  blockingReasons: string[];
};

export type AssistantWorkflowPlanningProfileMigrationReportOptions = {
  currentRuntimeProfileIds?: readonly string[] | null;
  minRunCount?: number | null;
  generatedAt?: string | null;
};

export type AssistantWorkflowPlanningProfileMigrationReport = {
  generatedAt: string;
  minRunCount: number;
  sourceReportCount: number;
  rowCount: number;
  observedProfileCount: number;
  currentRuntimeProfileIds: string[];
  readyProfileIds: string[];
  reviewProfileIds: string[];
  addProfileIds: string[];
  keepProfileIds: string[];
  proposedRuntimeProfileIds: string[];
  candidates: AssistantWorkflowPlanningProfileMigrationCandidate[];
  readyCandidates: AssistantWorkflowPlanningProfileMigrationCandidate[];
  reviewCandidates: AssistantWorkflowPlanningProfileMigrationCandidate[];
};

export type AssistantWorkflowPlanningProfileMigrationReviewArtifactStatus =
  | "ready_for_runtime_change"
  | "no_runtime_change";

export type AssistantWorkflowPlanningProfileMigrationReviewArtifactRecommendedAction =
  | "apply_planning_profile_runtime_update"
  | "keep_current_runtime";

export type AssistantWorkflowPlanningProfileMigrationReviewArtifactOptions = {
  title?: string | null;
  patchTargets?: readonly string[] | null;
  requiredTestIds?: readonly string[] | null;
};

export type AssistantWorkflowPlanningProfileMigrationReviewArtifact = {
  generatedAt: string;
  title: string;
  status: AssistantWorkflowPlanningProfileMigrationReviewArtifactStatus;
  recommendedAction: AssistantWorkflowPlanningProfileMigrationReviewArtifactRecommendedAction;
  rationale: string;
  patchTargets: string[];
  requiredTestIds: string[];
  runtimeChange: {
    currentRuntimeProfileIds: string[];
    addProfileIds: string[];
    keepProfileIds: string[];
    proposedRuntimeProfileIds: string[];
  };
  evidence: {
    minRunCount: number;
    sourceReportCount: number;
    rowCount: number;
    readyProfileIds: string[];
    readyCandidates: AssistantWorkflowPlanningProfileMigrationCandidate[];
  };
  review: {
    reviewProfileIds: string[];
    reviewCandidates: AssistantWorkflowPlanningProfileMigrationCandidate[];
    blockerCount: number;
  };
};

export function buildAssistantWorkflowRunReportBatch(
  reports: readonly AssistantWorkflowRunReport[],
  options: AssistantWorkflowRunReportBatchOptions = {},
): AssistantWorkflowRunReportBatch {
  const allRows = reports.map(toBatchRow);
  const rows = options.onlyInteresting === true ? allRows.filter(isInterestingRow) : allRows;

  return {
    generatedAt: new Date().toISOString(),
    sourceReportCount: reports.length,
    rowCount: rows.length,
    interestingRowCount: rows.filter(isInterestingRow).length,
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

export function buildAssistantWorkflowPlanningProfileMigrationReport(
  batch: AssistantWorkflowRunReportBatch,
  options: AssistantWorkflowPlanningProfileMigrationReportOptions = {},
): AssistantWorkflowPlanningProfileMigrationReport {
  const minRunCount = normalizeMinRunCount(options.minRunCount);
  const currentRuntimeProfileIds = uniqueNonEmptyStrings(options.currentRuntimeProfileIds ?? []);
  const currentRuntimeProfileIdSet = new Set(currentRuntimeProfileIds);
  const candidates = buildPlanningProfileMigrationCandidates(batch.rows, minRunCount);
  const readyCandidates = candidates.filter((candidate) => candidate.status === "ready_for_runtime_change");
  const reviewCandidates = candidates.filter((candidate) => candidate.status === "needs_review");
  const readyProfileIds = readyCandidates.map((candidate) => candidate.profileId);
  const reviewProfileIds = reviewCandidates.map((candidate) => candidate.profileId);
  const addProfileIds = readyProfileIds.filter((profileId) => !currentRuntimeProfileIdSet.has(profileId));
  const keepProfileIds = currentRuntimeProfileIds;

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    minRunCount,
    sourceReportCount: batch.sourceReportCount,
    rowCount: batch.rowCount,
    observedProfileCount: candidates.length,
    currentRuntimeProfileIds,
    readyProfileIds,
    reviewProfileIds,
    addProfileIds,
    keepProfileIds,
    proposedRuntimeProfileIds: uniqueNonEmptyStrings([...currentRuntimeProfileIds, ...addProfileIds]),
    candidates,
    readyCandidates,
    reviewCandidates,
  };
}

export function buildAssistantWorkflowPlanningProfileMigrationReportTracePayload(
  report: AssistantWorkflowPlanningProfileMigrationReport,
): Record<string, unknown> {
  return {
    generatedAt: report.generatedAt,
    minRunCount: report.minRunCount,
    sourceReportCount: report.sourceReportCount,
    rowCount: report.rowCount,
    observedProfileCount: report.observedProfileCount,
    currentRuntimeProfileIds: report.currentRuntimeProfileIds,
    readyProfileIds: report.readyProfileIds,
    reviewProfileIds: report.reviewProfileIds,
    addProfileIds: report.addProfileIds,
    keepProfileIds: report.keepProfileIds,
    proposedRuntimeProfileIds: report.proposedRuntimeProfileIds,
    candidates: report.candidates.map((candidate) => ({
      profileId: candidate.profileId,
      runCount: candidate.runCount,
      completedCount: candidate.completedCount,
      handledCount: candidate.handledCount,
      warningRowCount: candidate.warningRowCount,
      failedCount: candidate.failedCount,
      degradedCount: candidate.degradedCount,
      clarificationCount: candidate.clarificationCount,
      notHandledCount: candidate.notHandledCount,
      profileStepIds: candidate.profileStepIds,
      signalCounts: candidate.signalCounts,
      signalDetails: candidate.signalDetails,
      status: candidate.status,
      blockingReasons: candidate.blockingReasons,
    })),
  };
}

export function buildAssistantWorkflowPlanningProfileMigrationReviewArtifact(
  report: AssistantWorkflowPlanningProfileMigrationReport,
  options: AssistantWorkflowPlanningProfileMigrationReviewArtifactOptions = {},
): AssistantWorkflowPlanningProfileMigrationReviewArtifact {
  const status = report.addProfileIds.length > 0 ? "ready_for_runtime_change" : "no_runtime_change";
  const recommendedAction =
    status === "ready_for_runtime_change"
      ? "apply_planning_profile_runtime_update"
      : "keep_current_runtime";

  return {
    generatedAt: report.generatedAt,
    title: normalizeOptionalText(options.title) ?? "Assistant workflow planning-profile migration review",
    status,
    recommendedAction,
    rationale: buildPlanningProfileMigrationReviewRationale(report),
    patchTargets: uniqueNonEmptyStrings(options.patchTargets ?? []),
    requiredTestIds: uniqueNonEmptyStrings(options.requiredTestIds ?? []),
    runtimeChange: {
      currentRuntimeProfileIds: report.currentRuntimeProfileIds,
      addProfileIds: report.addProfileIds,
      keepProfileIds: report.keepProfileIds,
      proposedRuntimeProfileIds: report.proposedRuntimeProfileIds,
    },
    evidence: {
      minRunCount: report.minRunCount,
      sourceReportCount: report.sourceReportCount,
      rowCount: report.rowCount,
      readyProfileIds: report.readyProfileIds,
      readyCandidates: report.readyCandidates,
    },
    review: {
      reviewProfileIds: report.reviewProfileIds,
      reviewCandidates: report.reviewCandidates,
      blockerCount: report.reviewCandidates.reduce(
        (count, candidate) => count + candidate.blockingReasons.length,
        0,
      ),
    },
  };
}

export function buildAssistantWorkflowPlanningProfileMigrationReviewArtifactTracePayload(
  artifact: AssistantWorkflowPlanningProfileMigrationReviewArtifact,
): Record<string, unknown> {
  return {
    generatedAt: artifact.generatedAt,
    title: artifact.title,
    status: artifact.status,
    recommendedAction: artifact.recommendedAction,
    rationale: artifact.rationale,
    patchTargets: artifact.patchTargets,
    requiredTestIds: artifact.requiredTestIds,
    runtimeChange: artifact.runtimeChange,
    evidence: {
      minRunCount: artifact.evidence.minRunCount,
      sourceReportCount: artifact.evidence.sourceReportCount,
      rowCount: artifact.evidence.rowCount,
      readyProfileIds: artifact.evidence.readyProfileIds,
      readyCandidates: artifact.evidence.readyCandidates,
    },
    review: artifact.review,
  };
}

export function buildAssistantWorkflowRunReportBatchTracePayload(
  batch: AssistantWorkflowRunReportBatch,
): Record<string, unknown> {
  return {
    generatedAt: batch.generatedAt,
    sourceReportCount: batch.sourceReportCount,
    rowCount: batch.rowCount,
    interestingRowCount: batch.interestingRowCount,
    warningRowCount: batch.warningRowCount,
    statusCounts: batch.statusCounts,
    intentCounts: batch.intentCounts,
    outcomeCounts: batch.outcomeCounts,
    toolResultStatusCounts: batch.toolResultStatusCounts,
    toolProviderResultCounts: batch.toolProviderResultCounts,
    activePlanningStepProfileCounts: batch.activePlanningStepProfileCounts,
    profileStepCounts: batch.profileStepCounts,
    directRouteDoneCounts: batch.directRouteDoneCounts,
    directRouteRecoveredCounts: batch.directRouteRecoveredCounts,
    directRouteErrorCounts: batch.directRouteErrorCounts,
    directRouteSkipReasonCounts: batch.directRouteSkipReasonCounts,
    directRouteGapReasonCounts: batch.directRouteGapReasonCounts,
    directRouteObservedStrategyCounts: batch.directRouteObservedStrategyCounts,
    directRouteUndeclaredStrategyCounts: batch.directRouteUndeclaredStrategyCounts,
    memoryChangedSlotCounts: batch.memoryChangedSlotCounts,
    memoryChangedProfileFieldCounts: batch.memoryChangedProfileFieldCounts,
    memorySkippedPatchReasonCounts: batch.memorySkippedPatchReasonCounts,
    threadProfileWriteSourceCounts: batch.threadProfileWriteSourceCounts,
    threadProfileWriteReasonCounts: batch.threadProfileWriteReasonCounts,
    threadProfileWriteChangedFieldCounts: batch.threadProfileWriteChangedFieldCounts,
    signalCounts: batch.signalCounts,
  };
}

function buildPlanningProfileMigrationCandidates(
  rows: readonly AssistantWorkflowRunReportBatchRow[],
  minRunCount: number,
): AssistantWorkflowPlanningProfileMigrationCandidate[] {
  const candidatesByProfileId = new Map<string, AssistantWorkflowPlanningProfileMigrationCandidate>();

  for (const row of rows) {
    for (const profileId of uniqueNonEmptyStrings(row.activePlanningStepProfileIds)) {
      const candidate = candidatesByProfileId.get(profileId) ?? {
        profileId,
        runCount: 0,
        completedCount: 0,
        handledCount: 0,
        warningRowCount: 0,
        failedCount: 0,
        degradedCount: 0,
        clarificationCount: 0,
        notHandledCount: 0,
        profileStepIds: [],
        signalCounts: [],
        signalDetails: [],
        status: "needs_review",
        blockingReasons: [],
      };
      candidate.runCount += 1;
      if (row.status === "completed") candidate.completedCount += 1;
      if (row.status === "failed") candidate.failedCount += 1;
      if (row.status === "degraded") candidate.degradedCount += 1;
      if (row.status === "clarification") candidate.clarificationCount += 1;
      if (row.status === "not_handled") candidate.notHandledCount += 1;
      if (row.handled) candidate.handledCount += 1;
      if (row.warningCount > 0) candidate.warningRowCount += 1;
      candidate.profileStepIds = uniqueNonEmptyStrings([...candidate.profileStepIds, ...row.profileStepIds]);
      candidate.signalCounts = mergeSignalCounts(candidate.signalCounts, row.signals);
      candidate.signalDetails = uniqueNonEmptyStrings([
        ...candidate.signalDetails,
        ...row.signals
          .map((signal) => signal.detail ?? signal.name)
          .filter((detail) => detail.length > 0),
      ]);
      candidatesByProfileId.set(profileId, candidate);
    }
  }

  return [...candidatesByProfileId.values()]
    .map((candidate) => finalizePlanningProfileMigrationCandidate(candidate, minRunCount))
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "ready_for_runtime_change" ? -1 : 1;
      }
      if (right.runCount !== left.runCount) return right.runCount - left.runCount;
      return left.profileId.localeCompare(right.profileId);
    });
}

function finalizePlanningProfileMigrationCandidate(
  candidate: AssistantWorkflowPlanningProfileMigrationCandidate,
  minRunCount: number,
): AssistantWorkflowPlanningProfileMigrationCandidate {
  const blockingReasons: string[] = [];
  if (candidate.runCount < minRunCount) {
    blockingReasons.push(`run_count_below_minimum:${candidate.runCount}/${minRunCount}`);
  }
  if (candidate.completedCount !== candidate.runCount) {
    blockingReasons.push(`non_completed_runs:${candidate.runCount - candidate.completedCount}`);
  }
  if (candidate.handledCount !== candidate.runCount) {
    blockingReasons.push(`unhandled_runs:${candidate.runCount - candidate.handledCount}`);
  }
  if (candidate.warningRowCount > 0) {
    blockingReasons.push(`warning_rows:${candidate.warningRowCount}`);
  }
  if (candidate.profileStepIds.length === 0) {
    blockingReasons.push("missing_profile_steps");
  }

  return {
    ...candidate,
    status: blockingReasons.length === 0 ? "ready_for_runtime_change" : "needs_review",
    blockingReasons,
  };
}

function buildPlanningProfileMigrationReviewRationale(
  report: AssistantWorkflowPlanningProfileMigrationReport,
): string {
  if (report.addProfileIds.length > 0) {
    return [
      `Ready planning profiles: ${report.addProfileIds.join(", ")}.`,
      `Minimum evidence threshold: ${report.minRunCount} run(s).`,
      report.reviewProfileIds.length > 0
        ? `Profiles still needing review: ${report.reviewProfileIds.join(", ")}.`
        : "No observed planning profiles need review.",
    ].join(" ");
  }
  if (report.readyProfileIds.length > 0) {
    return [
      "Observed ready planning profiles are already in the current runtime set.",
      `Ready profiles: ${report.readyProfileIds.join(", ")}.`,
    ].join(" ");
  }
  if (report.reviewProfileIds.length > 0) {
    return [
      "No planning-profile runtime change is recommended.",
      `Profiles still need review: ${report.reviewProfileIds.join(", ")}.`,
    ].join(" ");
  }
  return "No active planning-step profiles were observed in the supplied run-report batch.";
}

function toBatchRow(report: AssistantWorkflowRunReport): AssistantWorkflowRunReportBatchRow {
  return {
    workflowId: report.workflowId,
    workflowVersion: report.workflowVersion,
    status: report.status,
    intent: report.evaluation.intent,
    outcomeKind: report.evaluation.outcomeKind,
    handled: report.evaluation.handled,
    toolResultStatus: report.evaluation.toolResultStatus,
    toolResultProviders: report.toolExecution?.results.map((result) => result.provider) ?? [],
    activePlanningStepProfileIds: report.evaluation.activePlanningStepProfileIds,
    profileStepIds: report.evaluation.profileStepIds,
    directRouteDoneRoutes: [],
    directRouteRecoveredRoutes: [],
    directRouteErrorRoutes: [],
    directRouteSkipReasons: [],
    directRouteGapReasons: [],
    directRouteObservedStrategies: [],
    directRouteUndeclaredStrategies: [],
    memoryChangedSlots: [],
    memoryChangedProfileFields: [],
    memorySkippedPatchReasons: [],
    threadProfileWriteSources: [],
    threadProfileWriteReasons: [],
    threadProfileWriteChangedFields: [],
    signalCount: report.evaluation.signalCount,
    warningCount: report.evaluation.warningCount,
    signals: report.evaluation.signals,
  };
}

function isInterestingRow(row: AssistantWorkflowRunReportBatchRow): boolean {
  return row.status !== "completed" || row.warningCount > 0 || row.handled === false;
}

function isActionableDirectRouteSkipReason(value: string): boolean {
  return !value.endsWith(":runtime_policy_disabled") && !value.endsWith(":runtime_disabled");
}

function normalizeMinRunCount(value: number | null | undefined): number {
  if (value === null || value === undefined) return 3;
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.floor(value));
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized?.length ? normalized : null;
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

function mergeSignalCounts(
  currentCounts: readonly AssistantWorkflowRunReportBatchSignalCount[],
  signals: readonly AssistantWorkflowRunEvaluationSignal[],
): AssistantWorkflowRunReportBatchSignalCount[] {
  const expanded: AssistantWorkflowRunEvaluationSignal[] = [];
  for (const count of currentCounts) {
    for (let index = 0; index < count.count; index += 1) {
      expanded.push({
        name: count.name,
        severity: count.severity,
        detail: null,
      });
    }
  }
  return buildSignalCounts([...expanded, ...signals]);
}
