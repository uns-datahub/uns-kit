import { describe, expect, it } from "vitest";
import {
  assistantWorkflowClarification,
  assistantWorkflowFinalText,
  buildAssistantWorkflowDefinitionPackage,
  buildAssistantWorkflowDefinitionPackageRunReportTracePayload,
  buildAssistantWorkflowRunFromPackage,
  buildAssistantWorkflowRunReportFromPackage,
  executeAssistantWorkflowToolInvocationQueue,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition package run report", () => {
  it("resolves a package run and builds a completed report", async () => {
    const packageRun = buildAssistantWorkflowRunFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });
    if (!packageRun.run) throw new Error("expected run");
    const toolExecution = await executeAssistantWorkflowToolInvocationQueue(
      packageRun.run.toolInvocationQueue,
      (invocation) => ({ toolName: invocation.toolName }),
    );

    const result = buildAssistantWorkflowRunReportFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      toolExecution,
      outcome: assistantWorkflowFinalText("Done.", "return"),
    });

    expect(result).toMatchObject({
      built: true,
      status: "report_built",
      reason: null,
      packageRun: {
        status: "run_built",
      },
      report: {
        workflowId: "support-agent",
        workflowVersion: 1,
        status: "completed",
        outcomeSummary: {
          kind: "final_text",
        },
      },
    });
  });

  it("defaults to not_handled when no outcome is supplied", () => {
    const result = buildAssistantWorkflowRunReportFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
    });

    expect(result).toMatchObject({
      built: true,
      status: "report_built",
      report: {
        status: "not_handled",
        outcomeSummary: {
          kind: "not_handled",
          reason: "package run did not produce an outcome",
        },
      },
    });
  });

  it("preserves explicit report status semantics", () => {
    const result = buildAssistantWorkflowRunReportFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      outcome: assistantWorkflowClarification("Which source?", "missing_source_scope"),
    });

    expect(result).toMatchObject({
      built: true,
      report: {
        status: "clarification",
        outcomeSummary: {
          kind: "clarification",
        },
      },
    });
  });

  it("returns run_failed when the package cannot build a run", () => {
    const result = buildAssistantWorkflowRunReportFromPackage({ format: "other" });

    expect(result).toMatchObject({
      built: false,
      status: "run_failed",
      report: null,
      reason: "Package JSON is not a valid assistant workflow definition package.",
      packageRun: {
        status: "resolve_failed",
      },
    });
  });

  it("builds compact package run report trace payloads", () => {
    const built = buildAssistantWorkflowRunReportFromPackage(packageFor([
      workflow("support-agent", 1),
    ]), {
      classification: { intent: "answer_docs" },
      availableToolNames: ["query_docs"],
      availableContext: ["document-scope"],
      outcome: assistantWorkflowFinalText("Done."),
    });
    const failed = buildAssistantWorkflowRunReportFromPackage({ format: "other" });

    expect(buildAssistantWorkflowDefinitionPackageRunReportTracePayload(built)).toMatchObject({
      built: true,
      status: "report_built",
      reason: null,
      packageRun: {
        status: "run_built",
      },
      report: {
        status: "completed",
      },
    });
    expect(buildAssistantWorkflowDefinitionPackageRunReportTracePayload(failed)).toMatchObject({
      built: false,
      status: "run_failed",
      reason: "Package JSON is not a valid assistant workflow definition package.",
      packageRun: {
        status: "resolve_failed",
      },
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
