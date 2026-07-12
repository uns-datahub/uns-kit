import { describe, expect, it } from "vitest";

import {
  buildAssistantWorkflowTraceEntry,
  findLatestAssistantWorkflowTracePayload,
  sanitizeAssistantWorkflowTracePayload,
  sanitizeAssistantWorkflowTraceValue,
  summarizeAssistantWorkflowToolArgsForTrace,
} from "../src/trace-payload.js";

describe("assistant workflow trace payload", () => {
  it("keeps scalar values while bounding long strings and nested collections", () => {
    expect(sanitizeAssistantWorkflowTraceValue(true)).toBe(true);
    expect(sanitizeAssistantWorkflowTraceValue("x".repeat(500))).toHaveLength(241);
    expect(sanitizeAssistantWorkflowTraceValue([1, 2, 3], 2)).toBe("array(3)");
    expect(sanitizeAssistantWorkflowTraceValue({ value: true }, 2)).toBe("object(1)");
  });

  it("bounds payload breadth without mutating the source object", () => {
    const source: Record<string, unknown> = {
      nested: { value: { deep: [1, 2, 3] } },
    };
    for (let index = 0; index < 40; index += 1) source[`key-${index}`] = index;

    const sanitized = sanitizeAssistantWorkflowTracePayload(source);

    expect(Object.keys(sanitized)).toHaveLength(24);
    expect(source["nested"]).toEqual({ value: { deep: [1, 2, 3] } });
  });

  it("redacts encrypted fields and caller-provided sensitive keys at every level", () => {
    const sanitized = sanitizeAssistantWorkflowTracePayload({
      encrypted_content: "secret",
      nested: { encryptedContent: "also-secret", token: "caller-secret" },
      token: "top-level-token",
    }, { redactedKeys: ["token"] });

    expect(sanitized["encrypted_content"]).toBe("[redacted]");
    expect(sanitized["token"]).toBe("[redacted]");
    expect(sanitized["nested"]).toEqual({
      encryptedContent: "[redacted]",
      token: "[redacted]",
    });
  });

  it("builds timestamped, sanitized trace entries", () => {
    expect(buildAssistantWorkflowTraceEntry(
      "tool.result",
      { encrypted_content: "secret" },
      "2026-07-11T12:00:00.000Z",
    )).toEqual({
      stage: "tool.result",
      timestamp: "2026-07-11T12:00:00.000Z",
      payload: { encrypted_content: "[redacted]" },
    });
  });

  it("summarizes tool argument sizes without retaining collection contents", () => {
    expect(summarizeAssistantWorkflowToolArgsForTrace({
      topic: "x".repeat(200),
      retries: 2,
      topics: ["a", "b"],
      filters: { source: "operator" },
    })).toEqual({
      topic: `${"x".repeat(160)}…`,
      retries: 2,
      topics: "array(2)",
      filters: "object(1)",
    });
  });

  it("returns the latest record payload for a requested trace stage", () => {
    const latest = { selected: "latest" };

    expect(findLatestAssistantWorkflowTracePayload([
      { stage: "context.selected", payload: { selected: "first" } },
      { stage: "other", payload: { ignored: true } },
      { stage: "context.selected", payload: latest },
    ], "context.selected")).toBe(latest);
    expect(findLatestAssistantWorkflowTracePayload([{ stage: "context.selected" }], "context.selected")).toBeNull();
  });
});
