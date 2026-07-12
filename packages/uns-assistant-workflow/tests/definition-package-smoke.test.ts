import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload,
  runAssistantWorkflowDefinitionPackageSmokeSuite,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package smoke suite", () => {
  it("runs package dry-run and fixture execution cases", async () => {
    const result = await runAssistantWorkflowDefinitionPackageSmokeSuite(packageFor([
      workflow("support-agent", 1),
    ]), {
      runCases: [{
        id: "ready-run",
        classification: { intent: "answer_docs" },
        availableToolNames: ["query_docs"],
        availableContext: ["document-scope"],
        expectedRunStatus: "ready",
      }],
      executionCases: [{
        id: "fixture-execution",
        classification: { intent: "answer_docs" },
        availableToolNames: ["query_docs"],
        availableContext: ["document-scope"],
        fixtures: {
          query_docs: { status: "success", output: { rows: 2 } },
        },
        outcome: assistantWorkflowFinalText("Done."),
        expectedExecutionStatus: "report_built",
        expectedReportStatus: "completed",
        expectedToolResultStatus: "complete",
      }],
    });

    expect(result).toMatchObject({
      summary: {
        caseCount: 2,
        runCaseCount: 1,
        executionCaseCount: 1,
        passCount: 2,
        failCount: 0,
        requiredFailCount: 0,
      },
      cases: [{
        id: "ready-run",
        kind: "run",
        passed: true,
      }, {
        id: "fixture-execution",
        kind: "execution",
        passed: true,
      }],
    });
  });

  it("counts required failures and exposes compact trace payloads", async () => {
    const result = await runAssistantWorkflowDefinitionPackageSmokeSuite(packageFor([
      workflow("support-agent", 1),
    ]), {
      runCases: [{
        id: "missing-context",
        classification: { intent: "answer_docs" },
        availableToolNames: ["query_docs"],
        availableContext: [],
        expectedRunStatus: "ready",
      }],
      executionCases: [{
        id: "tool-error",
        classification: { intent: "answer_docs" },
        availableToolNames: ["query_docs"],
        availableContext: ["document-scope"],
        fixtures: {
          query_docs: { status: "error", errorMessage: "docs offline" },
        },
        outcome: assistantWorkflowFinalText("Done."),
        expectedExecutionStatus: "report_built",
        expectedReportStatus: "failed",
        expectedToolResultStatus: "failed",
      }],
    });

    const payload = buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload(result);

    expect(result.summary).toMatchObject({
      caseCount: 2,
      passCount: 1,
      failCount: 1,
      requiredFailCount: 1,
      failedCaseIds: ["missing-context"],
      requiredFailedCaseIds: ["missing-context"],
    });
    expect(payload).toMatchObject({
      summary: {
        requiredFailCount: 1,
      },
      cases: [{
        id: "missing-context",
        passed: false,
        checks: [{
          id: "package_run_built",
          passed: true,
        }, {
          id: "run_status",
          expected: "ready",
          actual: "blocked",
          passed: false,
        }],
      }, {
        id: "tool-error",
        passed: true,
        execution: {
          executed: true,
          status: "report_built",
          toolExecution: {
            status: "failed",
            errorCount: 1,
          },
          report: {
            status: "failed",
          },
        },
      }],
    });
    expect(JSON.stringify(payload)).not.toContain("docs offline");
  });

  it("checks conditional planning profiles in package smoke cases", async () => {
    const result = await runAssistantWorkflowDefinitionPackageSmokeSuite(packageFor([
      profileWorkflow("support-agent", 1),
    ]), {
      runCases: [{
        id: "profile-run",
        classification: {
          intent: "answer_docs",
          presentation: "text",
          toolsToExpose: ["query_docs", "list_docs"],
        },
        availableToolNames: ["query_docs", "list_docs"],
        availableContext: ["document-scope", "auth"],
        expectedRunStatus: "ready",
        expectedActivePlanningStepProfileIds: ["source_listing_context"],
        expectedProfileStepIds: ["list_sources"],
      }],
      executionCases: [{
        id: "profile-execution",
        classification: {
          intent: "answer_docs",
          presentation: "text",
          toolsToExpose: ["query_docs", "list_docs"],
        },
        availableToolNames: ["query_docs", "list_docs"],
        availableContext: ["document-scope", "auth"],
        fixtures: {
          query_docs: { status: "success", output: { rows: 2 } },
          list_docs: { status: "success", output: { sources: ["manual"] } },
        },
        outcome: assistantWorkflowFinalText("Done."),
        expectedExecutionStatus: "report_built",
        expectedReportStatus: "completed",
        expectedToolResultStatus: "complete",
        expectedActivePlanningStepProfileIds: ["source_listing_context"],
        expectedProfileStepIds: ["list_sources"],
      }],
    });

    const payload = buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload(result);

    expect(result).toMatchObject({
      summary: {
        caseCount: 2,
        passCount: 2,
        failCount: 0,
      },
      cases: [{
        id: "profile-run",
        passed: true,
        checks: expect.arrayContaining([
          expect.objectContaining({
            id: "active_planning_step_profiles",
            expected: "source_listing_context",
            actual: "source_listing_context",
            passed: true,
          }),
          expect.objectContaining({
            id: "profile_steps",
            expected: "list_sources",
            actual: "list_sources",
            passed: true,
          }),
        ]),
      }, {
        id: "profile-execution",
        passed: true,
      }],
    });
    expect(payload).toMatchObject({
      cases: [{
        packageRun: {
          run: {
            activePlanningStepProfileIds: ["source_listing_context"],
            profileStepIds: ["list_sources"],
          },
        },
      }, {
        execution: {
          report: {
            activePlanningStepProfileIds: ["source_listing_context"],
            profileStepIds: ["list_sources"],
          },
        },
      }],
    });
  });
});

function packageFor(definitions: readonly AssistantWorkflowDefinition[]) {
  return buildAssistantWorkflowDefinitionPackage(definitions, {
    generatedAt: "2026-06-29T10:00:00.000Z",
    packageId: "smoke-suite",
  });
}

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
    }],
  };
}

function profileWorkflow(id: string, version: number): AssistantWorkflowDefinition {
  return {
    id,
    version,
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      planningSteps: ["retrieve_docs", "synthesize_answer"],
      planningStepProfiles: [{
        id: "source_listing_context",
        description: "List sources before synthesis.",
        condition: {
          presentation: "text",
          requiredTools: ["list_docs"],
        },
        planningSteps: ["list_sources"],
      }],
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
