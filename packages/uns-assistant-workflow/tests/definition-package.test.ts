import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionManifest,
  buildAssistantWorkflowDefinitionManifestPackage,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageTracePayload,
  parseAssistantWorkflowDefinitionPackage,
  stringifyAssistantWorkflowDefinitionManifestPackage,
  stringifyAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package", () => {
  it("builds a package from workflow definitions", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      invalidWorkflow("broken-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
      packageVersion: "1.2.3",
      description: "Support assistant definitions.",
      tags: ["support", "docs", "support"],
    });

    expect(definitionPackage).toMatchObject({
      format: "assistant.workflow.definition-package",
      formatVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
      packageVersion: "1.2.3",
      description: "Support assistant definitions.",
      tags: ["docs", "support"],
      definitionCount: 3,
      workflowCount: 2,
      validDefinitionCount: 2,
      invalidDefinitionCount: 1,
      duplicateVersionCount: 0,
      catalog: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        definitionCount: 3,
      },
      manifests: [{
        workflowId: "support-agent",
        workflowVersion: 1,
      }, {
        workflowId: "support-agent",
        workflowVersion: 2,
      }, {
        workflowId: "broken-agent",
        workflowVersion: 1,
        valid: false,
      }],
    });
  });

  it("derives a package id from manifests when none is supplied", () => {
    const single = buildAssistantWorkflowDefinitionPackage([workflow("support-agent", 1)], {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const multi = buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("ops-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const empty = buildAssistantWorkflowDefinitionPackage([], {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(single.packageId).toBe("support-agent");
    expect(multi.packageId).toBe("assistant-workflows-2");
    expect(empty.packageId).toBe("assistant-workflows");
  });

  it("builds a package from already-built manifests", () => {
    const manifests = [
      buildAssistantWorkflowDefinitionManifest(workflow("support-agent", 1), {
        generatedAt: "2026-06-29T10:00:00.000Z",
      }),
    ];
    const definitionPackage = buildAssistantWorkflowDefinitionManifestPackage(manifests, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(definitionPackage).toMatchObject({
      packageId: "support-suite",
      definitionCount: 1,
      workflowCount: 1,
      validDefinitionCount: 1,
    });
  });

  it("stringifies, parses, and rebuilds consistent package catalogs", () => {
    const json = stringifyAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
    ], 2, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
      packageVersion: "1.2.3",
    });
    const parsed = parseAssistantWorkflowDefinitionPackage(JSON.parse(json));

    expect(json).toContain('\n  "format": "assistant.workflow.definition-package"');
    expect(parsed).toMatchObject({
      packageId: "support-suite",
      packageVersion: "1.2.3",
      definitionCount: 2,
      workflowCount: 1,
      catalog: {
        entries: [{
          workflowId: "support-agent",
          workflowVersion: 2,
        }, {
          workflowId: "support-agent",
          workflowVersion: 1,
        }],
      },
    });
  });

  it("stringifies a package from manifests", () => {
    const manifests = [
      buildAssistantWorkflowDefinitionManifest(workflow("support-agent", 1), {
        generatedAt: "2026-06-29T10:00:00.000Z",
      }),
    ];
    const json = stringifyAssistantWorkflowDefinitionManifestPackage(manifests, 2, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(parseAssistantWorkflowDefinitionPackage(JSON.parse(json))).toMatchObject({
      packageId: "support-suite",
      definitionCount: 1,
    });
  });

  it("rejects malformed or inconsistent packages", () => {
    const parsed = JSON.parse(stringifyAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], 2, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(parseAssistantWorkflowDefinitionPackage(null)).toBeNull();
    expect(parseAssistantWorkflowDefinitionPackage({ format: "other" })).toBeNull();
    expect(parseAssistantWorkflowDefinitionPackage({
      ...parsed,
      definitionCount: 2,
    })).toBeNull();
    expect(parseAssistantWorkflowDefinitionPackage({
      ...parsed,
      manifests: [{ format: "assistant.workflow.definition", formatVersion: 1 }],
    })).toBeNull();
  });

  it("builds a compact trace payload", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(buildAssistantWorkflowDefinitionPackageTracePayload(definitionPackage)).toMatchObject({
      format: "assistant.workflow.definition-package",
      packageId: "support-suite",
      packageVersion: null,
      definitionCount: 1,
      catalog: {
        definitionCount: 1,
      },
      manifests: [{
        workflowId: "support-agent",
        workflowVersion: 1,
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
