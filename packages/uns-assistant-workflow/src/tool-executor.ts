import type {
  AssistantWorkflowToolBindingDefinition,
  AssistantWorkflowToolCapabilityDefinition,
  AssistantWorkflowToolProvider,
} from "./definition.js";
import type {
  AssistantWorkflowToolInvocation,
  AssistantWorkflowToolInvocationQueue,
} from "./tool-invocations.js";

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
};

export type AssistantWorkflowToolExecutionOptions = {
  continueOnError?: boolean;
  retryableOnError?: boolean;
  now?: () => number;
  argsByInvocationId?: AssistantWorkflowToolInvocationArgsById;
  onEvent?: (event: AssistantWorkflowToolExecutionEvent) => void;
};

export type AssistantWorkflowToolExecutionReport = {
  queue: AssistantWorkflowToolInvocationQueue;
  results: AssistantWorkflowToolResult[];
  summary: AssistantWorkflowToolResultSummary;
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
  const continueOnError = options.continueOnError === true;
  const now = options.now ?? (() => Date.now());

  for (const [invocationIndex, invocation] of queue.invocations.entries()) {
    const startedAt = now();
    emitToolExecutionEvent(options.onEvent, createToolExecutionEvent({
      phase: "started",
      invocation,
      invocationIndex,
      queueStatus: queue.status,
    }));
    try {
      const output = await executor(invocation, {
        invocationIndex,
        queueStatus: queue.status,
        args: readInvocationArgs(options.argsByInvocationId, invocation.id),
      });
      const durationMs = now() - startedAt;
      results.push(
        assistantWorkflowToolSuccess({
          invocationId: invocation.id,
          toolName: invocation.toolName,
          stepId: invocation.stepId,
          provider: invocation.provider,
          output,
          durationMs,
        }),
      );
      emitToolExecutionEvent(options.onEvent, createToolExecutionEvent({
        phase: "succeeded",
        invocation,
        invocationIndex,
        queueStatus: queue.status,
        durationMs,
      }));
    } catch (error) {
      const durationMs = now() - startedAt;
      const errorMessage = getErrorMessage(error);
      const retryable = options.retryableOnError === true;
      results.push(
        assistantWorkflowToolError({
          invocationId: invocation.id,
          toolName: invocation.toolName,
          stepId: invocation.stepId,
          provider: invocation.provider,
          errorMessage,
          retryable,
          durationMs,
        }),
      );
      emitToolExecutionEvent(options.onEvent, createToolExecutionEvent({
        phase: "failed",
        invocation,
        invocationIndex,
        queueStatus: queue.status,
        durationMs,
        errorMessage,
        retryable,
      }));
      if (!continueOnError) {
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
  }

  return {
    queue,
    results,
    summary: summarizeAssistantWorkflowToolResults(queue, results),
  };
}

export function buildAssistantWorkflowToolExecutionTracePayload(
  report: AssistantWorkflowToolExecutionReport,
): Record<string, unknown> {
  return buildAssistantWorkflowToolResultsTracePayload(report.queue, report.results);
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

function createToolExecutionEvent(input: {
  phase: AssistantWorkflowToolExecutionEventPhase;
  invocation: AssistantWorkflowToolInvocation;
  invocationIndex: number;
  queueStatus: AssistantWorkflowToolInvocationQueue["status"];
  durationMs?: number;
  errorMessage?: string;
  retryable?: boolean;
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
  };
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
