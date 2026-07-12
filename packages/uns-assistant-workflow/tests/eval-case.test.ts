import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowEvalCase,
  buildAssistantWorkflowEvalCaseFromSerializedRunReport,
  buildAssistantWorkflowEvalCaseFromSerializedToolSelectionDecision,
  buildAssistantWorkflowEvalCaseFromTraceCandidate,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  buildAssistantWorkflowToolSelectionDecision,
  defineAssistantWorkflow,
  parseAssistantWorkflowEvalCase,
  parseAssistantWorkflowEvalCaseLines,
  serializeAssistantWorkflowRunReport,
  serializeAssistantWorkflowToolSelectionDecision,
  stringifyAssistantWorkflowEvalCase,
  stringifyAssistantWorkflowEvalCaseLines,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowTraceEvalCandidate,
} from "../src/index.js";

describe("assistant workflow eval cases", () => {
  it("builds a normalized manual eval case", () => {
    const evalCase = buildAssistantWorkflowEvalCase({
      prompt: "  Show latest furnace temperature.  ",
      tags: [" latest ", "latest", "", "temperature"],
      required: true,
      source: { requestId: "req-1" },
      expectations: {
        intent: "latest_value",
        tools: ["get_attribute_latest_values", "get_attribute_latest_values"],
      },
      notes: ["reviewed", "reviewed"],
      metadata: { lane: "assistant" },
    });

    expect(evalCase).toMatchObject({
      schemaVersion: 1,
      prompt: "Show latest furnace temperature.",
      required: true,
      tags: ["latest", "temperature"],
      source: {
        kind: "manual",
        requestId: "req-1",
      },
      expectations: {
        intent: "latest_value",
        presentation: null,
        status: null,
        outcomeKind: null,
        tools: ["get_attribute_latest_values"],
      },
      notes: ["reviewed"],
      metadata: { lane: "assistant" },
    });
    expect(evalCase.id).toMatch(/^manual-latest-value-/);
  });

  it("builds an eval case from a trace replay candidate", () => {
    const candidate: AssistantWorkflowTraceEvalCandidate = {
      promptPreview: "Compare zone temperatures.",
      expectedIntent: "compare_history",
      expectedPresentation: "chart",
      expectedPlanStepIds: ["resolve_scope", "query_history"],
      expectedActivePlanningStepProfileIds: ["compare_history_context"],
      expectedProfileStepIds: ["query_history"],
      expectedTools: ["get_history"],
      qualitySignalNames: ["missing_range"],
      notes: ["quality_signal: missing_range"],
    };

    const evalCase = buildAssistantWorkflowEvalCaseFromTraceCandidate(candidate, {
      tags: ["trace"],
      source: { requestId: "req-2" },
    });

    expect(evalCase).toMatchObject({
      source: {
        kind: "trace-replay",
        requestId: "req-2",
      },
      expectations: {
        intent: "compare_history",
        presentation: "chart",
        planStepIds: ["resolve_scope", "query_history"],
        activePlanningStepProfileIds: ["compare_history_context"],
        profileStepIds: ["query_history"],
        tools: ["get_history"],
        qualitySignalNames: ["missing_range"],
      },
      notes: ["quality_signal: missing_range"],
      tags: ["trace"],
    });
  });

  it("builds an eval case from a serialized run report", () => {
    const [completed] = buildReportPair();
    const serialized = serializeAssistantWorkflowRunReport(completed);

    const evalCase = buildAssistantWorkflowEvalCaseFromSerializedRunReport(serialized, {
      prompt: "Answer from docs.",
      tags: ["run-report"],
      source: { requestId: "req-3" },
    });

    expect(evalCase).toMatchObject({
      source: {
        kind: "run-report",
        requestId: "req-3",
        workflowId: "eval-case-agent",
        workflowVersion: 1,
      },
      expectations: {
        intent: "answer_docs",
        presentation: "text",
        status: "completed",
        outcomeKind: "final_text",
        planStepIds: ["retrieve_docs", "synthesize_answer"],
        tools: ["query_docs"],
        signalNames: [],
      },
    });
  });

  it("builds an eval case from a serialized tool-selection decision", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const selection = buildAssistantWorkflowToolSelectionDecision({
      workflow,
      classification: {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs"],
        confidence: 0.91,
        entities: {},
      },
      availableToolNames: ["query_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    });
    const serialized = serializeAssistantWorkflowToolSelectionDecision(selection);

    const evalCase = buildAssistantWorkflowEvalCaseFromSerializedToolSelectionDecision(serialized, {
      prompt: "Answer from docs.",
      tags: ["tool-selection"],
      source: { requestId: "req-selection" },
    });

    expect(evalCase).toMatchObject({
      source: {
        kind: "tool-selection",
        requestId: "req-selection",
        workflowId: "eval-case-agent",
        workflowVersion: 1,
      },
      expectations: {
        intent: "answer_docs",
        presentation: "text",
        planStepIds: ["retrieve_docs", "synthesize_answer"],
        tools: ["query_docs"],
        signalNames: ["workflow", "workflow_equivalent"],
      },
      notes: ["tool_selection_authority: workflow/workflow_equivalent"],
      metadata: {
        authoritySource: "workflow",
        authorityReason: "workflow_equivalent",
      },
    });
  });

  it("stringifies and parses eval cases", () => {
    const evalCase = buildAssistantWorkflowEvalCase({
      prompt: "Unsupported request.",
      expectations: { status: "not_handled", signalNames: ["run_not_handled"] },
    });

    const json = stringifyAssistantWorkflowEvalCase(evalCase, 2);
    const parsed = parseAssistantWorkflowEvalCase(JSON.parse(json));

    expect(parsed).toEqual(evalCase);
    expect(json).toContain('\n  "schemaVersion": 1');
  });

  it("writes and parses eval case lines with per-line errors", () => {
    const [completed, notHandled] = buildReportPair();
    const cases = [
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(serializeAssistantWorkflowRunReport(completed), {
        prompt: "Answer from docs.",
      }),
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(serializeAssistantWorkflowRunReport(notHandled), {
        prompt: "Unsupported request.",
      }),
    ];

    const lines = stringifyAssistantWorkflowEvalCaseLines(cases, { trailingNewline: true });
    const parsed = parseAssistantWorkflowEvalCaseLines([
      lines.trimEnd(),
      "{invalid",
      JSON.stringify({ schemaVersion: 1 }),
      "",
    ].join("\n"));

    expect(lines.endsWith("\n")).toBe(true);
    expect(parsed).toMatchObject({
      lineCount: 4,
      caseCount: 2,
      errorCount: 2,
      cases: [{
        expectations: { status: "completed" },
      }, {
        expectations: { status: "not_handled" },
      }],
      errors: [{
        lineNumber: 3,
        reason: "invalid_json",
      }, {
        lineNumber: 4,
        reason: "invalid_eval_case",
      }],
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
    id: "eval-case-agent",
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
