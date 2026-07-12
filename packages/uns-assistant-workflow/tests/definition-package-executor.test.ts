import { describe, expect, it } from "vitest";
import {
  assistantWorkflowDegraded,
  assistantWorkflowFinalText,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageExecutionTracePayload,
  executeAssistantWorkflowRunFromPackage,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package executor", () => {
  it("accepts provider-specific executors without a custom queue callback", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolProviderExecutors: {
        mcp: (invocation, context) => ({
          server: invocation.binding.serverId,
          tool: invocation.binding.toolName,
          query: context.args["query"],
        }),
      },
      toolExecutionOptions: {
        argsByInvocationId: {
          "retrieve_docs:query_docs": { query: "manual" },
        },
      },
      outcome: assistantWorkflowFinalText("Done."),
    });

    expect(result).toMatchObject({
      executed: true,
      status: "report_built",
      toolExecution: {
        summary: { status: "complete", successCount: 1 },
        results: [{ output: { server: "docs", tool: "query", query: "manual" } }],
      },
    });
  });

  it("executes a package run and builds a completed report from an outcome builder", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: (invocation) => ({ toolName: invocation.toolName, rows: [1] }),
      outcomeBuilder: ({ toolExecution }) => assistantWorkflowFinalText(
        `tools=${toolExecution.summary.successCount}`,
        "return",
      ),
    });

    expect(result).toMatchObject({
      executed: true,
      status: "report_built",
      reason: null,
      toolExecution: {
        summary: {
          status: "complete",
          successCount: 1,
        },
      },
      report: {
        status: "completed",
        outcomeSummary: {
          kind: "final_text",
          contentChars: 7,
        },
      },
    });
  });

  it("uses an explicit outcome when supplied", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ ok: true }),
      outcome: assistantWorkflowDegraded("Partial.", "operator_requested_degraded"),
      outcomeBuilder: () => {
        throw new Error("should not run");
      },
    });

    expect(result).toMatchObject({
      executed: true,
      status: "report_built",
      report: {
        status: "degraded",
        outcomeSummary: {
          kind: "degraded",
          reason: "operator_requested_degraded",
        },
      },
    });
  });

  it("returns a failed report when tool execution fails with a non-degraded outcome", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => {
        throw new Error("docs unavailable");
      },
      outcomeBuilder: () => assistantWorkflowFinalText("Could not finish."),
    });

    expect(result).toMatchObject({
      executed: true,
      status: "report_built",
      toolExecution: {
        summary: {
          status: "failed",
          errorCount: 1,
        },
      },
      report: {
        status: "failed",
      },
    });
  });

  it("returns run_failed when package resolution fails", async () => {
    const result = await executeAssistantWorkflowRunFromPackage({ format: "other" }, {
      toolExecutor: () => ({ ok: true }),
    });

    expect(result).toMatchObject({
      executed: false,
      status: "run_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      toolExecution: null,
      report: null,
      packageRun: {
        status: "resolve_failed",
      },
    });
  });

  it("returns outcome_failed when the outcome builder throws", async () => {
    const result = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ ok: true }),
      outcomeBuilder: () => {
        throw "outcome failed";
      },
    });

    expect(result).toMatchObject({
      executed: false,
      status: "outcome_failed",
      reason: "outcome failed",
      toolExecution: {
        summary: {
          status: "complete",
        },
      },
      report: null,
    });
  });

  it("builds compact package execution trace payloads", async () => {
    const executed = await executeAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecutor: () => ({ ok: true }),
      outcomeBuilder: () => assistantWorkflowFinalText("Done."),
    });
    const failed = await executeAssistantWorkflowRunFromPackage({ format: "other" }, {
      toolExecutor: () => ({ ok: true }),
    });

    expect(buildAssistantWorkflowDefinitionPackageExecutionTracePayload(executed)).toMatchObject({
      executed: true,
      status: "report_built",
      reason: null,
      packageRun: {
        status: "run_built",
      },
      toolExecution: {
        status: "complete",
      },
      report: {
        status: "completed",
      },
    });
    expect(buildAssistantWorkflowDefinitionPackageExecutionTracePayload(failed)).toMatchObject({
      executed: false,
      status: "run_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      packageRun: {
        status: "resolve_failed",
      },
      toolExecution: null,
      report: null,
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
