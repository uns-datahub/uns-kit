import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionSummary,
  buildAssistantWorkflowDefinitionTracePayload,
  parseAssistantWorkflowSerializedDefinition,
  parseAssistantWorkflowSerializedDefinitionLines,
  serializeAssistantWorkflowDefinition,
  stringifyAssistantWorkflowDefinitionLines,
  stringifyAssistantWorkflowDefinition,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition JSON", () => {
  it("serializes a valid workflow definition with summary and diagnostics", () => {
    const serialized = serializeAssistantWorkflowDefinition(validWorkflow());

    expect(serialized).toMatchObject({
      schemaVersion: 1,
      workflowId: "definition-json-agent",
      workflowVersion: 1,
      summary: {
        workflowId: "definition-json-agent",
        workflowVersion: 1,
        valid: true,
        errorCount: 0,
        warningCount: 0,
        intentCount: 1,
        toolCapabilityCount: 1,
        toolBindingCount: 1,
        planningStepCount: 1,
        presentationCount: 1,
      },
      diagnostics: [],
      definition: {
        id: "definition-json-agent",
      },
    });
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });

  it("serializes invalid definitions without throwing", () => {
    const serialized = serializeAssistantWorkflowDefinition({
      id: "definition-json-agent",
      version: 1,
      intents: [{
        id: "answer_docs",
        description: "Answer docs.",
        requiredToolHints: ["missing_tool"],
      }],
      tools: [{
        name: "query_docs",
        provider: "mcp",
        effect: "read",
        sideEffectRisk: "low",
        cacheability: "request-scoped",
        retryClass: "bounded",
        outputKinds: ["evidence"],
      }],
      toolBindings: [{
        name: "orphan_tool",
        provider: "local-function",
        handlerId: "orphan.handler",
      }],
    });

    expect(serialized.summary).toMatchObject({
      valid: false,
      errorCount: 2,
      warningCount: 1,
      unboundToolNames: ["query_docs"],
      bindingWithoutCapabilityNames: ["orphan_tool"],
    });
    expect(serialized.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "binding_without_capability",
      "unbound_tool_capability",
      "unknown_tool_capability",
    ]);
  });

  it("stringifies, parses, and builds compact trace payloads", () => {
    const serialized = serializeAssistantWorkflowDefinition(validWorkflow());
    const json = stringifyAssistantWorkflowDefinition(validWorkflow(), 2);
    const parsed = parseAssistantWorkflowSerializedDefinition(JSON.parse(json));

    expect(parsed).toEqual(serialized);
    expect(json).toContain('\n  "schemaVersion": 1');
    expect(buildAssistantWorkflowDefinitionTracePayload(serialized)).toEqual({
      schemaVersion: 1,
      workflowId: "definition-json-agent",
      workflowVersion: 1,
      summary: serialized.summary,
      diagnostics: [],
    });
  });

  it("rejects values that are not serialized workflow definitions", () => {
    expect(parseAssistantWorkflowSerializedDefinition(null)).toBeNull();
    expect(parseAssistantWorkflowSerializedDefinition({ schemaVersion: 2 })).toBeNull();
    expect(parseAssistantWorkflowSerializedDefinition({
      schemaVersion: 1,
      workflowId: "agent",
      workflowVersion: 1,
      summary: {},
      diagnostics: [],
      definition: {},
    })).toBeNull();
  });

  it("writes and parses serialized definition lines", () => {
    const lines = stringifyAssistantWorkflowDefinitionLines([
      validWorkflow(),
      { ...validWorkflow(), id: "definition-json-agent-two" },
    ], { trailingNewline: true });
    const parsed = parseAssistantWorkflowSerializedDefinitionLines(lines);

    expect(lines.endsWith("\n")).toBe(true);
    expect(parsed).toMatchObject({
      lineCount: 2,
      definitionCount: 2,
      errorCount: 0,
      definitions: [{
        workflowId: "definition-json-agent",
      }, {
        workflowId: "definition-json-agent-two",
      }],
    });
  });

  it("keeps per-line parse errors for serialized definition lines", () => {
    const validLine = stringifyAssistantWorkflowDefinitionLines([validWorkflow()]);
    const parsed = parseAssistantWorkflowSerializedDefinitionLines([
      validLine,
      "{invalid",
      JSON.stringify({ schemaVersion: 1 }),
      "",
    ].join("\n"));

    expect(parsed).toMatchObject({
      lineCount: 3,
      definitionCount: 1,
      errorCount: 2,
      errors: [{
        lineNumber: 2,
        reason: "invalid_json",
      }, {
        lineNumber: 3,
        reason: "invalid_definition",
      }],
    });
  });

  it("builds summary from supplied diagnostics without revalidating", () => {
    const summary = buildAssistantWorkflowDefinitionSummary(validWorkflow(), [{
      severity: "warning",
      code: "unbound_tool_capability",
      path: "tools[0].name",
      message: "Assistant workflow tool capability query_docs has no binding.",
    }]);

    expect(summary).toMatchObject({
      valid: true,
      errorCount: 0,
      warningCount: 1,
      unboundToolNames: ["query_docs"],
    });
  });
});

function validWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "definition-json-agent",
    version: 1,
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
