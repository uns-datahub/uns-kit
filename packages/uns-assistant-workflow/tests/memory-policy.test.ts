import { describe, expect, it } from "vitest";
import {
  applyAssistantWorkflowIntentMemoryPatches,
  buildAssistantWorkflowMemoryInjectionPlan,
  buildAssistantWorkflowMemoryInjectionTracePayload,
  buildAssistantWorkflowIntentMemoryPatchTracePayload,
  buildAssistantWorkflowMemoryPolicy,
  buildAssistantWorkflowMemoryPatch,
  defineAssistantWorkflow,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "memory-policy-test-agent",
  version: 1,
  intents: [{
    id: "chart",
    description: "Render a chart with remembered context.",
    memoryPolicy: {
      read: ["topic", "window", "artifact"],
      inject: ["topic", "window", "artifact", "missing_value"],
      write: ["artifact"],
    },
  }],
  memorySlots: [
    {
      id: "topic",
      description: "Current topic.",
      storage: "thread-profile",
      profileField: "topicOfInterest",
      maxChars: 12,
    },
    {
      id: "window",
      description: "Preferred time window.",
      storage: "thread-profile",
      profileField: "preferredTimeWindow",
      maxChars: 20,
    },
    {
      id: "artifact",
      description: "Recent artifact context.",
      storage: "thread-state",
      maxChars: 18,
    },
    {
      id: "missing_value",
      description: "Optional missing value.",
      storage: "turn",
    },
  ],
});

describe("assistant workflow memory policy", () => {
  it("builds bounded memory injection plans from a resolved policy and snapshot", () => {
    const policy = buildAssistantWorkflowMemoryPolicy(WORKFLOW, "chart");
    const plan = buildAssistantWorkflowMemoryInjectionPlan({
      workflow: WORKFLOW,
      policy,
      snapshot: {
        topic: "factory/line-1/temperature",
        window: "last hour",
        artifact: { id: "chart-1", kind: "chart", title: "Temperature" },
      },
      maxTotalChars: 32,
    });

    expect(plan.injectedSlots).toEqual(["topic", "window", "artifact"]);
    expect(plan.serializedValues).toEqual({
      topic: "factory/line",
      window: "last hour",
      artifact: "{\"id\":\"char",
    });
    expect(plan.totalChars).toBe(32);
    expect(plan.entries.map((entry) => ({
      slotId: entry.slotId,
      charCount: entry.charCount,
      truncated: entry.truncated,
      maxChars: entry.maxChars,
    }))).toEqual([
      { slotId: "topic", charCount: 12, truncated: true, maxChars: 12 },
      { slotId: "window", charCount: 9, truncated: false, maxChars: 20 },
      { slotId: "artifact", charCount: 11, truncated: true, maxChars: 11 },
    ]);
    expect(plan.missingSnapshotSlots).toEqual(["missing_value"]);
    expect(plan.skippedSlots).toEqual([
      { slotId: "missing_value", reason: "missing-value" },
    ]);
  });

  it("builds trace payloads without memory values", () => {
    const policy = buildAssistantWorkflowMemoryPolicy(WORKFLOW, "chart");
    const plan = buildAssistantWorkflowMemoryInjectionPlan({
      workflow: WORKFLOW,
      policy,
      snapshot: {
        topic: "factory/line-1/temperature",
      },
      maxTotalChars: 12,
    });

    expect(buildAssistantWorkflowMemoryInjectionTracePayload(plan)).toEqual({
      injectedSlots: ["topic"],
      missingSnapshotSlots: ["window", "artifact", "missing_value"],
      skippedSlots: [
        { slotId: "window", reason: "missing-value" },
        { slotId: "artifact", reason: "missing-value" },
        { slotId: "missing_value", reason: "missing-value" },
      ],
      totalChars: 12,
      entries: [{
        slotId: "topic",
        storage: "thread-profile",
        profileField: "topicOfInterest",
        charCount: 12,
        truncated: true,
        maxChars: 12,
      }],
    });
  });

  it("enforces the intent write policy before applying generic patches", () => {
    const result = applyAssistantWorkflowIntentMemoryPatches({
      workflow: WORKFLOW,
      intentId: "chart",
      snapshot: { topic: "old-topic" },
      patches: [
        buildAssistantWorkflowMemoryPatch("topic", "set", { value: "blocked-topic" }),
        buildAssistantWorkflowMemoryPatch("artifact", "append", { value: { id: "chart-1" } }),
        buildAssistantWorkflowMemoryPatch("unknown", "set", { value: "ignored" }),
      ],
    });

    expect(result.intentId).toBe("chart");
    expect(result.policy.writeSlots).toEqual(["artifact"]);
    expect(result.memoryResult.snapshot).toEqual({
      topic: "old-topic",
      artifact: [{ id: "chart-1" }],
    });
    expect(result.memoryResult.changedSlots).toEqual(["artifact"]);
    expect(result.memoryResult.skippedPatches).toEqual([
      { slotId: "topic", operation: "set", reason: "write-not-allowed" },
      { slotId: "unknown", operation: "set", reason: "unknown-slot" },
    ]);
    expect(buildAssistantWorkflowIntentMemoryPatchTracePayload(result)).toEqual({
      intentId: "chart",
      writeSlots: ["artifact"],
      missingMemorySlots: [],
      changedSlots: ["artifact"],
      appliedPatchCount: 1,
      skippedPatchCount: 2,
      appliedPatches: [{ slotId: "artifact", operation: "append", changed: true }],
      skippedPatches: [
        { slotId: "topic", operation: "set", reason: "write-not-allowed" },
        { slotId: "unknown", operation: "set", reason: "unknown-slot" },
      ],
    });
  });

  it("denies writes when the intent has no declared memory policy", () => {
    const result = applyAssistantWorkflowIntentMemoryPatches({
      workflow: WORKFLOW,
      intentId: "unknown-intent",
      patches: [
        buildAssistantWorkflowMemoryPatch("artifact", "append", { value: { id: "chart-1" } }),
      ],
    });

    expect(result.policy.writeSlots).toEqual([]);
    expect(result.memoryResult.snapshot).toEqual({});
    expect(result.memoryResult.skippedPatches).toEqual([
      { slotId: "artifact", operation: "append", reason: "write-not-allowed" },
    ]);
  });
});
