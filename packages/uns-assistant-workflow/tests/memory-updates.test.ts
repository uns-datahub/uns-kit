import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowMemoryPatches,
  buildAssistantWorkflowMemoryPatch,
  buildAssistantWorkflowMemoryPatchTracePayload,
  defineAssistantWorkflow,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "memory-test-agent",
  version: 1,
  intents: [{
    id: "answer",
    description: "Answer with remembered context.",
    memoryPolicy: {
      read: ["topic"],
      write: ["topic", "artifacts"],
    },
  }],
  memorySlots: [
    {
      id: "topic",
      description: "Current topic.",
      storage: "thread-state",
    },
    {
      id: "artifacts",
      description: "Recent artifacts.",
      storage: "thread-state",
      maxChars: 1000,
    },
  ],
});

describe("assistant workflow memory updates", () => {
  it("applies set, append, and clear patches to a generic memory snapshot", () => {
    const result = applyAssistantWorkflowMemoryPatches(
      { topic: "old-topic" },
      [
        buildAssistantWorkflowMemoryPatch("topic", "set", {
          value: "new-topic",
          source: "planner",
          reason: "high-confidence-topic",
        }),
        buildAssistantWorkflowMemoryPatch("artifacts", "append", {
          value: { id: "chart-1", kind: "chart" },
          source: "tool",
          maxItems: 2,
        }),
        buildAssistantWorkflowMemoryPatch("artifacts", "append", {
          value: { id: "table-1", kind: "table" },
          source: "tool",
          maxItems: 2,
        }),
        buildAssistantWorkflowMemoryPatch("topic", "clear", { source: "user" }),
      ],
      WORKFLOW,
    );

    expect(result.snapshot).toEqual({
      artifacts: [
        { id: "chart-1", kind: "chart" },
        { id: "table-1", kind: "table" },
      ],
    });
    expect(result.changedSlots).toEqual(["topic", "artifacts"]);
    expect(result.appliedPatches).toEqual([
      { slotId: "topic", operation: "set", changed: true },
      { slotId: "artifacts", operation: "append", changed: true },
      { slotId: "artifacts", operation: "append", changed: true },
      { slotId: "topic", operation: "clear", changed: true },
    ]);
    expect(result.skippedPatches).toEqual([]);
  });

  it("skips unknown slots and missing values when a workflow is provided", () => {
    const result = applyAssistantWorkflowMemoryPatches(
      {},
      [
        { slotId: "missing", operation: "set", value: "ignored" },
        { slotId: "topic", operation: "set" },
      ],
      WORKFLOW,
    );

    expect(result.snapshot).toEqual({});
    expect(result.appliedPatches).toEqual([]);
    expect(result.skippedPatches).toEqual([
      { slotId: "missing", operation: "set", reason: "unknown-slot" },
      { slotId: "topic", operation: "set", reason: "missing-value" },
    ]);
    expect(buildAssistantWorkflowMemoryPatchTracePayload(result)).toEqual({
      changedSlots: [],
      appliedPatchCount: 0,
      skippedPatchCount: 2,
      appliedPatches: [],
      skippedPatches: [
        { slotId: "missing", operation: "set", reason: "unknown-slot" },
        { slotId: "topic", operation: "set", reason: "missing-value" },
      ],
    });
  });

  it("can restrict writes to an explicit normalized slot allow-list", () => {
    const result = applyAssistantWorkflowMemoryPatches(
      { topic: "old-topic" },
      [
        buildAssistantWorkflowMemoryPatch("topic", "set", { value: "blocked-topic" }),
        buildAssistantWorkflowMemoryPatch("artifacts", "append", { value: "chart-1" }),
      ],
      WORKFLOW,
      { allowedSlotIds: [" artifacts "] },
    );

    expect(result.snapshot).toEqual({
      topic: "old-topic",
      artifacts: ["chart-1"],
    });
    expect(result.changedSlots).toEqual(["artifacts"]);
    expect(result.skippedPatches).toEqual([
      { slotId: "topic", operation: "set", reason: "write-not-allowed" },
    ]);
  });

  it("validates patch construction", () => {
    expect(() => buildAssistantWorkflowMemoryPatch(" ", "set", { value: "x" }))
      .toThrow("Assistant workflow memory patch slotId is required.");
    expect(() => buildAssistantWorkflowMemoryPatch("topic", "append"))
      .toThrow("Assistant workflow memory patch append requires a value.");
  });
});
