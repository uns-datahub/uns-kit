import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionCatalog,
  buildAssistantWorkflowDefinitionCatalogTracePayload,
  buildAssistantWorkflowSerializedDefinitionCatalog,
  findAssistantWorkflowCatalogDefinition,
  findLatestAssistantWorkflowCatalogDefinition,
  serializeAssistantWorkflowDefinition,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition catalog", () => {
  it("aggregates multiple workflow definitions", () => {
    const catalog = buildAssistantWorkflowDefinitionCatalog([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      invalidWorkflow("broken-agent", 1),
    ]);

    expect(catalog).toMatchObject({
      definitionCount: 3,
      workflowCount: 2,
      validDefinitionCount: 2,
      invalidDefinitionCount: 1,
      duplicateVersionCount: 0,
      entries: [{
        workflowId: "broken-agent",
        workflowVersion: 1,
        valid: false,
      }, {
        workflowId: "support-agent",
        workflowVersion: 2,
        valid: true,
      }, {
        workflowId: "support-agent",
        workflowVersion: 1,
        valid: true,
      }],
    });
    expect(catalog.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("finds latest and specific valid definitions", () => {
    const catalog = buildAssistantWorkflowDefinitionCatalog([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      invalidWorkflow("support-agent", 3),
    ]);

    expect(findLatestAssistantWorkflowCatalogDefinition(catalog, "support-agent")).toMatchObject({
      workflowVersion: 2,
    });
    expect(findLatestAssistantWorkflowCatalogDefinition(catalog, "support-agent", { includeInvalid: true })).toMatchObject({
      workflowVersion: 3,
    });
    expect(findAssistantWorkflowCatalogDefinition(catalog, "support-agent", 1)).toMatchObject({
      workflowVersion: 1,
    });
    expect(findAssistantWorkflowCatalogDefinition(catalog, "missing")).toBeNull();
  });

  it("reports duplicate workflow id/version pairs", () => {
    const catalog = buildAssistantWorkflowDefinitionCatalog([
      workflow("support-agent", 1),
      workflow("support-agent", 1),
    ]);

    expect(catalog).toMatchObject({
      definitionCount: 2,
      workflowCount: 1,
      duplicateVersionCount: 1,
      diagnostics: [{
        severity: "error",
        code: "duplicate_definition_version",
        workflowId: "support-agent",
        workflowVersion: 1,
      }],
    });
  });

  it("can build a catalog from serialized definitions and compact trace payloads", () => {
    const serialized = serializeAssistantWorkflowDefinition(workflow("support-agent", 1));
    const catalog = buildAssistantWorkflowSerializedDefinitionCatalog([serialized], {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(buildAssistantWorkflowDefinitionCatalogTracePayload(catalog)).toMatchObject({
      generatedAt: "2026-06-29T10:00:00.000Z",
      definitionCount: 1,
      workflowCount: 1,
      validDefinitionCount: 1,
      entries: [{
        workflowId: "support-agent",
        workflowVersion: 1,
        definition: {
          schemaVersion: 1,
          workflowId: "support-agent",
        },
      }],
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
      requiredToolHints: ["missing_tool"],
    }],
  };
}
