import {
  buildAssistantWorkflowSerializedDefinitionPackageExecutionBatch,
  parseAssistantWorkflowSerializedDefinitionPackageExecutionLines,
  type AssistantWorkflowSerializedDefinitionPackageExecutionBatch,
  type AssistantWorkflowSerializedDefinitionPackageExecutionBatchOptions,
  type AssistantWorkflowSerializedDefinitionPackageExecutionLinesParseResult,
} from "./definition-package-execution-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionPackageExecutionReplayLinesOptions =
  AssistantWorkflowSerializedDefinitionPackageExecutionBatchOptions;

export type AssistantWorkflowDefinitionPackageExecutionReplayLinesInput = {
  executionLines: string;
};

export type AssistantWorkflowDefinitionPackageExecutionReplayLinesResult = {
  executionParse: AssistantWorkflowSerializedDefinitionPackageExecutionLinesParseResult;
  parseErrorCount: number;
  batch: AssistantWorkflowSerializedDefinitionPackageExecutionBatch;
};

export function runAssistantWorkflowDefinitionPackageExecutionReplayLines(
  input: AssistantWorkflowDefinitionPackageExecutionReplayLinesInput,
  options: AssistantWorkflowDefinitionPackageExecutionReplayLinesOptions = {},
): AssistantWorkflowDefinitionPackageExecutionReplayLinesResult {
  const executionParse = parseAssistantWorkflowSerializedDefinitionPackageExecutionLines(input.executionLines);
  const batch = buildAssistantWorkflowSerializedDefinitionPackageExecutionBatch(
    executionParse.executions,
    options,
  );

  return {
    executionParse,
    parseErrorCount: executionParse.errorCount,
    batch,
  };
}

export function buildAssistantWorkflowDefinitionPackageExecutionReplayLinesTracePayload(
  result: AssistantWorkflowDefinitionPackageExecutionReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    executionParse: {
      lineCount: result.executionParse.lineCount,
      executionCount: result.executionParse.executionCount,
      errorCount: result.executionParse.errorCount,
      errors: result.executionParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    parseErrorCount: result.parseErrorCount,
    batch: {
      generatedAt: result.batch.generatedAt,
      sourceExecutionCount: result.batch.sourceExecutionCount,
      executionCount: result.batch.executionCount,
      summary: {
        generatedAt: result.batch.summary.generatedAt,
        sourceExecutionCount: result.batch.summary.sourceExecutionCount,
        executionCount: result.batch.summary.executionCount,
        interestingExecutionCount: result.batch.summary.interestingExecutionCount,
        executedCount: result.batch.summary.executedCount,
        failedExecutionCount: result.batch.summary.failedExecutionCount,
        statusCounts: result.batch.summary.statusCounts.map((count) => ({
          key: count.key,
          count: count.count,
        })),
        reportStatusCounts: result.batch.summary.reportStatusCounts.map((count) => ({
          key: count.key,
          count: count.count,
        })),
      },
    },
  };
}
