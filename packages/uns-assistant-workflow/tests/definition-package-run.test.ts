import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackageRunTracePayload,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowRunFromPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package run", () => {
  it("resolves a package definition and builds a workflow run", () => {
    const result = buildAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
    ]), {
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
      },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });

    expect(result).toMatchObject({
      built: true,
      status: "run_built",
      reason: null,
      resolve: {
        resolved: true,
        definition: {
          workflowVersion: 2,
        },
      },
      run: {
        workflowId: "support-agent",
        workflowVersion: 2,
        status: "ready",
        decision: {
          intent: "answer_docs",
          matchedIntent: true,
        },
      },
    });
  });

  it("passes explicit workflow selection options through resolver", () => {
    const result = buildAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      workflow("ops-agent", 1),
    ]), {
      workflowId: "support-agent",
      version: 1,
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
      },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });

    expect(result).toMatchObject({
      built: true,
      run: {
        workflowId: "support-agent",
        workflowVersion: 1,
      },
    });
  });

  it("returns resolve_failed when the package cannot be loaded or selected", () => {
    const invalidPackage = buildAssistantWorkflowRunFromPackage({ format: "other" });
    const ambiguousPackage = buildAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
      workflow("ops-agent", 1),
    ]));

    expect(invalidPackage).toMatchObject({
      built: false,
      status: "resolve_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      run: null,
      resolve: {
        status: "load_failed",
      },
    });
    expect(ambiguousPackage).toMatchObject({
      built: false,
      status: "resolve_failed",
      reason: "Package contains multiple workflow ids; workflowId is required.",
      run: null,
      resolve: {
        status: "selection_failed",
      },
    });
  });

  it("can build runs from invalid definitions for authoring tools when explicitly allowed", () => {
    const result = buildAssistantWorkflowRunFromPackage(packageFor([
      invalidWorkflow("broken-agent", 1),
    ]), {
      allowBlocked: true,
      includeInvalid: true,
      classification: {
        intent: "answer_docs",
      },
    });

    expect(result).toMatchObject({
      built: true,
      status: "run_built",
      resolve: {
        resolved: true,
        definition: {
          summary: {
            valid: false,
          },
        },
      },
      run: {
        workflowId: "broken-agent",
        status: "ready",
      },
    });
  });

  it("builds compact package-run trace payloads", () => {
    const built = buildAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
      },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });
    const failed = buildAssistantWorkflowRunFromPackage({ format: "other" });

    expect(buildAssistantWorkflowDefinitionPackageRunTracePayload(built)).toMatchObject({
      built: true,
      status: "run_built",
      reason: null,
      resolve: {
        status: "resolved",
      },
      run: {
        workflowId: "support-agent",
        status: "ready",
      },
    });
    expect(buildAssistantWorkflowDefinitionPackageRunTracePayload(failed)).toMatchObject({
      built: false,
      status: "resolve_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      resolve: {
        status: "load_failed",
      },
      run: null,
    });
  });
});

function packageFor(definitions: readonly AssistantWorkflowDefinition[]) {
  return buildAssistantWorkflowDefinitionPackage(definitions, {
    generatedAt: "2026-06-29T10:00:00.000Z",
    packageId: "test-suite",
  });
}

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
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
      requiredContext: ["document-scope"],
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
    presentations: [{
      id: "text",
      description: "Text response.",
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
