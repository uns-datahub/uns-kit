import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageReviewTracePayload,
  reviewAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package review", () => {
  it("marks a clean package as ready", () => {
    const review = reviewAssistantWorkflowDefinitionPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
      packageVersion: "1.0.0",
    }));

    expect(review).toMatchObject({
      packageId: "support-suite",
      packageVersion: "1.0.0",
      status: "ready",
      definitionCount: 1,
      workflowCount: 1,
      validDefinitionCount: 1,
      invalidDefinitionCount: 0,
      warningDefinitionCount: 0,
      duplicateVersionCount: 0,
      blockingReasons: [],
      warningReasons: [],
      definitions: [{
        workflowId: "support-agent",
        workflowVersion: 1,
        valid: true,
        errorCount: 0,
        warningCount: 0,
      }],
    });
  });

  it("marks packages with warnings as warning", () => {
    const review = reviewAssistantWorkflowDefinitionPackage(buildAssistantWorkflowDefinitionPackage([
      workflowWithUnboundTool("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(review).toMatchObject({
      status: "warning",
      invalidDefinitionCount: 0,
      warningDefinitionCount: 1,
      blockingReasons: [],
      warningReasons: ["1 workflow definition(s) have warnings."],
      definitions: [{
        workflowId: "support-agent",
        warningCount: 1,
        diagnostics: [{
          severity: "warning",
          code: "unbound_tool_capability",
        }],
      }],
    });
  });

  it("marks invalid or duplicate packages as blocked", () => {
    const review = reviewAssistantWorkflowDefinitionPackage(buildAssistantWorkflowDefinitionPackage([
      workflow("support-agent", 1),
      workflow("support-agent", 1),
      invalidWorkflow("broken-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(review).toMatchObject({
      status: "blocked",
      invalidDefinitionCount: 1,
      duplicateVersionCount: 1,
      blockingReasons: [
        "1 workflow definition(s) are invalid.",
        "1 duplicate workflow id/version pair(s) exist.",
      ],
    });
  });

  it("marks empty packages as blocked", () => {
    const review = reviewAssistantWorkflowDefinitionPackage(buildAssistantWorkflowDefinitionPackage([], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "empty-suite",
    }));

    expect(review).toMatchObject({
      status: "blocked",
      blockingReasons: ["Package does not contain any workflow definitions."],
    });
  });

  it("builds a compact trace payload", () => {
    const review = reviewAssistantWorkflowDefinitionPackage(buildAssistantWorkflowDefinitionPackage([
      workflowWithUnboundTool("support-agent", 1),
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      packageId: "support-suite",
    }));

    expect(buildAssistantWorkflowDefinitionPackageReviewTracePayload(review)).toMatchObject({
      packageId: "support-suite",
      packageVersion: null,
      status: "warning",
      definitionCount: 1,
      warningReasons: ["1 workflow definition(s) have warnings."],
      definitions: [{
        workflowId: "support-agent",
        diagnostics: [{
          severity: "warning",
          code: "unbound_tool_capability",
        }],
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
      requiredToolHints: ["missing_tool"],
    }],
  };
}
