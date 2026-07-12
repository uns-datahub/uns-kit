import type {
  AssistantWorkflowHttpMethod,
} from "./definition.js";
import type {
  AssistantWorkflowToolExecutorContext,
  AssistantWorkflowToolInvocationArgs,
  AssistantWorkflowToolInvocationForProvider,
  AssistantWorkflowToolProviderExecutor,
} from "./tool-executor.js";

export type AssistantWorkflowLocalFunctionToolExecutionRequest = {
  invocation: AssistantWorkflowToolInvocationForProvider<"local-function">;
  handlerId: string;
  args: AssistantWorkflowToolInvocationArgs;
};

export type AssistantWorkflowHttpToolExecutionRequest = {
  invocation: AssistantWorkflowToolInvocationForProvider<"http">;
  method: AssistantWorkflowHttpMethod;
  path: string;
  baseUrlRef: string | null;
  operationId: string | null;
  args: AssistantWorkflowToolInvocationArgs;
};

export type AssistantWorkflowMcpToolExecutionRequest = {
  invocation: AssistantWorkflowToolInvocationForProvider<"mcp">;
  serverId: string;
  toolName: string;
  args: AssistantWorkflowToolInvocationArgs;
};

export type AssistantWorkflowHostedToolExecutionRequest = {
  invocation: AssistantWorkflowToolInvocationForProvider<"openai-hosted">;
  hostedToolType: string;
  toolName: string | null;
  args: AssistantWorkflowToolInvocationArgs;
};

export type AssistantWorkflowReplToolExecutionRequest = {
  invocation: AssistantWorkflowToolInvocationForProvider<"repl">;
  runtimeId: string;
  functionName: string | null;
  commandTemplate: string | null;
  allowFilesystem: boolean;
  allowNetwork: boolean;
  args: AssistantWorkflowToolInvocationArgs;
};

export function createAssistantWorkflowLocalFunctionToolProviderExecutor(
  execute: (request: AssistantWorkflowLocalFunctionToolExecutionRequest) => unknown | Promise<unknown>,
): AssistantWorkflowToolProviderExecutor<"local-function"> {
  return async (invocation, context) =>
    await execute({
      invocation,
      handlerId: invocation.binding.handlerId,
      args: context.args,
    });
}

export function createAssistantWorkflowHttpToolProviderExecutor(
  execute: (request: AssistantWorkflowHttpToolExecutionRequest) => unknown | Promise<unknown>,
): AssistantWorkflowToolProviderExecutor<"http"> {
  return async (invocation, context) =>
    await execute({
      invocation,
      method: invocation.binding.method ?? "GET",
      path: invocation.binding.path,
      baseUrlRef: normalizeNullableString(invocation.binding.baseUrlRef),
      operationId: normalizeNullableString(invocation.binding.operationId),
      args: context.args,
    });
}

export function createAssistantWorkflowMcpToolProviderExecutor(
  execute: (request: AssistantWorkflowMcpToolExecutionRequest) => unknown | Promise<unknown>,
): AssistantWorkflowToolProviderExecutor<"mcp"> {
  return async (invocation, context) =>
    await execute({
      invocation,
      serverId: invocation.binding.serverId,
      toolName: invocation.binding.toolName,
      args: context.args,
    });
}

export function createAssistantWorkflowHostedToolProviderExecutor(
  execute: (request: AssistantWorkflowHostedToolExecutionRequest) => unknown | Promise<unknown>,
): AssistantWorkflowToolProviderExecutor<"openai-hosted"> {
  return async (invocation, context) =>
    await execute({
      invocation,
      hostedToolType: invocation.binding.hostedToolType,
      toolName: normalizeNullableString(invocation.binding.toolName),
      args: context.args,
    });
}

export function createAssistantWorkflowReplToolProviderExecutor(
  execute: (request: AssistantWorkflowReplToolExecutionRequest) => unknown | Promise<unknown>,
): AssistantWorkflowToolProviderExecutor<"repl"> {
  return async (invocation, context) =>
    await execute({
      invocation,
      runtimeId: invocation.binding.runtimeId,
      functionName: normalizeNullableString(invocation.binding.functionName),
      commandTemplate: normalizeNullableString(invocation.binding.commandTemplate),
      allowFilesystem: invocation.binding.allowFilesystem === true,
      allowNetwork: invocation.binding.allowNetwork === true,
      args: context.args,
    });
}

export function buildAssistantWorkflowToolProviderExecutionTracePayload(
  invocation: AssistantWorkflowToolInvocationForProvider,
  context: AssistantWorkflowToolExecutorContext,
): Record<string, unknown> {
  return {
    invocationId: invocation.id,
    toolName: invocation.toolName,
    provider: invocation.provider,
    stepId: invocation.stepId,
    invocationIndex: context.invocationIndex,
    queueStatus: context.queueStatus,
    argumentCount: Object.keys(context.args).length,
  };
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}
