import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunReport,
  buildAssistantWorkflowRunReportBatch,
  buildAssistantWorkflowRunReportBatchTracePayload,
  buildAssistantWorkflowPlanningProfileMigrationReport,
  buildAssistantWorkflowPlanningProfileMigrationReportTracePayload,
  buildAssistantWorkflowPlanningProfileMigrationReviewArtifact,
  buildAssistantWorkflowPlanningProfileMigrationReviewArtifactTracePayload,
  defineAssistantWorkflow,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowRunReportBatch,
  type AssistantWorkflowToolContextRequirement,
} from "../src/index.js";

describe("assistant workflow run report batch", () => {
  it("summarizes statuses, intents, outcomes, tool results, and signals", async () => {
    const reports = [
      await completedReport(),
      await failedReport(),
      notHandledReport(),
    ];

    const batch = buildAssistantWorkflowRunReportBatch(reports);

    expect(batch).toMatchObject({
      sourceReportCount: 3,
      rowCount: 3,
      interestingRowCount: 2,
      warningRowCount: 2,
      statusCounts: [
        { key: "completed", count: 1 },
        { key: "failed", count: 1 },
        { key: "not_handled", count: 1 },
      ],
      intentCounts: [{ key: "answer_docs", count: 3 }],
      outcomeCounts: [
        { key: "final_text", count: 2 },
        { key: "not_handled", count: 1 },
      ],
      toolResultStatusCounts: [
        { key: "complete", count: 1 },
        { key: "failed", count: 1 },
        { key: "none", count: 1 },
      ],
      toolProviderResultCounts: [
        { key: "http", count: 4 },
        { key: "mcp", count: 2 },
      ],
      activePlanningStepProfileCounts: [
        { key: "source_listing_context", count: 3 },
      ],
      profileStepCounts: [
        { key: "list_sources", count: 3 },
      ],
      signalCounts: [
        { name: "outcome_unhandled", severity: "warning", count: 1 },
        { name: "run_failed", severity: "warning", count: 1 },
        { name: "run_not_handled", severity: "warning", count: 1 },
        { name: "tool_execution_failed", severity: "warning", count: 1 },
      ],
    });
    expect(buildAssistantWorkflowRunReportBatchTracePayload(batch)).toMatchObject({
      sourceReportCount: 3,
      rowCount: 3,
      interestingRowCount: 2,
      warningRowCount: 2,
    });
  });

  it("can keep only interesting rows", async () => {
    const batch = buildAssistantWorkflowRunReportBatch(
      [
        await completedReport(),
        await failedReport(),
        notHandledReport(),
      ],
      { onlyInteresting: true },
    );

    expect(batch.sourceReportCount).toBe(3);
    expect(batch.rowCount).toBe(2);
    expect(batch.rows.map((row) => row.status)).toEqual(["failed", "not_handled"]);
  });

  it("builds a planning-profile migration report for ready runtime profiles", () => {
    const batch = runReportBatchRows([{
      activePlanningStepProfileIds: ["last_event_context"],
      profileStepIds: ["fetch_instance_journey"],
    }, {
      activePlanningStepProfileIds: ["last_event_context"],
      profileStepIds: ["fetch_instance_journey"],
    }]);

    const report = buildAssistantWorkflowPlanningProfileMigrationReport(batch, {
      currentRuntimeProfileIds: ["existing_context"],
      generatedAt: "2026-06-30T10:00:00.000Z",
      minRunCount: 2,
    });
    const artifact = buildAssistantWorkflowPlanningProfileMigrationReviewArtifact(report, {
      patchTargets: ["src/chat/assistant-workflow/default-workflow.ts"],
      requiredTestIds: ["pnpm -s typecheck"],
      title: "Planning profile cutover",
    });

    expect(report).toMatchObject({
      minRunCount: 2,
      observedProfileCount: 1,
      readyProfileIds: ["last_event_context"],
      reviewProfileIds: [],
      addProfileIds: ["last_event_context"],
      keepProfileIds: ["existing_context"],
      proposedRuntimeProfileIds: ["existing_context", "last_event_context"],
      readyCandidates: [{
        profileId: "last_event_context",
        runCount: 2,
        completedCount: 2,
        handledCount: 2,
        profileStepIds: ["fetch_instance_journey"],
        status: "ready_for_runtime_change",
        blockingReasons: [],
      }],
    });
    expect(buildAssistantWorkflowPlanningProfileMigrationReportTracePayload(report)).toMatchObject({
      addProfileIds: ["last_event_context"],
      proposedRuntimeProfileIds: ["existing_context", "last_event_context"],
    });
    expect(artifact).toMatchObject({
      title: "Planning profile cutover",
      status: "ready_for_runtime_change",
      recommendedAction: "apply_planning_profile_runtime_update",
      patchTargets: ["src/chat/assistant-workflow/default-workflow.ts"],
      requiredTestIds: ["pnpm -s typecheck"],
      runtimeChange: {
        addProfileIds: ["last_event_context"],
      },
      evidence: {
        readyProfileIds: ["last_event_context"],
      },
      review: {
        reviewProfileIds: [],
        blockerCount: 0,
      },
    });
    expect(buildAssistantWorkflowPlanningProfileMigrationReviewArtifactTracePayload(artifact)).toMatchObject({
      status: "ready_for_runtime_change",
      runtimeChange: {
        addProfileIds: ["last_event_context"],
      },
    });
  });

  it("keeps planning profiles in review when evidence is blocked", () => {
    const batch = runReportBatchRows([{
      activePlanningStepProfileIds: ["last_event_context"],
      profileStepIds: ["fetch_instance_journey"],
    }, {
      activePlanningStepProfileIds: ["last_event_context"],
      profileStepIds: ["fetch_instance_journey"],
      status: "failed",
      handled: false,
      warningCount: 2,
      signals: [{
        name: "run_degraded",
        severity: "warning",
        detail: "expected_artifact_missing",
      }, {
        name: "tool_execution_failed",
        severity: "warning",
        detail: "tool.call.error",
      }],
    }]);

    const report = buildAssistantWorkflowPlanningProfileMigrationReport(batch, {
      currentRuntimeProfileIds: ["last_event_context"],
      generatedAt: "2026-06-30T10:00:00.000Z",
      minRunCount: 2,
    });
    const artifact = buildAssistantWorkflowPlanningProfileMigrationReviewArtifact(report);

    expect(report).toMatchObject({
      readyProfileIds: [],
      reviewProfileIds: ["last_event_context"],
      addProfileIds: [],
      keepProfileIds: ["last_event_context"],
      proposedRuntimeProfileIds: ["last_event_context"],
      reviewCandidates: [{
        profileId: "last_event_context",
        runCount: 2,
        completedCount: 1,
        handledCount: 1,
        warningRowCount: 1,
        failedCount: 1,
        signalCounts: [
          { name: "run_degraded", severity: "warning", count: 1 },
          { name: "tool_execution_failed", severity: "warning", count: 1 },
        ],
        signalDetails: ["expected_artifact_missing", "tool.call.error"],
        status: "needs_review",
        blockingReasons: ["non_completed_runs:1", "unhandled_runs:1", "warning_rows:1"],
      }],
    });
    expect(artifact).toMatchObject({
      status: "no_runtime_change",
      recommendedAction: "keep_current_runtime",
      review: {
        reviewProfileIds: ["last_event_context"],
        blockerCount: 3,
      },
    });
  });
});

function runReportBatchRows(
  rows: Array<Partial<AssistantWorkflowRunReportBatch["rows"][number]>>,
): AssistantWorkflowRunReportBatch {
  const normalizedRows = rows.map((row) => ({
    workflowId: row.workflowId ?? "planning-profile-agent",
    workflowVersion: row.workflowVersion ?? 1,
    status: row.status ?? "completed",
    intent: row.intent ?? "chart_single",
    outcomeKind: row.outcomeKind ?? "final_text",
    handled: row.handled ?? true,
    toolResultStatus: row.toolResultStatus ?? "complete",
    toolResultProviders: row.toolResultProviders ?? [],
    activePlanningStepProfileIds: row.activePlanningStepProfileIds ?? [],
    profileStepIds: row.profileStepIds ?? [],
    directRouteDoneRoutes: row.directRouteDoneRoutes ?? [],
    directRouteRecoveredRoutes: row.directRouteRecoveredRoutes ?? [],
    directRouteErrorRoutes: row.directRouteErrorRoutes ?? [],
    directRouteSkipReasons: row.directRouteSkipReasons ?? [],
    directRouteGapReasons: row.directRouteGapReasons ?? [],
    directRouteObservedStrategies: row.directRouteObservedStrategies ?? [],
    directRouteUndeclaredStrategies: row.directRouteUndeclaredStrategies ?? [],
    memoryChangedSlots: row.memoryChangedSlots ?? [],
    memoryChangedProfileFields: row.memoryChangedProfileFields ?? [],
    memorySkippedPatchReasons: row.memorySkippedPatchReasons ?? [],
    threadProfileWriteSources: row.threadProfileWriteSources ?? [],
    threadProfileWriteReasons: row.threadProfileWriteReasons ?? [],
    threadProfileWriteChangedFields: row.threadProfileWriteChangedFields ?? [],
    signalCount: row.signalCount ?? 0,
    warningCount: row.warningCount ?? 0,
    signals: row.signals ?? [],
  }));

  return {
    generatedAt: "2026-06-30T10:00:00.000Z",
    sourceReportCount: normalizedRows.length,
    rowCount: normalizedRows.length,
    interestingRowCount: normalizedRows.filter((row) => row.status !== "completed" || row.warningCount > 0 || !row.handled)
      .length,
    warningRowCount: normalizedRows.filter((row) => row.warningCount > 0).length,
    statusCounts: [],
    intentCounts: [],
    outcomeCounts: [],
    toolResultStatusCounts: [],
    toolProviderResultCounts: [],
    activePlanningStepProfileCounts: [],
    profileStepCounts: [],
    directRouteDoneCounts: [],
    directRouteRecoveredCounts: [],
    directRouteErrorCounts: [],
    directRouteSkipReasonCounts: [],
    directRouteGapReasonCounts: [],
    directRouteObservedStrategyCounts: [],
    directRouteUndeclaredStrategyCounts: [],
    memoryChangedSlotCounts: [],
    memoryChangedProfileFieldCounts: [],
    memorySkippedPatchReasonCounts: [],
    threadProfileWriteSourceCounts: [],
    threadProfileWriteReasonCounts: [],
    threadProfileWriteChangedFieldCounts: [],
    signalCounts: [],
    rows: normalizedRows,
  };
}

async function completedReport() {
  const run = readyRun(["auth", "document-scope"]);
  const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
    run.toolInvocationQueue,
    (invocation) => ({ toolName: invocation.toolName }),
  );
  return buildAssistantWorkflowRunReport({
    run,
    toolExecution,
    outcome: assistantWorkflowFinalText("Done."),
  });
}

async function failedReport() {
  const run = readyRun(["auth", "document-scope"]);
  const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
    run.toolInvocationQueue,
    () => {
      throw new Error("tool failed");
    },
  );
  return buildAssistantWorkflowRunReport({
    run,
    toolExecution,
    outcome: assistantWorkflowFinalText("Fallback."),
  });
}

function notHandledReport() {
  return buildAssistantWorkflowRunReport({
    run: readyRun(["auth", "document-scope"]),
    outcome: assistantWorkflowNotHandled("no route"),
  });
}

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
    id: "run-report-batch-agent",
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
