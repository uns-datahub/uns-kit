import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowEvalActualFromSerializedRunReport,
  buildAssistantWorkflowEvalCase,
  buildAssistantWorkflowEvalCaseFromSerializedRunReport,
  buildAssistantWorkflowEvalResultTracePayload,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  defineAssistantWorkflow,
  evaluateAssistantWorkflowEvalCase,
  evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport,
  serializeAssistantWorkflowRunReport,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow eval results", () => {
  it("passes when serialized run report matches eval case expectations", () => {
    const [completed] = buildReportPair();
    const serialized = serializeAssistantWorkflowRunReport(completed);
    const evalCase = buildAssistantWorkflowEvalCaseFromSerializedRunReport(serialized, {
      prompt: "Answer from docs.",
      required: true,
    });

    const result = evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(evalCase, serialized);

    expect(result).toMatchObject({
      caseId: evalCase.id,
      required: true,
      status: "pass",
      failedCount: 0,
      actual: {
        workflowId: "eval-result-agent",
        workflowVersion: 1,
        intent: "answer_docs",
        presentation: "text",
        status: "completed",
        outcomeKind: "final_text",
        planStepIds: ["retrieve_docs", "synthesize_answer"],
        activePlanningStepProfileIds: [],
        profileStepIds: [],
        tools: ["query_docs"],
        signalNames: [],
      },
    });
    expect(result.checks.filter((check) => check.status === "pass").map((check) => check.name)).toEqual([
      "intent",
      "presentation",
      "status",
      "outcome_kind",
      "plan_steps",
      "tools",
    ]);
  });

  it("fails mismatched scalar and set expectations", () => {
    const [completed] = buildReportPair();
    const serialized = serializeAssistantWorkflowRunReport(completed);
    const evalCase = buildAssistantWorkflowEvalCase({
      prompt: "Answer from docs.",
      expectations: {
        intent: "unknown",
        status: "failed",
        planStepIds: ["retrieve_docs", "missing_step"],
        tools: ["query_docs", "missing_tool"],
      },
    });

    const result = evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(evalCase, serialized);

    expect(result.status).toBe("fail");
    expect(result.failedCount).toBe(4);
    expect(result.checks.filter((check) => check.status === "fail")).toMatchObject([
      { name: "intent", detail: "expected unknown, got answer_docs" },
      { name: "status", detail: "expected failed, got completed" },
      { name: "plan_steps", detail: "missing: missing_step" },
      { name: "tools", detail: "missing: missing_tool" },
    ]);
  });

  it("skips checks with no expectations", () => {
    const [completed] = buildReportPair();
    const serialized = serializeAssistantWorkflowRunReport(completed);
    const evalCase = buildAssistantWorkflowEvalCase({
      prompt: "No expectations yet.",
    });

    const result = evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(evalCase, serialized);

    expect(result.status).toBe("skipped");
    expect(result.passedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.skippedCount).toBe(10);
  });

  it("can evaluate active planning profile expectations from serialized run reports", () => {
    const [completed] = buildReportPair();
    const serialized = serializeAssistantWorkflowRunReport(completed);
    const profileSerialized = {
      ...serialized,
      evaluation: {
        ...serialized.evaluation,
        activePlanningStepProfileIds: ["source_listing_context"],
        profileStepIds: ["list_sources"],
      },
    };
    const evalCase = buildAssistantWorkflowEvalCaseFromSerializedRunReport(profileSerialized, {
      prompt: "Answer from docs with sources.",
    });

    const result = evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(evalCase, profileSerialized);

    expect(result).toMatchObject({
      status: "pass",
      actual: {
        activePlanningStepProfileIds: ["source_listing_context"],
        profileStepIds: ["list_sources"],
      },
    });
    expect(result.checks.filter((check) => check.status === "pass").map((check) => check.name)).toContain("planning_profiles");
    expect(result.checks.filter((check) => check.status === "pass").map((check) => check.name)).toContain("profile_steps");
    expect(buildAssistantWorkflowEvalResultTracePayload(result)).toMatchObject({
      actual: {
        activePlanningStepProfileIds: ["source_listing_context"],
        profileStepIds: ["list_sources"],
      },
    });
  });

  it("can evaluate quality signals supplied outside serialized run reports", () => {
    const [completed] = buildReportPair();
    const actual = buildAssistantWorkflowEvalActualFromSerializedRunReport(
      serializeAssistantWorkflowRunReport(completed),
      { qualitySignalNames: ["missing_range"] },
    );
    const evalCase = buildAssistantWorkflowEvalCase({
      prompt: "Answer from docs.",
      expectations: {
        qualitySignalNames: ["missing_range"],
      },
    });

    const result = evaluateAssistantWorkflowEvalCase(evalCase, actual);

    expect(result).toMatchObject({
      status: "pass",
      passedCount: 1,
    });
    expect(result.checks.find((check) => check.name === "quality_signals")).toMatchObject({
      status: "pass",
      expected: ["missing_range"],
      actual: ["missing_range"],
    });
  });

  it("builds compact trace payloads for eval results", () => {
    const [, notHandled] = buildReportPair();
    const serialized = serializeAssistantWorkflowRunReport(notHandled);
    const evalCase = buildAssistantWorkflowEvalCaseFromSerializedRunReport(serialized, {
      prompt: "Unsupported request.",
    });
    const result = evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(evalCase, serialized);

    const payload = buildAssistantWorkflowEvalResultTracePayload(result);

    expect(payload).toMatchObject({
      caseId: evalCase.id,
      status: "pass",
      actual: {
        status: "not_handled",
        signalNames: ["run_not_handled", "outcome_unhandled"],
      },
    });
    expect((payload["checks"] as Array<Record<string, unknown>>).find((check) => check["name"] === "intent")).toMatchObject({
      name: "intent",
      status: "pass",
    });
  });
});

function buildReportPair() {
  const workflow = defineAssistantWorkflow(baseWorkflow());
  const completedRun = buildAssistantWorkflowRun(workflow, {
    classification: { intent: "answer_docs", presentation: "text", confidence: 0.9, entities: {} },
    availableToolNames: ["query_docs"],
    availableContext: ["document-scope"],
  });
  const notHandledRun = buildAssistantWorkflowRun(workflow, {
    classification: { intent: "unknown", confidence: 0.1, entities: {} },
    availableToolNames: ["query_docs"],
    availableContext: ["document-scope"],
  });
  return [
    buildAssistantWorkflowRunReport({
      run: completedRun,
      outcome: assistantWorkflowFinalText("Done."),
    }),
    buildAssistantWorkflowRunReport({
      run: notHandledRun,
      outcome: assistantWorkflowNotHandled("unsupported intent"),
    }),
  ] as const;
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "eval-result-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      planningSteps: ["retrieve_docs", "synthesize_answer"],
    }],
    presentations: [{
      id: "text",
      description: "Plain text answer.",
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
    }, {
      id: "synthesize_answer",
      description: "Synthesize answer.",
      kind: "synthesize",
    }],
  };
}
