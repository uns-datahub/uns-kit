import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunTracePayload,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow run", () => {
  it("builds one run object from classification, tool readiness, and context readiness", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());

    const run = buildAssistantWorkflowRun(workflow, {
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.92,
        entities: { containers: ["manual"] },
      },
      availableToolNames: ["query_docs", "list_docs"],
      availableContext: ["auth", "document-scope"],
    });

    expect(run).toMatchObject({
      workflowId: "run-contract-agent",
      workflowVersion: 1,
      status: "ready",
      decision: {
        intent: "answer_docs",
        matchedIntent: true,
        effectivePresentation: "text",
        workflowSuggestedTools: ["query_docs", "list_docs"],
      },
      executionPlan: {
        status: "ready",
        readyToolNames: ["query_docs", "list_docs"],
        missingContextRequirements: [],
      },
    });
  });

  it("exposes a stable trace payload with decision and execution plan sections", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const run = buildAssistantWorkflowRun(workflow, {
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        confidence: 0.92,
        entities: { containers: ["manual"] },
      },
      availableToolNames: ["query_docs"],
      availableContext: [],
    });

    expect(buildAssistantWorkflowRunTracePayload(run)).toMatchObject({
      workflowId: "run-contract-agent",
      workflowVersion: 1,
      status: "blocked",
      decision: {
        intent: "answer_docs",
        matchedIntent: true,
      },
      executionPlan: {
        status: "blocked",
        missingContextRequirements: ["document-scope"],
      },
    });
  });
});

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "run-contract-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      planningSteps: ["retrieve_docs", "synthesize_answer"],
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
    }, {
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
      requiredContext: ["auth"],
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }, {
      name: "list_docs",
      provider: "http",
      path: "/docs",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
    }, {
      id: "synthesize_answer",
      description: "Synthesize answer.",
      kind: "synthesize",
      toolHints: ["list_docs"],
    }],
    presentations: [{ id: "text", description: "Text answer." }],
  };
}
