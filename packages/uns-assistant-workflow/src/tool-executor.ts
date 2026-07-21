import type {
  AssistantWorkflowToolBindingDefinition,
  AssistantWorkflowToolCapabilityDefinition,
  AssistantWorkflowToolProvider,
} from "./definition.js";
import type {
  AssistantWorkflowToolInvocation,
  AssistantWorkflowToolInvocationQueue,
} from "./tool-invocations.js";
import {
  buildAssistantWorkflowExecutionBudgetAssessment,
  buildAssistantWorkflowExecutionBudgetTracePayload,
  formatAssistantWorkflowExecutionBudgetViolation,
  type AssistantWorkflowExecutionBudget,
  type AssistantWorkflowExecutionBudgetAssessment,
} from "./execution-budget.js";
import { resolveAssistantWorkflowExecutionPolicy } from "./execution-policy.js";

export type {
  AssistantWorkflowToolInvocation,
  AssistantWorkflowToolInvocationQueue,
} from "./tool-invocations.js";
import {
  assistantWorkflowToolError,
  assistantWorkflowToolSkipped,
  assistantWorkflowToolSuccess,
  buildAssistantWorkflowToolResultsTracePayload,
  summarizeAssistantWorkflowToolResults,
  type AssistantWorkflowToolResult,
  type AssistantWorkflowToolResultSummary,
} from "./tool-results.js";

export type AssistantWorkflowToolExecutorContext = {
  invocationIndex: number;
  queueStatus: AssistantWorkflowToolInvocationQueue["status"];
  args: AssistantWorkflowToolInvocationArgs;
  attempt?: number;
  maxAttempts?: number;
};

export type AssistantWorkflowToolInvocationArgs = Readonly<Record<string, unknown>>;

export type AssistantWorkflowToolInvocationArgsById = Readonly<
  Record<string, AssistantWorkflowToolInvocationArgs>
>;

export type AssistantWorkflowToolExecutor = (
  invocation: AssistantWorkflowToolInvocation,
  context: AssistantWorkflowToolExecutorContext,
) => unknown | Promise<unknown>;

export type AssistantWorkflowToolInvocationForProvider<
  TProvider extends AssistantWorkflowToolProvider = AssistantWorkflowToolProvider,
> = Omit<AssistantWorkflowToolInvocation, "provider" | "capability" | "binding"> & {
  provider: TProvider;
  capability: AssistantWorkflowToolCapabilityDefinition & { provider: TProvider };
  binding: Extract<AssistantWorkflowToolBindingDefinition, { provider: TProvider }>;
};

export type AssistantWorkflowToolProviderExecutor<
  TProvider extends AssistantWorkflowToolProvider = AssistantWorkflowToolProvider,
> = (
  invocation: AssistantWorkflowToolInvocationForProvider<TProvider>,
  context: AssistantWorkflowToolExecutorContext,
) => unknown | Promise<unknown>;

export type AssistantWorkflowToolProviderExecutors = {
  [TProvider in AssistantWorkflowToolProvider]?: AssistantWorkflowToolProviderExecutor<TProvider>;
};

export type AssistantWorkflowToolProviderExecutorOptions = {
  fallback?: AssistantWorkflowToolExecutor;
};

export type AssistantWorkflowToolExecutionEventPhase =
  | "started"
  | "succeeded"
  | "failed"
  | "skipped";

export type AssistantWorkflowToolExecutionEvent = {
  phase: AssistantWorkflowToolExecutionEventPhase;
  invocationId: string;
  toolName: string;
  stepId: string;
  provider: AssistantWorkflowToolProvider;
  invocationIndex: number;
  queueStatus: AssistantWorkflowToolInvocationQueue["status"];
  durationMs: number | null;
  errorMessage: string | null;
  retryable: boolean | null;
  attempt?: number;
  maxAttempts?: number;
};

export type AssistantWorkflowToolExecutionOptions = {
  continueOnError?: boolean;
  retryableOnError?: boolean;
  now?: () => number;
  argsByInvocationId?: AssistantWorkflowToolInvocationArgsById;
  onEvent?: (event: AssistantWorkflowToolExecutionEvent) => void;
  executionBudget?: AssistantWorkflowExecutionBudget;
};

export type AssistantWorkflowToolExecutionReport = {
  queue: AssistantWorkflowToolInvocationQueue;
  results: AssistantWorkflowToolResult[];
  summary: AssistantWorkflowToolResultSummary;
  budgetAssessment?: AssistantWorkflowExecutionBudgetAssessment | null;
};

/**
 * Adapts provider-specific integrations to the generic invocation executor.
 * Applications can add local, HTTP, hosted, MCP, or REPL executors without
 * making queue execution depend on their transport SDKs.
 */
export function createAssistantWorkflowToolProviderExecutor(
  executors: AssistantWorkflowToolProviderExecutors,
  options: AssistantWorkflowToolProviderExecutorOptions = {},
): AssistantWorkflowToolExecutor {
  return async (invocation, context) => {
    const providerExecutor = executors[invocation.provider] as
      | AssistantWorkflowToolProviderExecutor
      | undefined;
    if (providerExecutor) {
      assertInvocationProviderConsistency(invocation);
      return await providerExecutor(
        invocation as AssistantWorkflowToolInvocationForProvider,
        context,
      );
    }
    if (options.fallback) {
      return await options.fallback(invocation, context);
    }
    throw new Error(`No executor configured for assistant workflow tool provider: ${invocation.provider}.`);
  };
}

export async function executeAssistantWorkflowToolInvocationQueue(
  queue: AssistantWorkflowToolInvocationQueue,
  executor: AssistantWorkflowToolExecutor,
  options: AssistantWorkflowToolExecutionOptions = {},
): Promise<AssistantWorkflowToolExecutionReport> {
  const results: AssistantWorkflowToolResult[] = [];
  const now = options.now ?? (() => Date.now());
  const executionPolicy = queue.executionPolicy ?? resolveAssistantWorkflowExecutionPolicy();
  const continueIndependent = options.continueOnError !== undefined
    ? options.continueOnError
    : executionPolicy.failureMode === "continue-independent";
  const executionBudget = options.executionBudget ?? queue.executionBudget ?? null;
  const preflightBudgetAssessment = executionBudget
    ? buildAssistantWorkflowExecutionBudgetAssessment(executionBudget, {
        toolCallCount: queue.invocations.reduce(
          (count, invocation) => count + normalizeMaxAttempts(invocation.maxAttempts),
          0,
        ),
      })
    : null;
  if (preflightBudgetAssessment?.status === "blocked") {
    appendBudgetBlockedResults(
      results,
      queue.invocations,
      preflightBudgetAssessment,
      0,
      queue.status,
      options.onEvent,
    );
    return buildExecutionReport(queue, results, preflightBudgetAssessment);
  }

  const executionStartedAt = executionBudget ? now() : null;
  let startedToolCallCount = 0;
  let elapsedMs = 0;
  const failedStepIds = new Set<string>();

  for (const [invocationIndex, invocation] of queue.invocations.entries()) {
    const failedDependencyId = (invocation.dependsOnStepIds ?? []).find((stepId) => failedStepIds.has(stepId));
    if (failedDependencyId) {
      const errorMessage = `dependency step failed: ${failedDependencyId}`;
      appendSkippedInvocation(results, invocation, errorMessage, invocationIndex, queue.status, options.onEvent);
      failedStepIds.add(invocation.stepId);
      continue;
    }

    const maxAttempts = normalizeMaxAttempts(invocation.maxAttempts);
    const invocationStartedAt = now();
    let invocationFailed = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAt = attempt === 1 ? invocationStartedAt : now();
      if (executionBudget && executionStartedAt !== null) {
        elapsedMs = Math.max(0, attemptStartedAt - executionStartedAt);
        const assessment = buildAssistantWorkflowExecutionBudgetAssessment(executionBudget, {
          toolCallCount: startedToolCallCount,
          elapsedMs,
        });
        if (assessment.status === "blocked") {
          appendBudgetBlockedResults(
            results,
            queue.invocations.slice(invocationIndex),
            assessment,
            invocationIndex,
            queue.status,
            options.onEvent,
          );
          return buildExecutionReport(queue, results, assessment);
        }
      }
      startedToolCallCount += 1;
      emitToolExecutionEvent(options.onEvent, createToolExecutionEvent({
        phase: "started",
        invocation,
        invocationIndex,
        queueStatus: queue.status,
        attempt,
        maxAttempts,
      }));
      try {
        const output = await executor(invocation, {
          invocationIndex,
          queueStatus: queue.status,
          args: readInvocationArgs(options.argsByInvocationId, invocation.id),
          attempt,
          maxAttempts,
        });
        const completedAt = now();
        const durationMs = completedAt - invocationStartedAt;
        if (executionStartedAt !== null) elapsedMs = Math.max(0, completedAt - executionStartedAt);
        results.push(assistantWorkflowToolSuccess({
          invocationId: invocation.id,
          toolName: invocation.toolName,
          stepId: invocation.stepId,
          provider: invocation.provider,
          output,
          durationMs,
        }));
        emitToolExecutionEvent(options.onEvent, createToolExecutionEvent({
          phase: "succeeded",
          invocation,
          invocationIndex,
          queueStatus: queue.status,
          durationMs: completedAt - attemptStartedAt,
          attempt,
          maxAttempts,
        }));
        break;
      } catch (error) {
        const completedAt = now();
        const errorMessage = getErrorMessage(error);
        const retryable = attempt < maxAttempts || options.retryableOnError === true;
        if (executionStartedAt !== null) elapsedMs = Math.max(0, completedAt - executionStartedAt);
        emitToolExecutionEvent(options.onEvent, createToolExecutionEvent({
          phase: "failed",
          invocation,
          invocationIndex,
          queueStatus: queue.status,
          durationMs: completedAt - attemptStartedAt,
          errorMessage,
          retryable,
          attempt,
          maxAttempts,
        }));
        if (attempt < maxAttempts) continue;
        results.push(assistantWorkflowToolError({
          invocationId: invocation.id,
          toolName: invocation.toolName,
          stepId: invocation.stepId,
          provider: invocation.provider,
          errorMessage,
          retryable: options.retryableOnError === true,
          durationMs: completedAt - invocationStartedAt,
        }));
        invocationFailed = true;
        failedStepIds.add(invocation.stepId);
      }
    }
    if (invocationFailed && !continueIndependent) {
      appendSkippedAfterFailure(
        results,
        queue.invocations.slice(invocationIndex + 1),
        invocation.id,
        invocationIndex + 1,
        queue.status,
        options.onEvent,
      );
      break;
    }
  }

  const budgetAssessment = executionBudget
    ? buildAssistantWorkflowExecutionBudgetAssessment(executionBudget, {
        toolCallCount: startedToolCallCount,
        elapsedMs,
      })
    : null;
  return buildExecutionReport(queue, results, budgetAssessment);
}

export function buildAssistantWorkflowToolExecutionTracePayload(
  report: AssistantWorkflowToolExecutionReport,
): Record<string, unknown> {
  return {
    ...buildAssistantWorkflowToolResultsTracePayload(report.queue, report.results),
    budgetAssessment: report.budgetAssessment
      ? buildAssistantWorkflowExecutionBudgetTracePayload(report.budgetAssessment)
      : null,
  };
}

export function buildAssistantWorkflowToolExecutionEventTracePayload(
  event: AssistantWorkflowToolExecutionEvent,
): Record<string, unknown> {
  return {
    phase: event.phase,
    invocationId: event.invocationId,
    toolName: event.toolName,
    stepId: event.stepId,
    provider: event.provider,
    invocationIndex: event.invocationIndex,
    queueStatus: event.queueStatus,
    durationMs: event.durationMs,
    errorMessage: event.errorMessage,
    retryable: event.retryable,
    ...(event.attempt !== undefined ? { attempt: event.attempt } : {}),
    ...(event.maxAttempts !== undefined ? { maxAttempts: event.maxAttempts } : {}),
  };
}

function appendSkippedAfterFailure(
  results: AssistantWorkflowToolResult[],
  invocations: readonly AssistantWorkflowToolInvocation[],
  failedInvocationId: string,
  invocationIndex: number,
  queueStatus: AssistantWorkflowToolInvocationQueue["status"],
  onEvent: AssistantWorkflowToolExecutionOptions["onEvent"],
): void {
  for (const [offset, invocation] of invocations.entries()) {
    const errorMessage = `previous invocation failed: ${failedInvocationId}`;
    results.push(
      assistantWorkflowToolSkipped({
        invocationId: invocation.id,
        toolName: invocation.toolName,
        stepId: invocation.stepId,
        provider: invocation.provider,
        errorMessage,
      }),
    );
    emitToolExecutionEvent(onEvent, createToolExecutionEvent({
      phase: "skipped",
      invocation,
      invocationIndex: invocationIndex + offset,
      queueStatus,
      errorMessage,
    }));
  }
}

function appendBudgetBlockedResults(
  results: AssistantWorkflowToolResult[],
  invocations: readonly AssistantWorkflowToolInvocation[],
  assessment: AssistantWorkflowExecutionBudgetAssessment,
  invocationIndex: number,
  queueStatus: AssistantWorkflowToolInvocationQueue["status"],
  onEvent: AssistantWorkflowToolExecutionOptions["onEvent"],
): void {
  const [blockedInvocation, ...remainingInvocations] = invocations;
  if (!blockedInvocation) return;
  const errorMessage = formatAssistantWorkflowExecutionBudgetViolation(assessment.violations[0]!);
  results.push(assistantWorkflowToolError({
    invocationId: blockedInvocation.id,
    toolName: blockedInvocation.toolName,
    stepId: blockedInvocation.stepId,
    provider: blockedInvocation.provider,
    errorMessage,
    retryable: false,
    durationMs: 0,
  }));
  emitToolExecutionEvent(onEvent, createToolExecutionEvent({
    phase: "failed",
    invocation: blockedInvocation,
    invocationIndex,
    queueStatus,
    durationMs: 0,
    errorMessage,
    retryable: false,
  }));
  appendSkippedAfterFailure(
    results,
    remainingInvocations,
    blockedInvocation.id,
    invocationIndex + 1,
    queueStatus,
    onEvent,
  );
}

function buildExecutionReport(
  queue: AssistantWorkflowToolInvocationQueue,
  results: AssistantWorkflowToolResult[],
  budgetAssessment: AssistantWorkflowExecutionBudgetAssessment | null,
): AssistantWorkflowToolExecutionReport {
  return {
    queue,
    results,
    summary: summarizeAssistantWorkflowToolResults(queue, results),
    budgetAssessment,
  };
}

function createToolExecutionEvent(input: {
  phase: AssistantWorkflowToolExecutionEventPhase;
  invocation: AssistantWorkflowToolInvocation;
  invocationIndex: number;
  queueStatus: AssistantWorkflowToolInvocationQueue["status"];
  durationMs?: number;
  errorMessage?: string;
  retryable?: boolean;
  attempt?: number;
  maxAttempts?: number;
}): AssistantWorkflowToolExecutionEvent {
  return {
    phase: input.phase,
    invocationId: input.invocation.id,
    toolName: input.invocation.toolName,
    stepId: input.invocation.stepId,
    provider: input.invocation.provider,
    invocationIndex: input.invocationIndex,
    queueStatus: input.queueStatus,
    durationMs: input.durationMs ?? null,
    errorMessage: input.errorMessage ?? null,
    retryable: input.retryable ?? null,
    ...(input.maxAttempts !== undefined && input.maxAttempts > 1
      ? { attempt: input.attempt ?? 1, maxAttempts: input.maxAttempts }
      : {}),
  };
}

function appendSkippedInvocation(
  results: AssistantWorkflowToolResult[],
  invocation: AssistantWorkflowToolInvocation,
  errorMessage: string,
  invocationIndex: number,
  queueStatus: AssistantWorkflowToolInvocationQueue["status"],
  onEvent: AssistantWorkflowToolExecutionOptions["onEvent"],
): void {
  results.push(assistantWorkflowToolSkipped({
    invocationId: invocation.id,
    toolName: invocation.toolName,
    stepId: invocation.stepId,
    provider: invocation.provider,
    errorMessage,
  }));
  emitToolExecutionEvent(onEvent, createToolExecutionEvent({
    phase: "skipped",
    invocation,
    invocationIndex,
    queueStatus,
    errorMessage,
  }));
}

function normalizeMaxAttempts(value: number | undefined): number {
  return value === 2 || value === 3 ? value : 1;
}

function emitToolExecutionEvent(
  observer: AssistantWorkflowToolExecutionOptions["onEvent"],
  event: AssistantWorkflowToolExecutionEvent,
): void {
  if (!observer) return;
  try {
    observer(Object.freeze(event));
  } catch {
    // Instrumentation must not alter the tool execution result.
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim().length) {
    return error.trim();
  }
  return "tool invocation failed";
}

function readInvocationArgs(
  argsByInvocationId: AssistantWorkflowToolInvocationArgsById | undefined,
  invocationId: string,
): AssistantWorkflowToolInvocationArgs {
  const rawArgs = argsByInvocationId?.[invocationId];
  if (!isRecord(rawArgs)) return EMPTY_TOOL_INVOCATION_ARGS;
  return Object.freeze({ ...rawArgs });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertInvocationProviderConsistency(invocation: AssistantWorkflowToolInvocation): void {
  if (invocation.provider !== invocation.binding.provider) {
    throw new Error(
      `Assistant workflow invocation provider ${invocation.provider} does not match binding provider ${invocation.binding.provider}.`,
    );
  }
  if (invocation.provider !== invocation.capability.provider) {
    throw new Error(
      `Assistant workflow invocation provider ${invocation.provider} does not match capability provider ${invocation.capability.provider}.`,
    );
  }
}

const EMPTY_TOOL_INVOCATION_ARGS: AssistantWorkflowToolInvocationArgs = Object.freeze({});
