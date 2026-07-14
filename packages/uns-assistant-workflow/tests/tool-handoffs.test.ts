import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowRun,
  defineAssistantWorkflow,
  selectAssistantWorkflowApprovedToolInvocation,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool handoffs", () => {
  it("selects one allowlisted invocation from a rebuilt plan with normalized arguments", () => {
    const selected = selectAssistantWorkflowApprovedToolInvocation({
      invocations: readyInvocations(),
      handoffs: [{
        invocationId: "fetch_document:read_document",
        toolName: "read_document",
        args: { documentId: " manual-1 " },
      }],
      policies: [{
        toolName: "read_document",
        normalizeArgs: (args) => {
          if (Object.keys(args).length !== 1 || typeof args["documentId"] !== "string") return null;
          const documentId = args["documentId"].trim();
          return documentId ? { documentId } : null;
        },
      }],
      allowedToolNames: ["read_document"],
    });

    expect(selected).toMatchObject({
      policy: { toolName: "read_document" },
      invocation: { id: "fetch_document:read_document", toolName: "read_document" },
      args: { documentId: "manual-1" },
    });
  });

  it("rejects an unallowlisted, malformed, or mismatched handoff", () => {
    const policies = [{
      toolName: "read_document",
      normalizeArgs: (args: Readonly<Record<string, unknown>>) =>
        typeof args["documentId"] === "string" && Object.keys(args).length === 1
          ? { documentId: args["documentId"] }
          : null,
    }];
    const handoff = {
      invocationId: "fetch_document:read_document",
      toolName: "read_document",
      args: { documentId: "manual-1" },
    };

    expect(selectAssistantWorkflowApprovedToolInvocation({
      invocations: readyInvocations(),
      handoffs: [handoff],
      policies,
      allowedToolNames: [],
    })).toBeNull();
    expect(selectAssistantWorkflowApprovedToolInvocation({
      invocations: readyInvocations(),
      handoffs: [{ ...handoff, args: { documentId: "manual-1", limit: 20 } }],
      policies,
      allowedToolNames: ["read_document"],
    })).toBeNull();
    expect(selectAssistantWorkflowApprovedToolInvocation({
      invocations: readyInvocations(),
      handoffs: [{ ...handoff, invocationId: "other:read_document" }],
      policies,
      allowedToolNames: ["read_document"],
    })).toBeNull();
  });

  it("rejects multiple handoff records or more than one matching policy", () => {
    const handoff = {
      invocationId: "fetch_document:read_document",
      toolName: "read_document",
      args: { documentId: "manual-1" },
    };
    const policy = {
      toolName: "read_document",
      normalizeArgs: (args: Readonly<Record<string, unknown>>) => args,
    };

    expect(selectAssistantWorkflowApprovedToolInvocation({
      invocations: readyInvocations(),
      handoffs: [handoff, { ...handoff, invocationId: "list_documents:list_documents", toolName: "list_documents", args: {} }],
      policies: [policy],
      allowedToolNames: ["read_document"],
    })).toBeNull();
    expect(selectAssistantWorkflowApprovedToolInvocation({
      invocations: readyInvocations(),
      handoffs: [handoff],
      policies: [policy, { ...policy }],
      allowedToolNames: ["read_document"],
    })).toBeNull();
  });
});

function readyInvocations() {
  const run = buildAssistantWorkflowRun(defineAssistantWorkflow(workflow()), {
    classification: { intent: "document_lookup", confidence: 1 },
    availableToolNames: ["read_document", "list_documents"],
    availableContext: ["auth"],
  });
  return run.toolInvocationQueue.invocations;
}

function workflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-handoff-fixture",
    version: 1,
    intents: [{
      id: "document_lookup",
      description: "Read a document.",
      planningSteps: ["fetch_document", "list_documents"],
    }],
    tools: [{
      name: "read_document",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "safe",
      outputKinds: ["evidence"],
      requiredContext: ["auth"],
    }, {
      name: "list_documents",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
      requiredContext: ["auth"],
    }],
    toolBindings: [{
      name: "read_document",
      provider: "local-function",
      handlerId: "read_document",
    }, {
      name: "list_documents",
      provider: "local-function",
      handlerId: "list_documents",
    }],
    planningSteps: [{
      id: "fetch_document",
      description: "Read one document.",
      kind: "retrieve",
      requiredToolHints: ["read_document"],
    }, {
      id: "list_documents",
      description: "List documents.",
      kind: "retrieve",
      requiredToolHints: ["list_documents"],
    }],
  };
}
