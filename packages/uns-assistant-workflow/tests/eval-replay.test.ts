import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowEvalCase,
  buildAssistantWorkflowEvalCaseFromSerializedRunReport,
  buildAssistantWorkflowEvalReplayLinesTracePayload,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  defineAssistantWorkflow,
  runAssistantWorkflowEvalReplayLines,
  serializeAssistantWorkflowRunReport,
  stringifyAssistantWorkflowEvalCaseLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow eval replay", () => {
  it("runs eval cases against serialized report lines", () => {
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

    const result = runAssistantWorkflowEvalReplayLines({
      evalCaseLines: stringifyAssistantWorkflowEvalCaseLines(cases),
      reportLines: [completed, notHandled].map((report) => JSON.stringify(report)).join("\n"),
    });

    expect(result).toMatchObject({
      caseParse: {
        lineCount: 2,
        caseCount: 2,
        errorCount: 0,
      },
      reportParse: {
        lineCount: 2,
        reportCount: 2,
        errorCount: 0,
      },
      parseErrorCount: 0,
      run: {
        caseCount: 2,
        reportCount: 2,
        suite: {
          passCount: 2,
          failCount: 0,
        },
      },
    });
  });

  it("keeps parse errors and evaluates valid lines", () => {
    const [completed] = serializedReportPair();
    const validCase = buildAssistantWorkflowEvalCaseFromSerializedRunReport(completed, {
      prompt: "Answer from docs.",
    });
    const missingReportCase = buildAssistantWorkflowEvalCase({
      prompt: "Missing report.",
      required: true,
      expectations: { status: "completed" },
    });

    const result = runAssistantWorkflowEvalReplayLines({
      evalCaseLines: [
        stringifyAssistantWorkflowEvalCaseLines([validCase, missingReportCase]),
        "{invalid",
        JSON.stringify({ schemaVersion: 1 }),
      ].join("\n"),
      reportLines: [
        JSON.stringify(completed),
        "{invalid",
        JSON.stringify({ schemaVersion: 1 }),
      ].join("\n"),
    }, { onlyFailures: true });

    expect(result).toMatchObject({
      caseParse: {
        lineCount: 4,
        caseCount: 2,
        errorCount: 2,
      },
      reportParse: {
        lineCount: 3,
        reportCount: 1,
        errorCount: 2,
      },
      parseErrorCount: 4,
      run: {
        caseCount: 2,
        reportCount: 1,
        missingReportCount: 1,
        suite: {
          sourceResultCount: 2,
          resultCount: 1,
          failCount: 1,
          requiredFailedCaseIds: [missingReportCase.id],
        },
      },
    });
  });

  it("builds a compact replay trace payload", () => {
    const [completed] = serializedReportPair();
    const cases = [
      buildAssistantWorkflowEvalCaseFromSerializedRunReport(completed, {
        prompt: "Answer from docs.",
      }),
    ];
    const result = runAssistantWorkflowEvalReplayLines({
      evalCaseLines: stringifyAssistantWorkflowEvalCaseLines(cases),
      reportLines: JSON.stringify(completed),
    });

    expect(buildAssistantWorkflowEvalReplayLinesTracePayload(result)).toMatchObject({
      caseParse: {
        caseCount: 1,
        errorCount: 0,
      },
      reportParse: {
        reportCount: 1,
        errorCount: 0,
      },
      parseErrorCount: 0,
      run: {
        caseCount: 1,
        suite: {
          passCount: 1,
        },
      },
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
    id: "eval-replay-agent",
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
