import { describe, expect, it } from "vitest";

import {
  buildAssistantWorkflowToolProviderExecutionTracePayload,
  createAssistantWorkflowHostedToolProviderExecutor,
  createAssistantWorkflowHttpToolProviderExecutor,
  createAssistantWorkflowLocalFunctionToolProviderExecutor,
  createAssistantWorkflowMcpToolProviderExecutor,
  createAssistantWorkflowReplToolProviderExecutor,
  type AssistantWorkflowToolInvocationForProvider,
} from "../src/index.js";

const context = {
  invocationIndex: 3,
  queueStatus: "ready" as const,
  args: Object.freeze({ query: "manual", limit: 5 }),
};

describe("assistant workflow tool provider executors", () => {
  it("maps every binding type into a transport-neutral execution request", async () => {
    const local = await createAssistantWorkflowLocalFunctionToolProviderExecutor(async (request) => ({
      handlerId: request.handlerId,
      args: request.args,
    }))(invocation("local-function"), context);
    const http = await createAssistantWorkflowHttpToolProviderExecutor(async (request) => ({
      method: request.method,
      path: request.path,
      baseUrlRef: request.baseUrlRef,
      operationId: request.operationId,
    }))(invocation("http"), context);
    const mcp = await createAssistantWorkflowMcpToolProviderExecutor(async (request) => ({
      serverId: request.serverId,
      toolName: request.toolName,
    }))(invocation("mcp"), context);
    const hosted = await createAssistantWorkflowHostedToolProviderExecutor(async (request) => ({
      hostedToolType: request.hostedToolType,
      toolName: request.toolName,
    }))(invocation("openai-hosted"), context);
    const repl = await createAssistantWorkflowReplToolProviderExecutor(async (request) => ({
      runtimeId: request.runtimeId,
      functionName: request.functionName,
      commandTemplate: request.commandTemplate,
      allowFilesystem: request.allowFilesystem,
      allowNetwork: request.allowNetwork,
    }))(invocation("repl"), context);

    expect(local).toEqual({ handlerId: "tools.lookup", args: { query: "manual", limit: 5 } });
    expect(http).toEqual({ method: "POST", path: "/lookup", baseUrlRef: "docs", operationId: "lookupDocs" });
    expect(mcp).toEqual({ serverId: "docs", toolName: "lookup" });
    expect(hosted).toEqual({ hostedToolType: "web_search_preview", toolName: "search" });
    expect(repl).toEqual({
      runtimeId: "python",
      functionName: "lookup_rows",
      commandTemplate: null,
      allowFilesystem: false,
      allowNetwork: true,
    });
  });

  it("builds a compact provider execution trace without arguments", () => {
    expect(buildAssistantWorkflowToolProviderExecutionTracePayload(invocation("mcp"), context)).toEqual({
      invocationId: "retrieve:lookup",
      toolName: "lookup",
      provider: "mcp",
      stepId: "retrieve",
      invocationIndex: 3,
      queueStatus: "ready",
      argumentCount: 2,
    });
  });
});

const invocations = {
  "local-function": {
    ...invocationBase("local-function"),
    binding: { name: "lookup", provider: "local-function", handlerId: "tools.lookup" },
  },
  http: {
    ...invocationBase("http"),
    binding: { name: "lookup", provider: "http", method: "POST", path: "/lookup", baseUrlRef: "docs", operationId: "lookupDocs" },
  },
  mcp: {
    ...invocationBase("mcp"),
    binding: { name: "lookup", provider: "mcp", serverId: "docs", toolName: "lookup" },
  },
  "openai-hosted": {
    ...invocationBase("openai-hosted"),
    binding: { name: "lookup", provider: "openai-hosted", hostedToolType: "web_search_preview", toolName: "search" },
  },
  repl: {
    ...invocationBase("repl"),
    binding: { name: "lookup", provider: "repl", runtimeId: "python", functionName: "lookup_rows", allowNetwork: true },
  },
} satisfies {
  [TProvider in "local-function" | "http" | "mcp" | "openai-hosted" | "repl"]: AssistantWorkflowToolInvocationForProvider<TProvider>;
};

function invocation(provider: "local-function"): AssistantWorkflowToolInvocationForProvider<"local-function">;
function invocation(provider: "http"): AssistantWorkflowToolInvocationForProvider<"http">;
function invocation(provider: "mcp"): AssistantWorkflowToolInvocationForProvider<"mcp">;
function invocation(provider: "openai-hosted"): AssistantWorkflowToolInvocationForProvider<"openai-hosted">;
function invocation(provider: "repl"): AssistantWorkflowToolInvocationForProvider<"repl">;
function invocation(provider: keyof typeof invocations): AssistantWorkflowToolInvocationForProvider {
  return invocations[provider];
}

function invocationBase<TProvider extends "local-function" | "http" | "mcp" | "openai-hosted" | "repl">(provider: TProvider) {
  return {
    id: "retrieve:lookup",
    stepId: "retrieve",
    stepKind: "retrieve" as const,
    toolName: "lookup",
    required: true,
    provider,
    capability: {
      name: "lookup",
      provider,
      effect: "read" as const,
      sideEffectRisk: "low" as const,
      cacheability: "request-scoped" as const,
      retryClass: "safe" as const,
      outputKinds: ["text"] as const,
    },
  };
}
