import { describe, expect, it } from "vitest";
import {
  assistantWorkflowFinalText,
  buildAssistantWorkflowDefinitionPackage,
  executeAssistantWorkflowRunFromPackage,
  parseAssistantWorkflowSerializedDefinitionPackageExecutionBatch,
  parseAssistantWorkflowSerializedDefinitionPackageExecution,
  parseAssistantWorkflowSerializedDefinitionPackageExecutionLines,
  serializeAssistantWorkflowDefinitionPackageExecutionResult,
  serializeAssistantWorkflowDefinitionPackageExecutionResults,
  stringifyAssistantWorkflowDefinitionPackageExecutionResult,
  stringifyAssistantWorkflowDefinitionPackageExecutionResultLines,
  stringifyAssistantWorkflowDefinitionPackageExecutionResults,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package execution JSON", () => {
  it("serializes package execution results without raw tool outputs", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ secretRuntimeShape: true }),
      outcomeBuilder: () => assistantWorkflowFinalText("Done.", "return"),
    });

    const serialized = serializeAssistantWorkflowDefinitionPackageExecutionResult(result);
    const json = JSON.stringify(serialized);

    expect(serialized).toMatchObject({
      schemaVersion: 1,
      executed: true,
      status: "report_built",
      reason: null,
      packageRun: {
        status: "run_built",
      },
      toolExecution: {
        status: "complete",
        successCount: 1,
        results: [{
          hasOutput: true,
        }],
      },
      report: {
        schemaVersion: 1,
        workflowId: "support-agent",
        status: "completed",
      },
    });
    expect(json).not.toContain("secretRuntimeShape");
  });

  it("stringifies and parses execution payloads", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ ok: true }),
      outcomeBuilder: () => assistantWorkflowFinalText("Done."),
    });

    const json = stringifyAssistantWorkflowDefinitionPackageExecutionResult(result, 2);
    const parsed = parseAssistantWorkflowSerializedDefinitionPackageExecution(JSON.parse(json));

    expect(parsed).toEqual(serializeAssistantWorkflowDefinitionPackageExecutionResult(result));
    expect(json).toContain('\n  "schemaVersion": 1');
  });

  it("serializes failed executions without report payloads", async () => {
    const result = await executeAssistantWorkflowRunFromPackage({ format: "other" }, {
      toolExecutor: () => ({ ok: true }),
    });

    const serialized = serializeAssistantWorkflowDefinitionPackageExecutionResult(result);

    expect(serialized).toMatchObject({
      schemaVersion: 1,
      executed: false,
      status: "run_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      toolExecution: null,
      report: null,
    });
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecution(serialized)).toEqual(serialized);
  });

  it("rejects values that are not serialized package executions", () => {
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecution(null)).toBeNull();
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecution({ schemaVersion: 2 })).toBeNull();
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecution({
      schemaVersion: 1,
      executed: true,
      status: "report_built",
      reason: null,
      packageRun: {},
      toolExecution: null,
      report: null,
    })).toBeNull();
  });

  it("writes and parses execution lines", async () => {
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

    const lines = stringifyAssistantWorkflowDefinitionPackageExecutionResultLines([success, failure], {
      trailingNewline: true,
    });
    const parsed = parseAssistantWorkflowSerializedDefinitionPackageExecutionLines([
      lines,
      "{invalid",
      JSON.stringify({ schemaVersion: 1 }),
    ].join("\n"));

    expect(lines.endsWith("\n")).toBe(true);
    expect(parsed).toMatchObject({
      lineCount: 4,
      executionCount: 2,
      errorCount: 2,
      executions: [{
        status: "report_built",
      }, {
        status: "run_failed",
      }],
      errors: [{
        lineNumber: 4,
        reason: "invalid_json",
      }, {
        lineNumber: 5,
        reason: "invalid_execution",
      }],
    });
  });

  it("serializes execution batches with aggregate summary and onlyInteresting filtering", async () => {
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

    const batch = serializeAssistantWorkflowDefinitionPackageExecutionResults([success, failure], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyInteresting: true,
    });
    const json = stringifyAssistantWorkflowDefinitionPackageExecutionResults([success, failure], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyInteresting: true,
    }, 2);

    expect(batch).toMatchObject({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceExecutionCount: 2,
      executionCount: 1,
      summary: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceExecutionCount: 2,
        executionCount: 1,
        interestingExecutionCount: 1,
        executedCount: 0,
        failedExecutionCount: 1,
        statusCounts: [{
          key: "run_failed",
          count: 1,
        }],
        reportStatusCounts: [{
          key: "none",
          count: 1,
        }],
      },
      executions: [{
        status: "run_failed",
      }],
    });
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecutionBatch(JSON.parse(json))).toEqual(batch);
  });

  it("rejects values that are not serialized execution batches", () => {
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecutionBatch({ schemaVersion: 1 })).toBeNull();
    expect(parseAssistantWorkflowSerializedDefinitionPackageExecutionBatch({
      schemaVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      sourceExecutionCount: 1,
      executionCount: 2,
      summary: {
        generatedAt: "2026-06-29T10:00:00.000Z",
        sourceExecutionCount: 1,
        executionCount: 2,
        interestingExecutionCount: 0,
        executedCount: 0,
        failedExecutionCount: 0,
        statusCounts: [],
        reportStatusCounts: [],
      },
      executions: [],
    })).toBeNull();
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
    presentations: [{
      id: "text",
      description: "Text response.",
    }],
  };
}
