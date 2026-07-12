import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowEvalCase,
  buildAssistantWorkflowEvalCaseFromSerializedRunReport,
  buildAssistantWorkflowEvalRunTracePayload,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  defineAssistantWorkflow,
  runAssistantWorkflowEvalCases,
  runAssistantWorkflowEvalCasesAgainstSerializedRunReports,
  serializeAssistantWorkflowRunReport,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow eval runner", () => {
  it("evaluates eval cases against serialized reports by index", () => {
    const [completed, notHandled] = serializedReportPair();
    const cases = [
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(completed, {
        prompt: "Answer from docs.",
        required: true,
      }),
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(notHandled, {
        prompt: "Unsupported request.",
      }),
    ];

    const run = runAssistantWorkflowEvalCasesAgainstSerializedRunReports(cases, [completed, notHandled]);

    expect(run).toMatchObject({
      caseCount: 2,
      reportCount: 2,
      resultCount: 2,
      missingReportCount: 0,
      unmatchedReportCount: 0,
      missingReportCaseIds: [],
      suite: {
        passCount: 2,
        failCount: 0,
        requiredFailedCount: 0,
      },
      results: [{
        status: "pass",
      }, {
        status: "pass",
      }],
    });
  });

  it("turns missing reports into normal failed required results", () => {
    const evalCase = buildAssistantWorkflowEvalCase({
      prompt: "Answer from docs.",
      required: true,
      expectations: {
        intent: "answer_docs",
        tools: ["query_docs"],
      },
    });

    const run = runAssistantWorkflowEvalCases([{ evalCase, report: null }]);

    expect(run).toMatchObject({
      caseCount: 1,
      reportCount: 0,
      resultCount: 1,
      missingReportCount: 1,
      missingReportCaseIds: [evalCase.id],
      suite: {
        failCount: 1,
        requiredFailedCount: 1,
        requiredFailedCaseIds: [evalCase.id],
        failedCheckCounts: [
          { key: "intent", count: 1 },
          { key: "tools", count: 1 },
        ],
      },
      results: [{
        status: "fail",
        actual: {
          intent: null,
          tools: [],
        },
      }],
    });
  });

  it("reports extra serialized reports that have no eval case", () => {
    const [completed, notHandled] = serializedReportPair();
    const cases = [
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(completed, {
        prompt: "Answer from docs.",
      }),
    ];

    const run = runAssistantWorkflowEvalCasesAgainstSerializedRunReports(cases, [completed, notHandled]);

    expect(run).toMatchObject({
      caseCount: 1,
      reportCount: 2,
      resultCount: 1,
      unmatchedReportCount: 1,
      suite: {
        passCount: 1,
      },
    });
  });

  it("can focus suite output on failures while keeping all results", () => {
    const [completed] = serializedReportPair();
    const cases = [
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(completed, {
        prompt: "Answer from docs.",
      }),
      buildAssistantWorkflowEvalCase({
        prompt: "Missing report.",
        required: true,
        expectations: { status: "completed" },
      }),
    ];

    const run = runAssistantWorkflowEvalCasesAgainstSerializedRunReports(cases, [completed], {
      onlyFailures: true,
    });

    expect(run.resultCount).toBe(2);
    expect(run.results).toHaveLength(2);
    expect(run.suite).toMatchObject({
      sourceResultCount: 2,
      resultCount: 1,
      failCount: 1,
      requiredFailedCount: 1,
      rows: [{ caseId: cases[1]?.id }],
    });
  });

  it("builds a compact eval run trace payload", () => {
    const [completed] = serializedReportPair();
    const cases = [
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(completed, {
        prompt: "Answer from docs.",
      }),
    ];
    const run = runAssistantWorkflowEvalCasesAgainstSerializedRunReports(cases, [completed]);

    expect(buildAssistantWorkflowEvalRunTracePayload(run)).toMatchObject({
      caseCount: 1,
      reportCount: 1,
      resultCount: 1,
      missingReportCount: 0,
      suite: {
        passCount: 1,
      },
      results: [{
        status: "pass",
      }],
    });
  });
});

function serializedReportPair() {
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
    serializeAssistantWorkflowRunReport(buildAssistantWorkflowRunReport({
      run: completedRun,
      outcome: assistantWorkflowFinalText("Done."),
    })),
    serializeAssistantWorkflowRunReport(buildAssistantWorkflowRunReport({
      run: notHandledRun,
      outcome: assistantWorkflowNotHandled("unsupported intent"),
    })),
  ] as const;
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "eval-runner-agent",
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
