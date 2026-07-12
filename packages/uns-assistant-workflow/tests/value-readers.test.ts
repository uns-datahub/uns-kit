import { describe, expect, it } from "vitest";
import {
  readAssistantWorkflowBoolean,
  readAssistantWorkflowBooleanOrDefault,
  readAssistantWorkflowBooleanRecord,
  readAssistantWorkflowNestedArray,
  readAssistantWorkflowNestedString,
  readAssistantWorkflowNumber,
  readAssistantWorkflowNumberOrDefault,
  readAssistantWorkflowRecord,
  readAssistantWorkflowString,
  readAssistantWorkflowStringArray,
  readAssistantWorkflowStringOrDefault,
} from "../src/value-readers.js";

describe("assistant workflow value readers", () => {
  it("reads scalar values with explicit fallback behavior", () => {
    expect(readAssistantWorkflowRecord({ a: 1 })).toEqual({ a: 1 });
    expect(readAssistantWorkflowRecord(["a"])).toBeNull();
    expect(readAssistantWorkflowString("  value  ")).toBe("value");
    expect(readAssistantWorkflowString("  value  ", { trim: false })).toBe("  value  ");
    expect(readAssistantWorkflowString("", { trim: false, allowEmpty: true })).toBe("");
    expect(readAssistantWorkflowString("  ")).toBeNull();
    expect(readAssistantWorkflowStringOrDefault("  ", "fallback")).toBe("fallback");
    expect(readAssistantWorkflowNumber(3)).toBe(3);
    expect(readAssistantWorkflowNumber(Number.NaN)).toBeNull();
    expect(readAssistantWorkflowNumberOrDefault(Number.NaN, 7)).toBe(7);
    expect(readAssistantWorkflowBoolean(false)).toBe(false);
    expect(readAssistantWorkflowBooleanOrDefault("false", true)).toBe(true);
    expect(readAssistantWorkflowBooleanRecord({ a: true, b: false, c: "no" })).toEqual({ a: true, b: false });
  });

  it("reads string arrays with uniqueness and raw-preserving modes", () => {
    expect(readAssistantWorkflowStringArray([" a ", "a", "", "b", 1])).toEqual(["a", "b"]);
    expect(readAssistantWorkflowStringArray([" a ", "a", "", "b"], {
      trim: false,
      allowEmpty: true,
      unique: false,
      requireAllStrings: true,
    })).toEqual([" a ", "a", "", "b"]);
    expect(readAssistantWorkflowStringArray(["a", 1], { requireAllStrings: true })).toEqual([]);
  });

  it("reads nested values without throwing on missing path segments", () => {
    const value = {
      run: {
        decision: {
          intent: " value_lookup ",
        },
        steps: [{ id: "resolve_topic" }],
      },
    };
    expect(readAssistantWorkflowNestedString(value, ["run", "decision", "intent"])).toBe("value_lookup");
    expect(readAssistantWorkflowNestedString(value, ["run", "missing", "intent"])).toBeNull();
    expect(readAssistantWorkflowNestedArray(value, ["run", "steps"])).toEqual([{ id: "resolve_topic" }]);
    expect(readAssistantWorkflowNestedArray(value, ["run", "decision", "intent"])).toEqual([]);
  });
});
