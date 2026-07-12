import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageLoadTracePayload,
  findAssistantWorkflowDefinitionPackageDefinition,
  findLatestAssistantWorkflowDefinitionPackageDefinition,
  loadAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package loader", () => {
  it("loads a ready package", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(loadAssistantWorkflowDefinitionPackage(definitionPackage)).toMatchObject({
      loaded: true,
      status: "loaded",
      definitionPackage: {
        packageId: "support-suite",
      },
      review: {
        status: "ready",
      },
      blockingReasons: [],
      warningReasons: [],
    });
  });

  it("loads warning packages because warnings are not runtime blockers", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      workflowWithUnboundTool("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(loadAssistantWorkflowDefinitionPackage(definitionPackage)).toMatchObject({
      loaded: true,
      status: "loaded",
      review: {
        status: "warning",
      },
      warningReasons: ["1 workflow definition(s) have warnings."],
    });
  });

  it("blocks invalid packages by default", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      invalidWorkflow("broken-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(loadAssistantWorkflowDefinitionPackage(definitionPackage)).toMatchObject({
      loaded: false,
      status: "blocked",
      review: {
        status: "blocked",
      },
      blockingReasons: ["1 workflow definition(s) are invalid."],
    });
  });

  it("can load blocked packages for authoring tools when explicitly allowed", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      invalidWorkflow("broken-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });

    expect(loadAssistantWorkflowDefinitionPackage(definitionPackage, { allowBlocked: true })).toMatchObject({
      loaded: true,
      status: "loaded",
      review: {
        status: "blocked",
      },
      blockingReasons: ["1 workflow definition(s) are invalid."],
    });
  });

  it("rejects malformed package JSON", () => {
    expect(loadAssistantWorkflowDefinitionPackage({ format: "other" })).toEqual({
      loaded: false,
      status: "invalid_package",
      definitionPackage: null,
      review: null,
      blockingReasons: ["Package JSON is not a valid assistant workflow definition package."],
      warningReasons: [],
    });
  });

  it("finds latest and specific definitions inside a loaded package", () => {
    const definitionPackage = buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 2),
      invalidWorkflow("support-agent", 3),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    });
    const loaded = loadAssistantWorkflowDefinitionPackage(definitionPackage, { allowBlocked: true });
    if (!loaded.definitionPackage) throw new Error("expected package");

    expect(findLatestAssistantWorkflowDefinitionPackageDefinition(loaded.definitionPackage, "support-agent")).toMatchObject({
      workflowVersion: 2,
    });
    expect(findLatestAssistantWorkflowDefinitionPackageDefinition(
      loaded.definitionPackage,
      "support-agent",
      { includeInvalid: true },
    )).toMatchObject({
      workflowVersion: 3,
    });
    expect(findAssistantWorkflowDefinitionPackageDefinition(loaded.definitionPackage, "support-agent", 1)).toMatchObject({
      workflowVersion: 1,
    });
    expect(findAssistantWorkflowDefinitionPackageDefinition(loaded.definitionPackage, "missing")).toBeNull();
  });

  it("builds compact load trace payloads", () => {
    const invalid = loadAssistantWorkflowDefinitionPackage({ format: "other" });
    const loaded = loadAssistantWorkflowDefinitionPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(buildAssistantWorkflowDefinitionPackageLoadTracePayload(invalid)).toEqual({
      loaded: false,
      status: "invalid_package",
      blockingReasons: ["Package JSON is not a valid assistant workflow definition package."],
      warningReasons: [],
      definitionPackage: null,
      review: null,
    });
    expect(buildAssistantWorkflowDefinitionPackageLoadTracePayload(loaded)).toMatchObject({
      loaded: true,
      status: "loaded",
      definitionPackage: {
        packageId: "support-suite",
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
