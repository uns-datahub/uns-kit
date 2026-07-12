import { describe, expect, it } from "vitest";
import {
  assistantWorkflowClarification,
  assistantWorkflowDegraded,
  assistantWorkflowDirectRoute,
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  buildAssistantWorkflowRunReportTracePayload,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow run report", () => {
  it("combines run, tool execution, and final outcome into one report", async () => {
    const run = readyRun();
    const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
      run.toolInvocationQueue,
      (invocation) => ({ toolName: invocation.toolName }),
    );
    const report = buildAssistantWorkflowRunReport({
      run,
      toolExecution,
      outcome: assistantWorkflowFinalText("Done.", "return"),
    });

    expect(report).toMatchObject({
      workflowId: "run-report-agent",
      workflowVersion: 1,
      status: "completed",
      outcomeSummary: {
        kind: "final_text",
        handled: true,
        contentChars: 5,
      },
    });
    expect(buildAssistantWorkflowRunReportTracePayload(report)).toMatchObject({
      workflowId: "run-report-agent",
      status: "completed",
      run: { status: "ready" },
      toolExecution: { status: "complete", successCount: 3 },
      outcome: { kind: "final_text", handled: true },
      evaluation: {
        activePlanningStepProfileIds: ["source_listing_context"],
        profileStepIds: ["list_sources"],
      },
    });
  });

  it("reports failed when tool execution failed before a non-degraded outcome is produced", async () => {
    const run = readyRun();
    const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
      run.toolInvocationQueue,
      () => {
        throw new Error("tool failed");
      },
    );
    const report = buildAssistantWorkflowRunReport({
      run,
      toolExecution,
      outcome: assistantWorkflowFinalText("Could not finish."),
    });

    expect(report.status).toBe("failed");
    expect(buildAssistantWorkflowRunReportTracePayload(report)).toMatchObject({
      status: "failed",
      toolExecution: { status: "failed", errorCount: 1 },
    });
  });

  it("prioritizes explicit outcome states", () => {
    const run = readyRun();

    expect(buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowClarification("Which source?", "missing_source_scope"),
    }).status).toBe("clarification");

    expect(buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowDegraded("Partial.", "tool_timeout"),
    }).status).toBe("degraded");

    expect(buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowNotHandled("no route"),
    }).status).toBe("not_handled");
  });

  it("treats direct-route outcomes as completed handled reports", () => {
    const run = readyRun();
    const report = buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowDirectRoute("value", {
        content: "Latest value is 42.",
        reason: "attribute_intent",
        artifactKind: "value_card",
      }),
    });

    expect(report.status).toBe("completed");
    expect(report.outcomeSummary).toMatchObject({
      kind: "direct_route",
      handled: true,
      contentChars: 19,
      reason: "attribute_intent",
      artifactKind: "value_card",
      route: "value",
    });
    expect(buildAssistantWorkflowRunReportTracePayload(report)).toMatchObject({
      status: "completed",
      outcome: {
        kind: "direct_route",
        handled: true,
        route: "value",
      },
      evaluation: {
        outcomeKind: "direct_route",
        handled: true,
      },
    });
  });
});

function readyRun() {
  const workflow = defineAssistantWorkflow(baseWorkflow());
  return buildAssistantWorkflowRun(workflow, {
    classification: {
      intent: "answer_docs",
      confidence: 0.9,
      presentation: "text",
      toolsToExpose: ["query_docs", "list_docs"],
      entities: { containers: ["manual"] },
    },
    availableToolNames: ["query_docs", "list_docs"],
    availableContext: ["auth", "document-scope"],
  });
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "run-report-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      planningSteps: ["retrieve_docs", "synthesize_answer"],
      planningStepProfiles: [{
        id: "source_listing_context",
        description: "List sources before synthesis when the classifier selected source listing.",
        condition: {
          presentation: "text",
          requiredTools: ["list_docs"],
        },
        planningSteps: ["list_sources"],
      }],
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
      id: "list_sources",
      description: "List sources.",
      kind: "retrieve",
      toolHints: ["list_docs"],
    }, {
      id: "synthesize_answer",
      description: "Synthesize answer.",
      kind: "synthesize",
      toolHints: ["list_docs"],
    }],
  };
}
