import {
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
} from "./definition.js";

export type AssistantWorkflowMemoryValue =
  | null
  | string
  | number
  | boolean
  | readonly AssistantWorkflowMemoryValue[]
  | { readonly [key: string]: AssistantWorkflowMemoryValue };

export type AssistantWorkflowMemorySnapshot = Record<string, AssistantWorkflowMemoryValue>;

export type AssistantWorkflowMemoryPatchOperation = "set" | "append" | "clear";

export type AssistantWorkflowMemoryPatchSource =
  | "planner"
  | "tool"
  | "runtime"
  | "user"
  | "system";

export type AssistantWorkflowMemoryPatch = {
  slotId: string;
  operation: AssistantWorkflowMemoryPatchOperation;
  value?: AssistantWorkflowMemoryValue;
  source?: AssistantWorkflowMemoryPatchSource;
  reason?: string;
  maxItems?: number;
};

export type AssistantWorkflowAppliedMemoryPatch = {
  slotId: string;
  operation: AssistantWorkflowMemoryPatchOperation;
  changed: boolean;
};

export type AssistantWorkflowSkippedMemoryPatchReason =
  | "invalid-slot"
  | "unknown-slot"
  | "missing-value"
  | "write-not-allowed";

export type AssistantWorkflowSkippedMemoryPatch = {
  slotId: string | null;
  operation: AssistantWorkflowMemoryPatchOperation | null;
  reason: AssistantWorkflowSkippedMemoryPatchReason;
};

export type AssistantWorkflowMemoryPatchResult = {
  snapshot: AssistantWorkflowMemorySnapshot;
  appliedPatches: AssistantWorkflowAppliedMemoryPatch[];
  skippedPatches: AssistantWorkflowSkippedMemoryPatch[];
  changedSlots: string[];
};

export type AssistantWorkflowMemoryPatchApplyOptions = {
  allowedSlotIds?: readonly string[] | null;
};

export function buildAssistantWorkflowMemoryPatch(
  slotId: string,
  operation: AssistantWorkflowMemoryPatchOperation,
  options: Omit<AssistantWorkflowMemoryPatch, "slotId" | "operation"> = {},
): AssistantWorkflowMemoryPatch {
  const normalizedSlotId = normalizeAssistantWorkflowId(slotId);
  if (!normalizedSlotId) {
    throw new Error("Assistant workflow memory patch slotId is required.");
  }
  if ((operation === "set" || operation === "append") && !("value" in options)) {
    throw new Error(`Assistant workflow memory patch ${operation} requires a value.`);
  }
  return {
    slotId: normalizedSlotId,
    operation,
    ...options,
  };
}

export function applyAssistantWorkflowMemoryPatches(
  snapshot: AssistantWorkflowMemorySnapshot | null | undefined,
  patches: readonly AssistantWorkflowMemoryPatch[],
  workflow?: AssistantWorkflowDefinition<string, string, string, string>,
  options: AssistantWorkflowMemoryPatchApplyOptions = {},
): AssistantWorkflowMemoryPatchResult {
  let next: AssistantWorkflowMemorySnapshot = { ...(snapshot ?? {}) };
  const appliedPatches: AssistantWorkflowAppliedMemoryPatch[] = [];
  const skippedPatches: AssistantWorkflowSkippedMemoryPatch[] = [];
  const changedSlots: string[] = [];
  const knownSlots = workflow ? new Set((workflow.memorySlots ?? []).map((slot) => slot.id)) : null;
  const allowedSlots = normalizeAllowedSlotIds(options.allowedSlotIds);

  for (const patch of patches) {
    const slotId = normalizeAssistantWorkflowId(patch.slotId);
    if (!slotId) {
      skippedPatches.push({
        slotId: null,
        operation: patch.operation ?? null,
        reason: "invalid-slot",
      });
      continue;
    }
    if (knownSlots && knownSlots.size > 0 && !knownSlots.has(slotId)) {
      skippedPatches.push({ slotId, operation: patch.operation, reason: "unknown-slot" });
      continue;
    }
    if (allowedSlots && !allowedSlots.has(slotId)) {
      skippedPatches.push({ slotId, operation: patch.operation, reason: "write-not-allowed" });
      continue;
    }
    if ((patch.operation === "set" || patch.operation === "append") && !("value" in patch)) {
      skippedPatches.push({ slotId, operation: patch.operation, reason: "missing-value" });
      continue;
    }

    const before = next[slotId];
    next = applyMemoryPatch(next, slotId, patch);
    const changed = !memoryValuesEqual(before, next[slotId]);
    appliedPatches.push({ slotId, operation: patch.operation, changed });
    if (changed && !changedSlots.includes(slotId)) {
      changedSlots.push(slotId);
    }
  }

  return {
    snapshot: next,
    appliedPatches,
    skippedPatches,
    changedSlots,
  };
}

export function buildAssistantWorkflowMemoryPatchTracePayload(
  result: AssistantWorkflowMemoryPatchResult,
): Record<string, unknown> {
  return {
    changedSlots: result.changedSlots,
    appliedPatchCount: result.appliedPatches.length,
    skippedPatchCount: result.skippedPatches.length,
    appliedPatches: result.appliedPatches,
    skippedPatches: result.skippedPatches,
  };
}

function applyMemoryPatch(
  snapshot: AssistantWorkflowMemorySnapshot,
  slotId: string,
  patch: AssistantWorkflowMemoryPatch,
): AssistantWorkflowMemorySnapshot {
  switch (patch.operation) {
    case "set":
      return { ...snapshot, [slotId]: patch.value as AssistantWorkflowMemoryValue };
    case "append":
      return {
        ...snapshot,
        [slotId]: appendMemoryValue(snapshot[slotId], patch.value as AssistantWorkflowMemoryValue, patch.maxItems),
      };
    case "clear": {
      const { [slotId]: _removed, ...rest } = snapshot;
      return rest;
    }
  }
}

function appendMemoryValue(
  existing: AssistantWorkflowMemoryValue | undefined,
  value: AssistantWorkflowMemoryValue,
  maxItems: number | undefined,
): AssistantWorkflowMemoryValue[] {
  const current = Array.isArray(existing)
    ? [...existing]
    : existing === undefined || existing === null
      ? []
      : [existing];
  const next = [...current, value];
  if (typeof maxItems === "number" && Number.isInteger(maxItems) && maxItems > 0) {
    return next.slice(-maxItems);
  }
  return next;
}

function memoryValuesEqual(
  left: AssistantWorkflowMemoryValue | undefined,
  right: AssistantWorkflowMemoryValue | undefined,
): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function normalizeAllowedSlotIds(value: readonly string[] | null | undefined): Set<string> | null {
  if (value === null || value === undefined) return null;
  const allowed = new Set<string>();
  for (const rawSlotId of value) {
    const slotId = normalizeAssistantWorkflowId(rawSlotId);
    if (slotId) allowed.add(slotId);
  }
  return allowed;
}
