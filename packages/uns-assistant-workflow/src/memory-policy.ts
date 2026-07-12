import {
  findAssistantWorkflowIntent,
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowMemoryOperation,
  type AssistantWorkflowMemorySlotDefinition,
} from "./definition.js";
import {
  applyAssistantWorkflowMemoryPatches,
  buildAssistantWorkflowMemoryPatchTracePayload,
  type AssistantWorkflowMemoryPatch,
  type AssistantWorkflowMemoryPatchResult,
  type AssistantWorkflowMemorySnapshot,
  type AssistantWorkflowMemoryValue,
} from "./memory-updates.js";

export type AssistantWorkflowResolvedMemoryPolicy = {
  readSlots: string[];
  writeSlots: string[];
  injectSlots: string[];
  missingMemorySlots: string[];
  operationsBySlot: Record<string, AssistantWorkflowMemoryOperation[]>;
};

export type AssistantWorkflowMemoryInjectionEntry = {
  slotId: string;
  storage: string;
  profileField: string | null;
  value: AssistantWorkflowMemoryValue;
  serializedValue: string;
  charCount: number;
  truncated: boolean;
  maxChars: number | null;
};

export type AssistantWorkflowSkippedMemoryInjection = {
  slotId: string;
  reason: "missing-value" | "total-char-budget-exceeded";
};

export type AssistantWorkflowMemoryInjectionPlan = {
  entries: AssistantWorkflowMemoryInjectionEntry[];
  serializedValues: Record<string, string>;
  injectedSlots: string[];
  missingSnapshotSlots: string[];
  skippedSlots: AssistantWorkflowSkippedMemoryInjection[];
  totalChars: number;
};

export type AssistantWorkflowMemoryInjectionPlanInput = {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  policy: AssistantWorkflowResolvedMemoryPolicy;
  snapshot?: AssistantWorkflowMemorySnapshot | null;
  maxTotalChars?: number;
};

export type AssistantWorkflowIntentMemoryPatchInput = {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  intentId: unknown;
  snapshot?: AssistantWorkflowMemorySnapshot | null;
  patches: readonly AssistantWorkflowMemoryPatch[];
};

export type AssistantWorkflowIntentMemoryPatchResult = {
  intentId: string | null;
  policy: AssistantWorkflowResolvedMemoryPolicy;
  memoryResult: AssistantWorkflowMemoryPatchResult;
};

export function findAssistantWorkflowMemorySlot(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  slotId: unknown,
): AssistantWorkflowMemorySlotDefinition | null {
  const normalized = normalizeAssistantWorkflowId(slotId);
  if (!normalized) return null;
  return (workflow.memorySlots ?? []).find((slot) => slot.id === normalized) ?? null;
}

export function buildAssistantWorkflowMemoryPolicy(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
): AssistantWorkflowResolvedMemoryPolicy {
  const intent = findAssistantWorkflowIntent(workflow, intentId);
  const slotIds = new Set((workflow.memorySlots ?? []).map((slot) => slot.id));
  const readSlots = filterMemorySlotIds(intent?.memoryPolicy?.read ?? [], slotIds);
  const writeSlots = filterMemorySlotIds(intent?.memoryPolicy?.write ?? [], slotIds);
  const injectSlots = filterMemorySlotIds(intent?.memoryPolicy?.inject ?? [], slotIds);
  const missingMemorySlots = uniqueStrings([
    ...missingMemorySlotIds(intent?.memoryPolicy?.read ?? [], slotIds),
    ...missingMemorySlotIds(intent?.memoryPolicy?.write ?? [], slotIds),
    ...missingMemorySlotIds(intent?.memoryPolicy?.inject ?? [], slotIds),
  ]);

  return {
    readSlots,
    writeSlots,
    injectSlots,
    missingMemorySlots,
    operationsBySlot: buildOperationsBySlot({ readSlots, writeSlots, injectSlots }),
  };
}

export function buildAssistantWorkflowMemoryInjectionPlan(
  input: AssistantWorkflowMemoryInjectionPlanInput,
): AssistantWorkflowMemoryInjectionPlan {
  const snapshot = input.snapshot ?? {};
  const maxTotalChars = normalizePositiveInteger(input.maxTotalChars);
  const entries: AssistantWorkflowMemoryInjectionEntry[] = [];
  const serializedValues: Record<string, string> = {};
  const injectedSlots: string[] = [];
  const missingSnapshotSlots: string[] = [];
  const skippedSlots: AssistantWorkflowSkippedMemoryInjection[] = [];
  let totalChars = 0;

  for (const slotId of input.policy.injectSlots) {
    const slot = findAssistantWorkflowMemorySlot(input.workflow, slotId);
    if (!slot) continue;
    if (!Object.prototype.hasOwnProperty.call(snapshot, slotId)) {
      missingSnapshotSlots.push(slotId);
      skippedSlots.push({ slotId, reason: "missing-value" });
      continue;
    }
    const value = snapshot[slotId] as AssistantWorkflowMemoryValue;
    const serialized = serializeMemoryValue(value);
    const slotMaxChars = normalizePositiveInteger(slot.maxChars);
    const remainingTotalChars = maxTotalChars === null ? null : Math.max(0, maxTotalChars - totalChars);
    if (remainingTotalChars === 0) {
      skippedSlots.push({ slotId, reason: "total-char-budget-exceeded" });
      continue;
    }
    const effectiveMaxChars = minPositiveInteger(slotMaxChars, remainingTotalChars);
    const bounded = boundSerializedMemoryValue(serialized, effectiveMaxChars);
    entries.push({
      slotId,
      storage: slot.storage,
      profileField: slot.profileField ?? null,
      value,
      serializedValue: bounded.value,
      charCount: bounded.value.length,
      truncated: bounded.truncated,
      maxChars: effectiveMaxChars,
    });
    serializedValues[slotId] = bounded.value;
    injectedSlots.push(slotId);
    totalChars += bounded.value.length;
  }

  return {
    entries,
    serializedValues,
    injectedSlots,
    missingSnapshotSlots,
    skippedSlots,
    totalChars,
  };
}

export function buildAssistantWorkflowMemoryInjectionTracePayload(
  plan: AssistantWorkflowMemoryInjectionPlan,
): Record<string, unknown> {
  return {
    injectedSlots: plan.injectedSlots,
    missingSnapshotSlots: plan.missingSnapshotSlots,
    skippedSlots: plan.skippedSlots,
    totalChars: plan.totalChars,
    entries: plan.entries.map((entry) => ({
      slotId: entry.slotId,
      storage: entry.storage,
      profileField: entry.profileField,
      charCount: entry.charCount,
      truncated: entry.truncated,
      maxChars: entry.maxChars,
    })),
  };
}

export function applyAssistantWorkflowIntentMemoryPatches(
  input: AssistantWorkflowIntentMemoryPatchInput,
): AssistantWorkflowIntentMemoryPatchResult {
  const intentId = normalizeAssistantWorkflowId(input.intentId);
  const policy = buildAssistantWorkflowMemoryPolicy(input.workflow, intentId);
  const memoryResult = applyAssistantWorkflowMemoryPatches(
    input.snapshot,
    input.patches,
    input.workflow,
    { allowedSlotIds: policy.writeSlots },
  );
  return { intentId, policy, memoryResult };
}

export function buildAssistantWorkflowIntentMemoryPatchTracePayload(
  result: AssistantWorkflowIntentMemoryPatchResult,
): Record<string, unknown> {
  return {
    intentId: result.intentId,
    writeSlots: result.policy.writeSlots,
    missingMemorySlots: result.policy.missingMemorySlots,
    ...buildAssistantWorkflowMemoryPatchTracePayload(result.memoryResult),
  };
}

function filterMemorySlotIds(rawSlots: readonly string[], availableSlots: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawSlot of rawSlots) {
    const slot = normalizeAssistantWorkflowId(rawSlot);
    if (!slot || seen.has(slot)) continue;
    if (availableSlots.size > 0 && !availableSlots.has(slot)) continue;
    seen.add(slot);
    out.push(slot);
  }
  return out;
}

function serializeMemoryValue(value: AssistantWorkflowMemoryValue): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function boundSerializedMemoryValue(value: string, maxChars: number | null): { value: string; truncated: boolean } {
  if (maxChars === null || value.length <= maxChars) {
    return { value, truncated: false };
  }
  return { value: value.slice(0, maxChars), truncated: true };
}

function normalizePositiveInteger(value: number | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function minPositiveInteger(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function missingMemorySlotIds(rawSlots: readonly string[], availableSlots: ReadonlySet<string>): string[] {
  if (availableSlots.size === 0) return [];
  const out: string[] = [];
  for (const rawSlot of rawSlots) {
    const slot = normalizeAssistantWorkflowId(rawSlot);
    if (slot && !availableSlots.has(slot)) out.push(slot);
  }
  return uniqueStrings(out);
}

function buildOperationsBySlot(policy: {
  readSlots: readonly string[];
  writeSlots: readonly string[];
  injectSlots: readonly string[];
}): Record<string, AssistantWorkflowMemoryOperation[]> {
  const out: Record<string, AssistantWorkflowMemoryOperation[]> = {};
  for (const slot of policy.readSlots) addOperation(out, slot, "read");
  for (const slot of policy.writeSlots) addOperation(out, slot, "write");
  for (const slot of policy.injectSlots) addOperation(out, slot, "inject");
  return out;
}

function addOperation(
  target: Record<string, AssistantWorkflowMemoryOperation[]>,
  slot: string,
  operation: AssistantWorkflowMemoryOperation,
): void {
  const current = target[slot] ?? [];
  if (!current.includes(operation)) {
    target[slot] = [...current, operation];
  }
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
