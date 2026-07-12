import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageResolveTracePayload,
  resolveAssistantWorkflowDefinitionFromPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package resolver", () => {
  it("loads and selects the latest definition in one call", () => {
    const result = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(result).toMatchObject({
      resolved: true,
      status: "resolved",
      reason: null,
      definition: {
        workflowId: "support-agent",
        workflowVersion: 2,
      },
      load: {
        loaded: true,
      },
      selection: {
        selected: true,
      },
    });
  });

  it("loads and selects an explicit workflow version", () => {
    const result = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      workflow("ops-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "multi-suite",
    }), {
      workflowId: "support-agent",
      version: 1,
    });

    expect(result).toMatchObject({
      resolved: true,
      status: "resolved",
      definition: {
        workflowId: "support-agent",
        workflowVersion: 1,
      },
    });
  });

  it("returns load_failed for invalid package JSON", () => {
    expect(resolveAssistantWorkflowDefinitionFromPackage({ format: "other" })).toMatchObject({
      resolved: false,
      status: "load_failed",
      definition: null,
      selection: null,
      reason: "Package JSON is not a valid assistant workflow definition package.",
      load: {
        status: "invalid_package",
      },
    });
  });

  it("returns load_failed when package is blocked by default", () => {
    const result = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      invalidWorkflow("broken-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "broken-suite",
    }));

    expect(result).toMatchObject({
      resolved: false,
      status: "load_failed",
      definition: null,
      selection: null,
      reason: "1 workflow definition(s) are invalid.",
      load: {
        status: "blocked",
      },
    });
  });

  it("can resolve invalid definitions for authoring tools when explicitly allowed", () => {
    const result = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      invalidWorkflow("broken-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "broken-suite",
    }), {
      allowBlocked: true,
      includeInvalid: true,
    });

    expect(result).toMatchObject({
      resolved: true,
      status: "resolved",
      definition: {
        workflowId: "broken-agent",
        workflowVersion: 1,
        summary: {
          valid: false,
        },
      },
      load: {
        loaded: true,
        review: {
          status: "blocked",
        },
      },
    });
  });

  it("returns selection_failed for ambiguous or missing definitions", () => {
    const multi = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("ops-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "multi-suite",
    }));
    const missing = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }), {
      workflowId: "missing-agent",
    });

    expect(multi).toMatchObject({
      resolved: false,
      status: "selection_failed",
      reason: "Package contains multiple workflow ids; workflowId is required.",
      selection: {
        status: "ambiguous_workflow",
      },
    });
    expect(missing).toMatchObject({
      resolved: false,
      status: "selection_failed",
      reason: "No valid workflow definition found for missing-agent.",
      selection: {
        status: "not_found",
      },
    });
  });

  it("builds compact resolve trace payloads", () => {
    const resolved = resolveAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));
    const failed = resolveAssistantWorkflowDefinitionFromPackage({ format: "other" });

    expect(buildAssistantWorkflowDefinitionPackageResolveTracePayload(resolved)).toMatchObject({
      resolved: true,
      status: "resolved",
      reason: null,
      definition: {
        workflowId: "support-agent",
        workflowVersion: 1,
      },
      load: {
        status: "loaded",
      },
      selection: {
        status: "selected",
      },
    });
    expect(buildAssistantWorkflowDefinitionPackageResolveTracePayload(failed)).toMatchObject({
      resolved: false,
      status: "load_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      definition: null,
      load: {
        status: "invalid_package",
      },
      selection: null,
    });
  });
});

function workflow(id: string, version: number): AssistantWorkflowDefinition {
  return {
    id,
    version,
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      planningSteps: ["retrieve_docs"],
    }],
    presentations: [{
      id: "text",
      description: "Text response.",
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
    }],
  };
}

function invalidWorkflow(id: string, version: number): AssistantWorkflowDefinition {
  return {
    ...workflow(id, version),
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "missing",
    }],
  };
}
