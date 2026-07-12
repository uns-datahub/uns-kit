import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  buildAssistantWorkflowRunReportReplayLinesTracePayload,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  parseAssistantWorkflowSerializedRunReport,
  parseAssistantWorkflowSerializedRunReportBatch,
  parseAssistantWorkflowSerializedRunReportLines,
  runAssistantWorkflowRunReportReplayLines,
  serializeAssistantWorkflowRunReport,
  serializeAssistantWorkflowRunReports,
  serializeAssistantWorkflowSerializedRunReports,
  stringifyAssistantWorkflowRunReportLines,
  stringifyAssistantWorkflowRunReport,
  stringifyAssistantWorkflowRunReports,
  stringifyAssistantWorkflowSerializedRunReportLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow run report JSON", () => {
  it("serializes a run report into a compact JSON-safe payload", async () => {
    const run = buildAssistantWorkflowRun(defineAssistantWorkflow(baseWorkflow()), {
      classification: {
        intent: "answer_docs",
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });
    const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
      run.toolInvocationQueue,
      () => ({ rows: [{ secretRuntimeShape: true }] }),
      { now: fixedClock([100, 143]) },
    );
    const report = buildAssistantWorkflowRunReport({
      run,
      toolExecution,
      outcome: assistantWorkflowFinalText("Done.", "return"),
    });

    const serialized = serializeAssistantWorkflowRunReport(report);
    const json = JSON.stringify(serialized);

    expect(serialized).toMatchObject({
      schemaVersion: 1,
      workflowId: "run-report-json-agent",
      workflowVersion: 1,
      status: "completed",
      run: {
        status: "ready",
        toolInvocationQueue: {
          invocationCount: 1,
        },
      },
      toolExecution: {
        status: "complete",
        successCount: 1,
        results: [{
          invocationId: "retrieve_docs:query_docs",
          provider: "mcp",
          hasOutput: true,
          durationMs: 43,
        }],
      },
      outcome: {
        kind: "final_text",
        handled: true,
      },
      evaluation: {
        signalCount: 0,
      },
    });
    expect(json).not.toContain('"capability"');
    expect(json).not.toContain('"binding"');
    expect(json).not.toContain("secretRuntimeShape");
    expect(JSON.parse(json)).toEqual(serialized);
  });

  it("stringifies and parses serialized run report payloads", async () => {
    const run = buildAssistantWorkflowRun(defineAssistantWorkflow(baseWorkflow()), {
      classification: { intent: "answer_docs", confidence: 0.9, entities: {} },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });
    const report = buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowFinalText("Done."),
    });

    const json = stringifyAssistantWorkflowRunReport(report, 2);
    const parsed = parseAssistantWorkflowSerializedRunReport(JSON.parse(json));

    expect(parsed).toEqual(serializeAssistantWorkflowRunReport(report));
    expect(json).toContain('\n  "schemaVersion": 1');
  });

  it("rejects values that are not serialized run report payloads", () => {
    expect(parseAssistantWorkflowSerializedRunReport(null)).toBeNull();
    expect(parseAssistantWorkflowSerializedRunReport({ schemaVersion: 2 })).toBeNull();
    expect(parseAssistantWorkflowSerializedRunReport({
      schemaVersion: 1,
      workflowId: "agent",
      workflowVersion: 1,
      status: "completed",
      run: { invalid: Number.NaN },
      toolExecution: null,
      outcome: {},
      evaluation: {},
    })).toBeNull();
  });

  it("serializes report batches with an aggregate summary", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const completedRun = buildAssistantWorkflowRun(workflow, {
      classification: { intent: "answer_docs", confidence: 0.9, entities: {} },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });
    const notHandledRun = buildAssistantWorkflowRun(workflow, {
      classification: { intent: "unknown", confidence: 0.1, entities: {} },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });
    const completed = buildAssistantWorkflowRunReport({
      run: completedRun,
      outcome: assistantWorkflowFinalText("Done."),
    });
    const notHandled = buildAssistantWorkflowRunReport({
      run: notHandledRun,
      outcome: assistantWorkflowNotHandled("unsupported intent"),
    });

    const batch = serializeAssistantWorkflowRunReports([completed, notHandled], {
      onlyInteresting: true,
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const json = stringifyAssistantWorkflowRunReports([completed, notHandled], {
      onlyInteresting: true,
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(batch).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceReportCount: 2,
      reportCount: 1,
      summary: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceReportCount: 2,
        rowCount: 1,
        warningRowCount: 1,
      },
      reports: [{
        status: "not_handled",
        evaluation: {
          warningCount: 2,
        },
      }],
    });
    expect(parseAssistantWorkflowSerializedRunReportBatch(JSON.parse(json))).toEqual(batch);
  });

  it("keeps active planning profile ids in serialized reports and batch summaries", () => {
    const workflow = defineAssistantWorkflow(profileWorkflow());
    const run = buildAssistantWorkflowRun(workflow, {
      classification: {
        intent: "answer_docs",
        confidence: 0.9,
        presentation: "text",
        toolsToExpose: ["query_docs", "list_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      availableContext: ["document-scope", "auth"],
    });
    const report = buildAssistantWorkflowRunReport({
      run,
      outcome: assistantWorkflowFinalText("Done."),
    });

    const serialized = serializeAssistantWorkflowRunReport(report);
    const batch = serializeAssistantWorkflowRunReports([report], {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(serialized).toMatchObject({
      evaluation: {
        activePlanningStepProfileIds: ["source_listing_context"],
        profileStepIds: ["list_sources"],
      },
    });
    expect(batch).toMatchObject({
      summary: {
        activePlanningStepProfileCounts: [{ key: "source_listing_context", count: 1 }],
        profileStepCounts: [{ key: "list_sources", count: 1 }],
      },
      reports: [{
        evaluation: {
          activePlanningStepProfileIds: ["source_listing_context"],
          profileStepIds: ["list_sources"],
        },
      }],
    });
    expect(parseAssistantWorkflowSerializedRunReportBatch(JSON.parse(JSON.stringify(batch)))).toEqual(batch);
  });

  it("replays serialized run-report lines with planning-profile migration review", () => {
    const workflow = defineAssistantWorkflow(profileWorkflow());
    const reports = [profileReport(workflow), profileReport(workflow)];
    const lines = stringifyAssistantWorkflowRunReportLines(reports, {
      trailingNewline: true,
    });

    const result = runAssistantWorkflowRunReportReplayLines({
      reportLines: lines,
    }, {
      generatedAt: "2026-06-30T10:00:00.000Z",
      currentRuntimePlanningProfileIds: ["existing_context"],
      minPlanningProfileRunCount: 2,
      migrationReviewPatchTargets: ["src/chat/assistant-workflow/default-workflow.ts"],
      migrationReviewRequiredTestIds: ["pnpm -s typecheck"],
      migrationReviewTitle: "Planning profile replay",
    });

    expect(result).toMatchObject({
      reportParse: {
        lineCount: 2,
        reportCount: 2,
        errorCount: 0,
      },
      parseErrorCount: 0,
      batch: {
        schemaVersion: 1,
        generatedAt: "2026-06-30T10:00:00.000Z",
        sourceReportCount: 2,
        reportCount: 2,
        summary: {
          rowCount: 2,
          activePlanningStepProfileCounts: [{ key: "source_listing_context", count: 2 }],
          profileStepCounts: [{ key: "list_sources", count: 2 }],
        },
      },
      planningProfileMigration: {
        readyProfileIds: ["source_listing_context"],
        addProfileIds: ["source_listing_context"],
        keepProfileIds: ["existing_context"],
        proposedRuntimeProfileIds: ["existing_context", "source_listing_context"],
      },
      planningProfileMigrationReviewArtifact: {
        title: "Planning profile replay",
        status: "ready_for_runtime_change",
        recommendedAction: "apply_planning_profile_runtime_update",
        patchTargets: ["src/chat/assistant-workflow/default-workflow.ts"],
        requiredTestIds: ["pnpm -s typecheck"],
      },
    });
    expect(buildAssistantWorkflowRunReportReplayLinesTracePayload(result)).toMatchObject({
      reportParse: {
        reportCount: 2,
        errorCount: 0,
      },
      planningProfileMigration: {
        addProfileIds: ["source_listing_context"],
      },
      planningProfileMigrationReviewArtifact: {
        status: "ready_for_runtime_change",
      },
    });
  });

  it("serializes already serialized run reports into replay batches", () => {
    const serialized = serializeAssistantWorkflowRunReport(profileReport(defineAssistantWorkflow(profileWorkflow())));

    const batch = serializeAssistantWorkflowSerializedRunReports([serialized], {
      generatedAt: "2026-06-30T10:00:00.000Z",
    });

    expect(batch).toMatchObject({
      sourceReportCount: 1,
      reportCount: 1,
      summary: {
        activePlanningStepProfileCounts: [{ key: "source_listing_context", count: 1 }],
      },
      reports: [{
        evaluation: {
          activePlanningStepProfileIds: ["source_listing_context"],
        },
      }],
    });
  });

  it("rejects values that are not serialized run report batches", () => {
    expect(parseAssistantWorkflowSerializedRunReportBatch({ schemaVersion: 1 })).toBeNull();
    expect(parseAssistantWorkflowSerializedRunReportBatch({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceReportCount: 1,
      reportCount: 2,
      summary: {},
      reports: [],
    })).toBeNull();
  });

  it("writes and parses serialized run report lines", () => {
    const [completed, notHandled] = buildReportPair();

    const lines = stringifyAssistantWorkflowRunReportLines([completed, notHandled], {
      onlyInteresting: true,
      trailingNewline: true,
    });
    const serializedLines = stringifyAssistantWorkflowSerializedRunReportLines(
      [completed, notHandled].map(serializeAssistantWorkflowRunReport),
      { onlyInteresting: true, trailingNewline: true },
    );
    const parsed = parseAssistantWorkflowSerializedRunReportLines(lines);

    expect(lines.endsWith("\n")).toBe(true);
    expect(serializedLines).toBe(lines);
    expect(lines.trim().split("\n")).toHaveLength(1);
    expect(parsed).toMatchObject({
      lineCount: 1,
      reportCount: 1,
      errorCount: 0,
      reports: [{
        status: "not_handled",
      }],
      errors: [],
    });
  });

  it("keeps per-line parse errors for serialized report lines", () => {
    const [completed] = buildReportPair();
    const validLine = stringifyAssistantWorkflowRunReportLines([completed]);
    const parsed = parseAssistantWorkflowSerializedRunReportLines([
      validLine,
      "{invalid",
      JSON.stringify({ schemaVersion: 1 }),
      "",
    ].join("\n"));

    expect(parsed).toMatchObject({
      lineCount: 3,
      reportCount: 1,
      errorCount: 2,
      errors: [{
        lineNumber: 2,
        reason: "invalid_json",
      }, {
        lineNumber: 3,
        reason: "invalid_report",
      }],
    });
  });
});

function fixedClock(values: readonly number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "run-report-json-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      requiredToolHints: ["query_docs"],
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

function profileWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "run-report-json-profile-agent",
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

function buildReportPair() {
  const workflow = defineAssistantWorkflow(baseWorkflow());
  const completedRun = buildAssistantWorkflowRun(workflow, {
    classification: { intent: "answer_docs", confidence: 0.9, entities: {} },
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

function profileReport(workflow: ReturnType<typeof defineAssistantWorkflow>) {
  const run = buildAssistantWorkflowRun(workflow, {
    classification: {
      intent: "answer_docs",
      confidence: 0.9,
      presentation: "text",
      toolsToExpose: ["query_docs", "list_docs"],
      entities: {},
    },
    availableToolNames: ["query_docs", "list_docs"],
    availableContext: ["document-scope", "auth"],
  });
  return buildAssistantWorkflowRunReport({
    run,
    outcome: assistantWorkflowFinalText("Done."),
  });
}
