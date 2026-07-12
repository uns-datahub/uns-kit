import {
  buildAssistantWorkflowSerializedToolSelectionDecisionBatch,
  parseAssistantWorkflowSerializedToolSelectionDecisionLines,
  type AssistantWorkflowSerializedToolSelectionDecisionBatch,
  type AssistantWorkflowSerializedToolSelectionDecisionBatchCount,
  type AssistantWorkflowSerializedToolSelectionDecisionBatchOptions,
  type AssistantWorkflowSerializedToolSelectionDecisionLinesParseResult,
} from "./tool-selection-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";
import {
  buildAssistantWorkflowToolSelectionEvaluationBatch,
  buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload,
  buildAssistantWorkflowToolSelectionAuthorityAllowListProposal,
  buildAssistantWorkflowToolSelectionAuthorityAllowListProposalTracePayload,
  buildAssistantWorkflowToolSelectionMigrationReport,
  buildAssistantWorkflowToolSelectionMigrationReportTracePayload,
  buildAssistantWorkflowToolSelectionMigrationReviewArtifact,
  buildAssistantWorkflowToolSelectionMigrationReviewArtifactTracePayload,
  type AssistantWorkflowToolSelectionAuthorityAllowListProposal,
  type AssistantWorkflowToolSelectionEvaluationBatch,
  type AssistantWorkflowToolSelectionMigrationReport,
  type AssistantWorkflowToolSelectionMigrationReviewArtifact,
} from "./tool-selection-evaluation.js";

export type AssistantWorkflowToolSelectionReplayLinesOptions =
  AssistantWorkflowSerializedToolSelectionDecisionBatchOptions & {
    minMigrationDecisionCount?: number | null;
    currentAuthorityIntentIds?: readonly string[] | null;
    currentAuthoritySegmentKeys?: readonly string[] | null;
    migrationReviewPatchTargets?: readonly string[] | null;
    migrationReviewRequiredTestIds?: readonly string[] | null;
    migrationReviewTitle?: string | null;
  };

export type AssistantWorkflowToolSelectionReplayLinesInput = {
  decisionLines: string;
};

export type AssistantWorkflowToolSelectionReplayLinesResult = {
  decisionParse: AssistantWorkflowSerializedToolSelectionDecisionLinesParseResult;
  parseErrorCount: number;
  batch: AssistantWorkflowSerializedToolSelectionDecisionBatch;
  evaluation: AssistantWorkflowToolSelectionEvaluationBatch;
  migration: AssistantWorkflowToolSelectionMigrationReport;
  migrationProposal: AssistantWorkflowToolSelectionAuthorityAllowListProposal;
  migrationReviewArtifact: AssistantWorkflowToolSelectionMigrationReviewArtifact;
};

export function runAssistantWorkflowToolSelectionReplayLines(
  input: AssistantWorkflowToolSelectionReplayLinesInput,
  options: AssistantWorkflowToolSelectionReplayLinesOptions = {},
): AssistantWorkflowToolSelectionReplayLinesResult {
  const decisionParse = parseAssistantWorkflowSerializedToolSelectionDecisionLines(input.decisionLines);
  const batch = buildAssistantWorkflowSerializedToolSelectionDecisionBatch(
    decisionParse.decisions,
    options,
  );
  const evaluation = buildAssistantWorkflowToolSelectionEvaluationBatch(
    batch.decisions,
    options,
  );
  const migration = buildAssistantWorkflowToolSelectionMigrationReport(evaluation, {
    ...(options.minMigrationDecisionCount !== undefined
      ? { minDecisionCount: options.minMigrationDecisionCount }
      : {}),
  });
  const migrationProposal = buildAssistantWorkflowToolSelectionAuthorityAllowListProposal(migration, {
    ...(options.currentAuthorityIntentIds !== undefined
      ? { currentAuthorityIntentIds: options.currentAuthorityIntentIds }
      : {}),
    ...(options.currentAuthoritySegmentKeys !== undefined
      ? { currentAuthoritySegmentKeys: options.currentAuthoritySegmentKeys }
      : {}),
  });
  const migrationReviewArtifact = buildAssistantWorkflowToolSelectionMigrationReviewArtifact({
    report: migration,
    proposal: migrationProposal,
  }, {
    ...(options.migrationReviewTitle !== undefined ? { title: options.migrationReviewTitle } : {}),
    ...(options.migrationReviewPatchTargets !== undefined
      ? { patchTargets: options.migrationReviewPatchTargets }
      : {}),
    ...(options.migrationReviewRequiredTestIds !== undefined
      ? { requiredTestIds: options.migrationReviewRequiredTestIds }
      : {}),
  });

  return {
    decisionParse,
    parseErrorCount: decisionParse.errorCount,
    batch,
    evaluation,
    migration,
    migrationProposal,
    migrationReviewArtifact,
  };
}

export function buildAssistantWorkflowToolSelectionReplayLinesTracePayload(
  result: AssistantWorkflowToolSelectionReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    decisionParse: {
      lineCount: result.decisionParse.lineCount,
      decisionCount: result.decisionParse.decisionCount,
      errorCount: result.decisionParse.errorCount,
      errors: result.decisionParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    parseErrorCount: result.parseErrorCount,
    batch: {
      generatedAt: result.batch.generatedAt,
      sourceDecisionCount: result.batch.sourceDecisionCount,
      decisionCount: result.batch.decisionCount,
      summary: {
        generatedAt: result.batch.summary.generatedAt,
        sourceDecisionCount: result.batch.summary.sourceDecisionCount,
        decisionCount: result.batch.summary.decisionCount,
        interestingDecisionCount: result.batch.summary.interestingDecisionCount,
        workflowAuthorityCount: result.batch.summary.workflowAuthorityCount,
        legacyAuthorityCount: result.batch.summary.legacyAuthorityCount,
        authoritySourceCounts: serializeCounts(result.batch.summary.authoritySourceCounts),
        authorityReasonCounts: serializeCounts(result.batch.summary.authorityReasonCounts),
        workflowStatusCounts: serializeCounts(result.batch.summary.workflowStatusCounts),
        effectiveReasonCounts: serializeCounts(result.batch.summary.effectiveReasonCounts),
        optionalToolModeCounts: serializeCounts(result.batch.summary.optionalToolModeCounts),
        effectiveToolCounts: serializeCounts(result.batch.summary.effectiveToolCounts),
        workflowSuggestedToolCounts: serializeCounts(result.batch.summary.workflowSuggestedToolCounts),
        workflowSelectionCandidateToolCounts: serializeCounts(
          result.batch.summary.workflowSelectionCandidateToolCounts,
        ),
      },
    },
    evaluation: buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload(result.evaluation),
    migration: buildAssistantWorkflowToolSelectionMigrationReportTracePayload(result.migration),
    migrationProposal: buildAssistantWorkflowToolSelectionAuthorityAllowListProposalTracePayload(
      result.migrationProposal,
    ),
    migrationReviewArtifact: buildAssistantWorkflowToolSelectionMigrationReviewArtifactTracePayload(
      result.migrationReviewArtifact,
    ),
  };
}

function serializeCounts(
  counts: readonly AssistantWorkflowSerializedToolSelectionDecisionBatchCount[],
): Record<string, AssistantWorkflowJsonValue>[] {
  return counts.map((count) => ({
    key: count.key,
    count: count.count,
  }));
}
