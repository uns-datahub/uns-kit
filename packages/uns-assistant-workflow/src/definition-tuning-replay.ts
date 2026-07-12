import {
  buildAssistantWorkflowSerializedDefinitionTuningBatch,
  parseAssistantWorkflowSerializedDefinitionTuningSuggestionLines,
  type AssistantWorkflowSerializedDefinitionTuningBatch,
  type AssistantWorkflowSerializedDefinitionTuningBatchCount,
  type AssistantWorkflowSerializedDefinitionTuningBatchOptions,
  type AssistantWorkflowSerializedDefinitionTuningSuggestionLinesParseResult,
} from "./definition-tuning-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionTuningReplayLinesOptions =
  AssistantWorkflowSerializedDefinitionTuningBatchOptions;

export type AssistantWorkflowDefinitionTuningReplayLinesInput = {
  suggestionLines: string;
};

export type AssistantWorkflowDefinitionTuningReplayLinesResult = {
  suggestionParse: AssistantWorkflowSerializedDefinitionTuningSuggestionLinesParseResult;
  parseErrorCount: number;
  batch: AssistantWorkflowSerializedDefinitionTuningBatch;
};

export function runAssistantWorkflowDefinitionTuningReplayLines(
  input: AssistantWorkflowDefinitionTuningReplayLinesInput,
  options: AssistantWorkflowDefinitionTuningReplayLinesOptions = {},
): AssistantWorkflowDefinitionTuningReplayLinesResult {
  const suggestionParse = parseAssistantWorkflowSerializedDefinitionTuningSuggestionLines(input.suggestionLines);
  const batch = buildAssistantWorkflowSerializedDefinitionTuningBatch(
    suggestionParse.suggestions,
    options,
  );

  return {
    suggestionParse,
    parseErrorCount: suggestionParse.errorCount,
    batch,
  };
}

export function buildAssistantWorkflowDefinitionTuningReplayLinesTracePayload(
  result: AssistantWorkflowDefinitionTuningReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    suggestionParse: {
      lineCount: result.suggestionParse.lineCount,
      suggestionCount: result.suggestionParse.suggestionCount,
      errorCount: result.suggestionParse.errorCount,
      errors: result.suggestionParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    parseErrorCount: result.parseErrorCount,
    batch: {
      generatedAt: result.batch.generatedAt,
      sourceSuggestionCount: result.batch.sourceSuggestionCount,
      suggestionCount: result.batch.suggestionCount,
      summary: {
        generatedAt: result.batch.summary.generatedAt,
        sourceSuggestionCount: result.batch.summary.sourceSuggestionCount,
        suggestionCount: result.batch.summary.suggestionCount,
        applicableSuggestionCount: result.batch.summary.applicableSuggestionCount,
        reviewOnlySuggestionCount: result.batch.summary.reviewOnlySuggestionCount,
        warningCount: result.batch.summary.warningCount,
        actionCounts: serializeCounts(result.batch.summary.actionCounts),
        severityCounts: serializeCounts(result.batch.summary.severityCounts),
        patchKindCounts: serializeCounts(result.batch.summary.patchKindCounts),
        intentCounts: serializeCounts(result.batch.summary.intentCounts),
        toolCounts: serializeCounts(result.batch.summary.toolCounts),
      },
    },
  };
}

function serializeCounts(
  counts: readonly AssistantWorkflowSerializedDefinitionTuningBatchCount[],
): Record<string, AssistantWorkflowJsonValue>[] {
  return counts.map((count) => ({
    key: count.key,
    count: count.count,
  }));
}
