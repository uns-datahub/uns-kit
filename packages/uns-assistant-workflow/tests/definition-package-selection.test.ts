import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageSelectionTracePayload,
  selectAssistantWorkflowDefinitionFromPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package selection", () => {
  it("selects the latest valid definition from a single-workflow package without requiring workflowId", () => {
    const result = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      invalidWorkflow("support-agent", 3),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(result).toMatchObject({
      selected: true,
      status: "selected",
      workflowId: "support-agent",
      workflowVersion: 2,
      candidateWorkflowIds: ["support-agent"],
      definition: {
        workflowVersion: 2,
      },
    });
  });

  it("selects an explicit version", () => {
    const result = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }), {
      workflowId: "support-agent",
      version: 1,
    });

    expect(result).toMatchObject({
      selected: true,
      status: "selected",
      workflowId: "support-agent",
      workflowVersion: 1,
    });
  });

  it("can select invalid definitions when authoring tools opt in", () => {
    const result = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      invalidWorkflow("support-agent", 2),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }), {
      workflowId: "support-agent",
      includeInvalid: true,
    });

    expect(result).toMatchObject({
      selected: true,
      status: "selected",
      workflowVersion: 2,
      definition: {
        summary: {
          valid: false,
        },
      },
    });
  });

  it("requires workflowId for multi-workflow packages", () => {
    const result = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("ops-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "multi-suite",
    }));

    expect(result).toEqual({
      selected: false,
      status: "ambiguous_workflow",
      workflowId: null,
      workflowVersion: null,
      definition: null,
      reason: "Package contains multiple workflow ids; workflowId is required.",
      candidateWorkflowIds: ["ops-agent", "support-agent"],
    });
  });

  it("reports not_found for missing workflow or version", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(selectAssistantWorkflowDefinitionFromPackage(definitionPackage, {
      workflowId: "missing-agent",
    })).toEqual({
      selected: false,
      status: "not_found",
      workflowId: "missing-agent",
      workflowVersion: null,
      definition: null,
      reason: "No valid workflow definition found for missing-agent.",
      candidateWorkflowIds: ["support-agent"],
    });
    expect(selectAssistantWorkflowDefinitionFromPackage(definitionPackage, {
      workflowId: "support-agent",
      version: 2,
    })).toEqual({
      selected: false,
      status: "not_found",
      workflowId: "support-agent",
      workflowVersion: 2,
      definition: null,
      reason: "No valid workflow definition found for support-agent@2.",
      candidateWorkflowIds: ["support-agent"],
    });
  });

  it("reports empty packages", () => {
    const result = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "empty-suite",
    }));

    expect(result).toEqual({
      selected: false,
      status: "empty_package",
      workflowId: null,
      workflowVersion: null,
      definition: null,
      reason: "Package does not contain any workflow definitions.",
      candidateWorkflowIds: [],
    });
  });

  it("builds compact selection trace payloads", () => {
    const selected = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));
    const ambiguous = selectAssistantWorkflowDefinitionFromPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("ops-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "multi-suite",
    }));

    expect(buildAssistantWorkflowDefinitionPackageSelectionTracePayload(selected)).toMatchObject({
      selected: true,
      status: "selected",
      workflowId: "support-agent",
      workflowVersion: 1,
      reason: null,
      definition: {
        schemaVersion: 1,
        workflowId: "support-agent",
        workflowVersion: 1,
      },
    });
    expect(buildAssistantWorkflowDefinitionPackageSelectionTracePayload(ambiguous)).toEqual({
      selected: false,
      status: "ambiguous_workflow",
      workflowId: null,
      workflowVersion: null,
      reason: "Package contains multiple workflow ids; workflowId is required.",
      candidateWorkflowIds: ["ops-agent", "support-agent"],
      definition: null,
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
