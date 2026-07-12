import { describe, expect, it } from "vitest";

import {
  buildAssistantWorkflowToolRuntimeAudit,
  buildAssistantWorkflowToolRuntimeResolutionTracePayload,
  defineAssistantWorkflow,
  resolveAssistantWorkflowToolRuntime,
} from "../src/index.js";

describe("assistant workflow tool runtime", () => {
  it("audits live runtime registrations against bindings and recommended policy", () => {
    const audit = buildAssistantWorkflowToolRuntimeAudit(workflow(), [
      registration("query_docs", { adapterId: "mcp-runtime" }),
      registration("write_note", { explicitCallAllowed: true }),
      registration("orphan_tool"),
      registration("query_docs"),
    ]);

    expect(audit.readyToolNames).toEqual(["query_docs"]);
    expect(audit.policyDriftToolNames).toEqual(["write_note"]);
    expect(audit.missingRuntimeRegistrationNames).toEqual(["list_docs"]);
    expect(audit.runtimeToolWithoutCapabilityNames).toEqual(["orphan_tool"]);
    expect(audit.missingBindingNames).toEqual(["list_docs"]);
    expect(audit.duplicateRuntimeRegistrationNames).toEqual(["query_docs"]);
    expect(audit.resolutions.find((resolution) => resolution.toolName === "write_note")).toMatchObject({
      status: "policy-drift",
      policyMismatches: [{
        field: "explicitCallAllowed",
        expected: false,
        actual: true,
      }],
    });
  });

  it("reports one declared runtime binding as a compact trace payload", () => {
    const resolution = resolveAssistantWorkflowToolRuntime(workflow(), [
      registration("query_docs", { adapterId: "mcp-runtime" }),
    ], " query_docs ");

    expect(buildAssistantWorkflowToolRuntimeResolutionTracePayload(resolution)).toEqual({
      toolName: "query_docs",
      status: "ready",
      capabilityProvider: "mcp",
      bindingProvider: "mcp",
      runtimeAdapterId: "mcp-runtime",
      policyMismatches: [],
    });
  });

  it("respects runtime capability limits before calling an operator policy a drift", () => {
    const resolution = resolveAssistantWorkflowToolRuntime(workflow(), [{
      ...registration("query_docs"),
      explicitCallAllowed: false,
      supportsExplicitCall: false,
    }], "query_docs");

    expect(resolution).toMatchObject({
      status: "ready",
      policyMismatches: [],
    });
  });
});

function workflow() {
  return defineAssistantWorkflow({
    id: "runtime-audit-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer documentation questions.",
      toolHints: ["query_docs", "list_docs", "write_note"],
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
    }, {
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
    }, {
      name: "write_note",
      provider: "local-function",
      effect: "write",
      sideEffectRisk: "high",
      cacheability: "not-cacheable",
      retryClass: "never",
      outputKinds: ["artifact"],
      requiresConfirmation: true,
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }, {
      name: "write_note",
      provider: "local-function",
      handlerId: "notes.write",
    }],
  });
}

function registration(
  name: string,
  overrides: Partial<{
    enabled: boolean;
    assistantVisible: boolean;
    schemaAssistantVisible: boolean;
    explicitCallAllowed: boolean;
    adapterId: string;
  }> = {},
) {
  return {
    name,
    enabled: true,
    assistantVisible: true,
    schemaAssistantVisible: false,
    explicitCallAllowed: true,
    ...overrides,
  };
}
