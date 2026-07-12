import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunEvaluationTracePayload,
  buildAssistantWorkflowRunReport,
  defineAssistantWorkflow,
  evaluateAssistantWorkflowRunReport,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowToolContextRequirement,
} from "../src/index.js";

describe("assistant workflow run evaluation", () => {
  it("evaluates a completed report without warning signals", async () => {
    const run = readyRun(["auth", "document-scope"]);
    const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
      run.toolInvocationQueue,
      (invocation) => ({ toolName: invocation.toolName }),
    );
    const report = buildAssistantWorkflowRunReport({
      run,
      toolExecution,
      outcome: assistantWorkflowFinalText("Done."),
    });

    expect(report.evaluation).toMatchObject({
      workflowId: "run-evaluation-agent",
      status: "completed",
      intent: "answer_docs",
      outcomeKind: "final_text",
      handled: true,
      toolResultStatus: "complete",
      readyToolCount: 2,
      invokedToolCount: 3,
      activePlanningStepProfileIds: ["source_listing_context"],
      profileStepIds: ["list_sources"],
      signalCount: 0,
      warningCount: 0,
      signals: [],
    });
  });

  it("reports tool execution failures as warning signals", async () => {
    const run = readyRun(["auth", "document-scope"]);
    const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
      run.toolInvocationQueue,
      () => {
        throw new Error("tool failed");
      },
    );
    const report = buildAssistantWorkflowRunReport({
      run,
      toolExecution,
      outcome: assistantWorkflowFinalText("Fallback."),
    });
    const evaluation = evaluateAssistantWorkflowRunReport(report);

    expect(evaluation.status).toBe("failed");
    expect(evaluation.warningCount).toBe(2);
    expect(evaluation.signals).toEqual([
      { name: "run_failed", severity: "warning", detail: "failed" },
      { name: "tool_execution_failed", severity: "warning", detail: "errors=1; skipped=2" },
    ]);
    expect(buildAssistantWorkflowRunEvaluationTracePayload(evaluation)).toMatchObject({
      status: "failed",
      signalCount: 2,
      warningCount: 2,
    });
  });

  it("reports missing context and unhandled outcomes", () => {
    const run = readyRun(["auth"]);
    const report = buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowNotHandled("no route"),
    });

    expect(report.evaluation.status).toBe("not_handled");
    expect(report.evaluation.signals).toEqual([
      { name: "run_not_handled", severity: "warning", detail: "no route" },
      { name: "missing_context", severity: "warning", detail: "document-scope" },
      { name: "outcome_unhandled", severity: "warning", detail: "no route" },
    ]);
  });
});

function readyRun(availableContext: AssistantWorkflowToolContextRequirement[]) {
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
    availableContext,
  });
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "run-evaluation-agent",
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
