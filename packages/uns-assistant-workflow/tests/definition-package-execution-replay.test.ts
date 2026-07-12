import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageExecutionReplayLinesTracePayload,
  executeAssistantWorkflowRunFromPackage,
  runAssistantWorkflowDefinitionPackageExecutionReplayLines,
  stringifyAssistantWorkflowDefinitionPackageExecutionResultLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package execution replay", () => {
  it("builds execution batches from serialized execution lines", async () => {
    const success = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ ok: true }),
      outcomeBuilder: () => assistantWorkflowFinalText("Done."),
    });
    const failure = await executeAssistantWorkflowRunFromPackage({ format: "other" }, {
      toolExecutor: () => ({ ok: true }),
    });

    const result = runAssistantWorkflowDefinitionPackageExecutionReplayLines({
      executionLines: stringifyAssistantWorkflowDefinitionPackageExecutionResultLines([success, failure]),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyInteresting: true,
    });

    expect(result).toMatchObject({
      executionParse: {
        lineCount: 2,
        executionCount: 2,
        errorCount: 0,
      },
      parseErrorCount: 0,
      batch: {
        schemaVersion: 1,
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceExecutionCount: 2,
        executionCount: 1,
        summary: {
          executionCount: 1,
          interestingExecutionCount: 1,
          statusCounts: [{
            key: "run_failed",
            count: 1,
          }],
        },
        executions: [{
          status: "run_failed",
        }],
      },
    });
  });

  it("keeps parse errors and summarizes valid execution lines", async () => {
    const success = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ ok: true }),
      outcomeBuilder: () => assistantWorkflowFinalText("Done."),
    });

    const result = runAssistantWorkflowDefinitionPackageExecutionReplayLines({
      executionLines: [
        stringifyAssistantWorkflowDefinitionPackageExecutionResultLines([success]),
        "{invalid",
        JSON.stringify({ schemaVersion: 1 }),
      ].join("\n"),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(result).toMatchObject({
      executionParse: {
        lineCount: 3,
        executionCount: 1,
        errorCount: 2,
        errors: [{
          lineNumber: 2,
          reason: "invalid_json",
        }, {
          lineNumber: 3,
          reason: "invalid_execution",
        }],
      },
      parseErrorCount: 2,
      batch: {
        sourceExecutionCount: 1,
        executionCount: 1,
        summary: {
          executedCount: 1,
          failedExecutionCount: 0,
          reportStatusCounts: [{
            key: "completed",
            count: 1,
          }],
        },
      },
    });
  });

  it("builds a compact replay trace payload", async () => {
    const failure = await executeAssistantWorkflowRunFromPackage({ format: "other" }, {
      toolExecutor: () => ({ ok: true }),
    });
    const result = runAssistantWorkflowDefinitionPackageExecutionReplayLines({
      executionLines: stringifyAssistantWorkflowDefinitionPackageExecutionResultLines([failure]),
    }, {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(buildAssistantWorkflowDefinitionPackageExecutionReplayLinesTracePayload(result)).toMatchObject({
      executionParse: {
        executionCount: 1,
        errorCount: 0,
      },
      parseErrorCount: 0,
      batch: {
        sourceExecutionCount: 1,
        executionCount: 1,
        summary: {
          failedExecutionCount: 1,
          statusCounts: [{
            key: "run_failed",
            count: 1,
          }],
        },
      },
    });
  });
});

function packageFor(definitions: readonly AssistantWorkflowDefinition[]) {
  return buildAssistantWorkflowDefinitionPackage(definitions, {
    generatedAt: "2026-06-29T10:00:00.000Z",
    packageId: "test-suite",
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
