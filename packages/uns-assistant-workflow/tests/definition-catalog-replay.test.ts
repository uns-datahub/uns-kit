import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionManifestCatalogReplayLinesTracePayload,
  buildAssistantWorkflowDefinitionCatalogReplayLinesTracePayload,
  runAssistantWorkflowDefinitionCatalogReplayLines,
  runAssistantWorkflowDefinitionManifestCatalogReplayLines,
  stringifyAssistantWorkflowDefinitionManifestLines,
  stringifyAssistantWorkflowDefinitionLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition catalog replay", () => {
  it("builds a definition catalog from serialized definition lines", () => {
    const result = runAssistantWorkflowDefinitionCatalogReplayLines({
      definitionLines: stringifyAssistantWorkflowDefinitionLines([
        workflow("support-agent", 1),
        workflow("support-agent", 2),
        invalidWorkflow("broken-agent", 1),
      ]),
    });

    expect(result).toMatchObject({
      definitionParse: {
        lineCount: 3,
        definitionCount: 3,
        errorCount: 0,
      },
      parseErrorCount: 0,
      catalog: {
        definitionCount: 3,
        workflowCount: 2,
        validDefinitionCount: 2,
        invalidDefinitionCount: 1,
      },
    });
  });

  it("keeps parse errors and builds catalog from valid lines", () => {
    const result = runAssistantWorkflowDefinitionCatalogReplayLines({
      definitionLines: [
        stringifyAssistantWorkflowDefinitionLines([workflow("support-agent", 1)]),
        "{invalid",
        JSON.stringify({ schemaVersion: 1 }),
      ].join("\n"),
    });

    expect(result).toMatchObject({
      definitionParse: {
        lineCount: 3,
        definitionCount: 1,
        errorCount: 2,
        errors: [{
          lineNumber: 2,
          reason: "invalid_json",
        }, {
          lineNumber: 3,
          reason: "invalid_definition",
        }],
      },
      parseErrorCount: 2,
      catalog: {
        definitionCount: 1,
        workflowCount: 1,
      },
    });
  });

  it("builds a compact replay trace payload", () => {
    const result = runAssistantWorkflowDefinitionCatalogReplayLines({
      definitionLines: stringifyAssistantWorkflowDefinitionLines([workflow("support-agent", 1)]),
    });

    expect(buildAssistantWorkflowDefinitionCatalogReplayLinesTracePayload(result)).toMatchObject({
      definitionParse: {
        definitionCount: 1,
        errorCount: 0,
      },
      parseErrorCount: 0,
      catalog: {
        definitionCount: 1,
        entries: [{
          workflowId: "support-agent",
          workflowVersion: 1,
        }],
      },
    });
  });

  it("builds a definition catalog from definition manifest lines", () => {
    const result = runAssistantWorkflowDefinitionManifestCatalogReplayLines({
      manifestLines: stringifyAssistantWorkflowDefinitionManifestLines([
        workflow("support-agent", 1),
        workflow("support-agent", 2),
        invalidWorkflow("broken-agent", 1),
      ], { generatedAt: "2026-06-29T10:00:00.000Z" }),
    });

    expect(result).toMatchObject({
      manifestParse: {
        lineCount: 3,
        manifestCount: 3,
        errorCount: 0,
      },
      parseErrorCount: 0,
      catalog: {
        definitionCount: 3,
        workflowCount: 2,
        validDefinitionCount: 2,
        invalidDefinitionCount: 1,
      },
    });
  });

  it("keeps manifest parse errors and builds catalog from valid manifest lines", () => {
    const result = runAssistantWorkflowDefinitionManifestCatalogReplayLines({
      manifestLines: [
        stringifyAssistantWorkflowDefinitionManifestLines([workflow("support-agent", 1)], {
          generatedAt: "2026-06-29T10:00:00.000Z",
        }),
        "{invalid",
        JSON.stringify({ format: "assistant.workflow.definition", formatVersion: 1 }),
      ].join("\n"),
    });

    expect(result).toMatchObject({
      manifestParse: {
        lineCount: 3,
        manifestCount: 1,
        errorCount: 2,
        errors: [{
          lineNumber: 2,
          reason: "invalid_json",
        }, {
          lineNumber: 3,
          reason: "invalid_manifest",
        }],
      },
      parseErrorCount: 2,
      catalog: {
        definitionCount: 1,
        workflowCount: 1,
      },
    });
  });

  it("builds a compact manifest replay trace payload", () => {
    const result = runAssistantWorkflowDefinitionManifestCatalogReplayLines({
      manifestLines: stringifyAssistantWorkflowDefinitionManifestLines([workflow("support-agent", 1)], {
        generatedAt: "2026-06-29T10:00:00.000Z",
      }),
    });

    expect(buildAssistantWorkflowDefinitionManifestCatalogReplayLinesTracePayload(result)).toMatchObject({
      manifestParse: {
        manifestCount: 1,
        errorCount: 0,
      },
      parseErrorCount: 0,
      catalog: {
        definitionCount: 1,
        entries: [{
          workflowId: "support-agent",
          workflowVersion: 1,
        }],
      },
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
