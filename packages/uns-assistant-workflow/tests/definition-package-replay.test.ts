import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackageReplayLinesTracePayload,
  runAssistantWorkflowDefinitionPackageReplayLines,
  stringifyAssistantWorkflowDefinitionLines,
  stringifyAssistantWorkflowDefinitionManifestLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package replay", () => {
  it("builds a package and review from definition manifest lines", () => {
    const result = runAssistantWorkflowDefinitionPackageReplayLines({
      definitionLines: stringifyAssistantWorkflowDefinitionManifestLines([
        workflow("support-agent", 1),
        workflowWithUnboundTool("warning-agent", 1),
      ], {
        generatedAt: "2026-06-29T10:00:00.000Z",
        trailingNewline: true,
      }),
      packageOptions: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        packageId: "support-suite",
      },
    });

    expect(result).toMatchObject({
      format: "definition-manifest",
      parseErrorCount: 0,
      parse: {
        format: "definition-manifest",
        manifestParse: {
          lineCount: 2,
          manifestCount: 2,
        },
      },
      definitionPackage: {
        packageId: "support-suite",
        definitionCount: 2,
        validDefinitionCount: 2,
      },
      review: {
        status: "warning",
        warningDefinitionCount: 1,
      },
    });
  });

  it("builds a package and review from serialized definition lines", () => {
    const result = runAssistantWorkflowDefinitionPackageReplayLines({
      format: "serialized-definition",
      definitionLines: stringifyAssistantWorkflowDefinitionLines([
        workflow("support-agent", 1),
      ], { trailingNewline: true }),
      packageOptions: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        packageId: "serialized-suite",
      },
    });

    expect(result).toMatchObject({
      format: "serialized-definition",
      parseErrorCount: 0,
      parse: {
        format: "serialized-definition",
        serializedDefinitionParse: {
          lineCount: 1,
          definitionCount: 1,
        },
      },
      definitionPackage: {
        packageId: "serialized-suite",
        definitionCount: 1,
        catalog: {
          generatedAt: "2026-06-29T10:00:00.000Z",
        },
        manifests: [{
          generatedAt: "2026-06-29T10:00:00.000Z",
        }],
      },
      review: {
        status: "ready",
      },
    });
  });

  it("preserves parse errors while reviewing valid lines", () => {
    const result = runAssistantWorkflowDefinitionPackageReplayLines({
      definitionLines: [
        stringifyAssistantWorkflowDefinitionManifestLines([workflow("support-agent", 1)], {
          generatedAt: "2026-06-29T10:00:00.000Z",
        }),
        "{invalid",
        JSON.stringify({ format: "assistant.workflow.definition", formatVersion: 1 }),
      ].join("\n"),
      packageOptions: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        packageId: "support-suite",
      },
    });

    expect(result).toMatchObject({
      parseErrorCount: 2,
      parse: {
        format: "definition-manifest",
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
      },
      definitionPackage: {
        definitionCount: 1,
      },
      review: {
        status: "ready",
      },
    });
  });

  it("returns blocked review for invalid definitions", () => {
    const result = runAssistantWorkflowDefinitionPackageReplayLines({
      definitionLines: stringifyAssistantWorkflowDefinitionManifestLines([
        invalidWorkflow("broken-agent", 1),
      ], {
        generatedAt: "2026-06-29T10:00:00.000Z",
      }),
      packageOptions: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        packageId: "support-suite",
      },
    });

    expect(result).toMatchObject({
      definitionPackage: {
        invalidDefinitionCount: 1,
      },
      review: {
        status: "blocked",
        blockingReasons: ["1 workflow definition(s) are invalid."],
      },
    });
  });

  it("builds a compact trace payload", () => {
    const result = runAssistantWorkflowDefinitionPackageReplayLines({
      definitionLines: stringifyAssistantWorkflowDefinitionManifestLines([
        workflow("support-agent", 1),
      ], {
        generatedAt: "2026-06-29T10:00:00.000Z",
      }),
      packageOptions: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        packageId: "support-suite",
      },
    });

    expect(buildAssistantWorkflowDefinitionPackageReplayLinesTracePayload(result)).toMatchObject({
      format: "definition-manifest",
      parse: {
        format: "definition-manifest",
        manifestCount: 1,
        errorCount: 0,
      },
      parseErrorCount: 0,
      definitionPackage: {
        packageId: "support-suite",
        definitionCount: 1,
      },
      review: {
        status: "ready",
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

function workflowWithUnboundTool(id: string, version: number): AssistantWorkflowDefinition {
  const definition = workflow(id, version);
  return {
    ...definition,
    toolBindings: [],
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
