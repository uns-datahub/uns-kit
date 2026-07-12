import { describe, expect, it } from "vitest";
import {
  isAssistantWorkflowErrorTraceStage,
  parseAssistantWorkflowTraceEvents,
  readAssistantWorkflowTraceBoolean,
  readAssistantWorkflowTraceBooleanRecord,
  readAssistantWorkflowTraceNumber,
  readAssistantWorkflowTracePayloadRecord,
  readAssistantWorkflowTraceString,
  readAssistantWorkflowTraceStringArray,
  readAssistantWorkflowTraceUserMessagePreview,
} from "../src/trace-events.js";

describe("assistant workflow trace events", () => {
  it("reads typed payload values without accepting invalid shapes", () => {
    expect(readAssistantWorkflowTracePayloadRecord({ a: 1 })).toEqual({ a: 1 });
    expect(readAssistantWorkflowTracePayloadRecord(["a"])).toBeNull();
    expect(readAssistantWorkflowTraceString("  value  ")).toBe("value");
    expect(readAssistantWorkflowTraceString("  ")).toBeNull();
    expect(readAssistantWorkflowTraceStringArray([" a ", "a", "", "b", 1])).toEqual(["a", "b"]);
    expect(readAssistantWorkflowTraceNumber(12)).toBe(12);
    expect(readAssistantWorkflowTraceNumber(Number.NaN)).toBeNull();
    expect(readAssistantWorkflowTraceBoolean(false)).toBe(false);
    expect(readAssistantWorkflowTraceBooleanRecord({ a: true, b: false, c: "no" })).toEqual({ a: true, b: false });
  });

  it("classifies error stages and extracts user-message previews", () => {
    expect(isAssistantWorkflowErrorTraceStage("tool.call.error")).toBe(true);
    expect(isAssistantWorkflowErrorTraceStage("direct.value.route.error")).toBe(true);
    expect(isAssistantWorkflowErrorTraceStage("tool.call")).toBe(false);
    expect(readAssistantWorkflowTraceUserMessagePreview("chat.request.start", {
      message: "  Show me latest values.  ",
    })).toBe("Show me latest values.");
    expect(readAssistantWorkflowTraceUserMessagePreview("schema_advisory.request", {
      key: "MaterialTemperature",
    })).toBe("MaterialTemperature");
    expect(readAssistantWorkflowTraceUserMessagePreview("user.message", {
      content: "1234567890",
    }, { limit: 6 })).toBe("123...");
    expect(readAssistantWorkflowTraceUserMessagePreview("user.message", {
      content: "1234567890",
    }, { limit: 6, omission: "..." })).toBe("123...");
  });

  it("parses raw trace event arrays into the stable trace event shape", () => {
    expect(parseAssistantWorkflowTraceEvents([
      { stage: " tool_selection.workflow_comparison ", timestamp: " 2026-07-11T10:00:00.000Z ", payload: { intent: "value_lookup" } },
      { stage: "assistant_workflow.memory_patch", payload: JSON.stringify({ changedSlots: ["topic_of_interest"] }) },
      { stage: "tool.call", payload: "ignored" },
      { payload: { missing: "stage" } },
      ["ignored"],
    ])).toEqual([
      {
        stage: "tool_selection.workflow_comparison",
        timestamp: "2026-07-11T10:00:00.000Z",
        payload: { intent: "value_lookup" },
      },
      {
        stage: "assistant_workflow.memory_patch",
        timestamp: null,
        payload: { changedSlots: ["topic_of_interest"] },
      },
      {
        stage: "tool.call",
        timestamp: null,
        payload: null,
      },
    ]);
    expect(parseAssistantWorkflowTraceEvents({ traceEvents: [] })).toEqual([]);
  });
});
