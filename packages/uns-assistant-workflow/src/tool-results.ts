import type { AssistantWorkflowToolProvider } from "./definition.js";
import type { AssistantWorkflowToolInvocationQueue } from "./tool-invocations.js";

export type AssistantWorkflowToolResultStatus = "success" | "error" | "skipped";

export type AssistantWorkflowToolResult = {
  invocationId: string;
  toolName: string;
  stepId: string;
  provider: AssistantWorkflowToolProvider;
  status: AssistantWorkflowToolResultStatus;
  output?: unknown;
  errorMessage?: string;
  retryable?: boolean;
  durationMs?: number;
};

export type AssistantWorkflowToolResultSummaryStatus =
  | "complete"
  | "partial"
  | "failed"
  | "empty";

export type AssistantWorkflowToolResultSummary = {
  status: AssistantWorkflowToolResultSummaryStatus;
  totalInvocations: number;
  resultCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  retryableErrorCount: number;
  providerSummaries: AssistantWorkflowToolResultProviderSummary[];
  missingResultInvocationIds: string[];
  unexpectedResultInvocationIds: string[];
};

export type AssistantWorkflowToolResultProviderSummary = {
  provider: AssistantWorkflowToolProvider;
  resultCount: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
};

export function assistantWorkflowToolSuccess(
  input: Omit<AssistantWorkflowToolResult, "status" | "errorMessage" | "retryable">,
): AssistantWorkflowToolResult {
  return {
    invocationId: normalizeRequiredString(input.invocationId, "invocationId"),
    toolName: normalizeRequiredString(input.toolName, "toolName"),
    stepId: normalizeRequiredString(input.stepId, "stepId"),
    provider: normalizeToolProvider(input.provider),
    status: "success",
    ...(input.output !== undefined ? { output: input.output } : {}),
    ...(typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? { durationMs: Math.max(0, Math.floor(input.durationMs)) }
      : {}),
  };
}

export function assistantWorkflowToolError(
  input: Omit<AssistantWorkflowToolResult, "status" | "output">,
): AssistantWorkflowToolResult {
  return {
    invocationId: normalizeRequiredString(input.invocationId, "invocationId"),
    toolName: normalizeRequiredString(input.toolName, "toolName"),
    stepId: normalizeRequiredString(input.stepId, "stepId"),
    provider: normalizeToolProvider(input.provider),
    status: "error",
    errorMessage: normalizeRequiredString(input.errorMessage ?? "", "errorMessage"),
    ...(typeof input.retryable === "boolean" ? { retryable: input.retryable } : {}),
    ...(typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? { durationMs: Math.max(0, Math.floor(input.durationMs)) }
      : {}),
  };
}

export function assistantWorkflowToolSkipped(
  input: Omit<AssistantWorkflowToolResult, "status" | "output" | "retryable">,
): AssistantWorkflowToolResult {
  return {
    invocationId: normalizeRequiredString(input.invocationId, "invocationId"),
    toolName: normalizeRequiredString(input.toolName, "toolName"),
    stepId: normalizeRequiredString(input.stepId, "stepId"),
    provider: normalizeToolProvider(input.provider),
    status: "skipped",
    errorMessage: normalizeRequiredString(input.errorMessage ?? "", "errorMessage"),
    ...(typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
      ? { durationMs: Math.max(0, Math.floor(input.durationMs)) }
      : {}),
  };
}

export function summarizeAssistantWorkflowToolResults(
  queue: AssistantWorkflowToolInvocationQueue,
  results: readonly AssistantWorkflowToolResult[],
): AssistantWorkflowToolResultSummary {
  const invocationIds = queue.invocations.map((invocation) => invocation.id);
  const invocationIdSet = new Set(invocationIds);
  const resultIdSet = new Set(results.map((result) => result.invocationId));
  const missingResultInvocationIds = invocationIds.filter((id) => !resultIdSet.has(id));
  const unexpectedResultInvocationIds = results
    .map((result) => result.invocationId)
    .filter((id) => !invocationIdSet.has(id));
  const successCount = results.filter((result) => result.status === "success").length;
  const errorCount = results.filter((result) => result.status === "error").length;
  const skippedCount = results.filter((result) => result.status === "skipped").length;
  const retryableErrorCount = results
    .filter((result) => result.status === "error" && result.retryable === true)
    .length;

  return {
    status: resolveToolResultSummaryStatus({
      totalInvocations: queue.invocations.length,
      errorCount,
      missingResultInvocationIds,
      unexpectedResultInvocationIds,
    }),
    totalInvocations: queue.invocations.length,
    resultCount: results.length,
    successCount,
    errorCount,
    skippedCount,
    retryableErrorCount,
    providerSummaries: summarizeAssistantWorkflowToolResultProviders(results),
    missingResultInvocationIds,
    unexpectedResultInvocationIds,
  };
}

export function buildAssistantWorkflowToolResultsTracePayload(
  queue: AssistantWorkflowToolInvocationQueue,
  results: readonly AssistantWorkflowToolResult[],
): Record<string, unknown> {
  return {
    ...summarizeAssistantWorkflowToolResults(queue, results),
    results: results.map((result) => ({
      invocationId: result.invocationId,
      toolName: result.toolName,
      stepId: result.stepId,
      provider: result.provider,
      status: result.status,
      hasOutput: result.output !== undefined,
      errorMessage: result.errorMessage ?? null,
      retryable: result.retryable ?? null,
      durationMs: result.durationMs ?? null,
    })),
  };
}

export function summarizeAssistantWorkflowToolResultProviders(
  results: readonly AssistantWorkflowToolResult[],
): AssistantWorkflowToolResultProviderSummary[] {
  const summaries = new Map<AssistantWorkflowToolProvider, AssistantWorkflowToolResultProviderSummary>();
  for (const result of results) {
    const summary = summaries.get(result.provider) ?? {
      provider: result.provider,
      resultCount: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
    };
    summary.resultCount += 1;
    if (result.status === "success") summary.successCount += 1;
    if (result.status === "error") summary.errorCount += 1;
    if (result.status === "skipped") summary.skippedCount += 1;
    summaries.set(result.provider, summary);
  }
  return [...summaries.values()].sort((left, right) => left.provider.localeCompare(right.provider));
}

function resolveToolResultSummaryStatus(input: {
  totalInvocations: number;
  errorCount: number;
  missingResultInvocationIds: readonly string[];
  unexpectedResultInvocationIds: readonly string[];
}): AssistantWorkflowToolResultSummaryStatus {
  if (input.totalInvocations === 0) return "empty";
  if (input.errorCount > 0) return "failed";
  if (input.missingResultInvocationIds.length > 0 || input.unexpectedResultInvocationIds.length > 0) {
    return "partial";
  }
  return "complete";
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error(`Assistant workflow tool result ${fieldName} is required.`);
  }
  return trimmed;
}

function normalizeToolProvider(value: AssistantWorkflowToolProvider): AssistantWorkflowToolProvider {
  if (
    value === "local-function" ||
    value === "http" ||
    value === "mcp" ||
    value === "openai-hosted" ||
    value === "repl"
  ) {
    return value;
  }
  throw new Error("Assistant workflow tool result provider is invalid.");
}
