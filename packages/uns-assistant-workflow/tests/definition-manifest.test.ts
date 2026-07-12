import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionManifest,
  buildAssistantWorkflowDefinitionManifestTracePayload,
  buildAssistantWorkflowSerializedDefinitionManifest,
  parseAssistantWorkflowDefinitionManifest,
  parseAssistantWorkflowDefinitionManifestLines,
  serializeAssistantWorkflowDefinition,
  stringifyAssistantWorkflowDefinitionManifest,
  stringifyAssistantWorkflowDefinitionManifestLines,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition manifest", () => {
  it("wraps a serialized definition as a stable artifact manifest", () => {
    const manifest = buildAssistantWorkflowDefinitionManifest(validWorkflow(), {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(manifest).toMatchObject({
      format: "assistant.workflow.definition",
      formatVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      workflowId: "manifest-agent",
      workflowVersion: 1,
      valid: true,
      serializedDefinition: {
        workflowId: "manifest-agent",
        workflowVersion: 1,
      },
    });
  });

  it("wraps an already serialized definition without re-shaping it", () => {
    const serialized = serializeAssistantWorkflowDefinition(validWorkflow());
    const manifest = buildAssistantWorkflowSerializedDefinitionManifest(serialized, {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(manifest.serializedDefinition).toBe(serialized);
    expect(manifest.valid).toBe(true);
  });

  it("stringifies, parses, and builds compact trace payloads", () => {
    const manifest = buildAssistantWorkflowDefinitionManifest(validWorkflow(), {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const json = stringifyAssistantWorkflowDefinitionManifest(validWorkflow(), 2, {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const parsed = parseAssistantWorkflowDefinitionManifest(JSON.parse(json));

    expect(parsed).toEqual(manifest);
    expect(json).toContain('\n  "format": "assistant.workflow.definition"');
    expect(buildAssistantWorkflowDefinitionManifestTracePayload(manifest)).toEqual({
      format: "assistant.workflow.definition",
      formatVersion: 1,
      generatedAt: "2026-06-29T10:00:00.000Z",
      workflowId: "manifest-agent",
      workflowVersion: 1,
      valid: true,
      serializedDefinition: {
        schemaVersion: 1,
        workflowId: "manifest-agent",
        workflowVersion: 1,
        summary: manifest.serializedDefinition.summary,
        diagnostics: [],
      },
    });
  });

  it("rejects malformed or inconsistent manifests", () => {
    const manifest = buildAssistantWorkflowDefinitionManifest(validWorkflow(), {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });

    expect(parseAssistantWorkflowDefinitionManifest(null)).toBeNull();
    expect(parseAssistantWorkflowDefinitionManifest({ format: "other" })).toBeNull();
    expect(parseAssistantWorkflowDefinitionManifest({
      ...manifest,
      workflowId: "different-agent",
    })).toBeNull();
    expect(parseAssistantWorkflowDefinitionManifest({
      ...manifest,
      valid: false,
    })).toBeNull();
  });

  it("writes and parses manifest lines", () => {
    const lines = stringifyAssistantWorkflowDefinitionManifestLines([
      validWorkflow(),
      { ...validWorkflow(), id: "manifest-agent-two" },
    ], {
      generatedAt: "2026-06-29T10:00:00.000Z",
      trailingNewline: true,
    });
    const parsed = parseAssistantWorkflowDefinitionManifestLines(lines);

    expect(lines.endsWith("\n")).toBe(true);
    expect(parsed).toMatchObject({
      lineCount: 2,
      manifestCount: 2,
      errorCount: 0,
      manifests: [{
        workflowId: "manifest-agent",
      }, {
        workflowId: "manifest-agent-two",
      }],
    });
  });

  it("keeps per-line parse errors for manifest lines", () => {
    const validLine = stringifyAssistantWorkflowDefinitionManifestLines([validWorkflow()], {
      generatedAt: "2026-06-29T10:00:00.000Z",
    });
    const parsed = parseAssistantWorkflowDefinitionManifestLines([
      validLine,
      "{invalid",
      JSON.stringify({ format: "assistant.workflow.definition", formatVersion: 1 }),
      "",
    ].join("\n"));

    expect(parsed).toMatchObject({
      lineCount: 3,
      manifestCount: 1,
      errorCount: 2,
      errors: [{
        lineNumber: 2,
        reason: "invalid_json",
      }, {
        lineNumber: 3,
        reason: "invalid_manifest",
      }],
    });
  });
});

function validWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "manifest-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
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
  };
}
