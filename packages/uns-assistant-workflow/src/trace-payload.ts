import { readAssistantWorkflowRecord } from "./value-readers.js";

const DEFAULT_REDACTED_KEYS: ReadonlySet<string> = new Set([
  "encrypted_content",
  "encryptedContent",
]);

const TRACE_STRING_LIMIT = 240;
const TOOL_ARGUMENT_STRING_LIMIT = 160;
const TRACE_COLLAPSE_DEPTH = 2;
const TRACE_NUMERIC_ARRAY_LIMIT = 64;
const TRACE_ARRAY_LIMIT = 8;
const TRACE_OBJECT_ENTRY_LIMIT = 12;
const TRACE_PAYLOAD_ENTRY_LIMIT = 24;

export type AssistantWorkflowTraceEntry = {
  stage: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

export type AssistantWorkflowTraceEntryLike = {
  stage: string;
  payload?: unknown;
};

export type AssistantWorkflowTracePayloadSanitizerOptions = {
  /** Additional payload keys to redact alongside encrypted reasoning fields. */
  redactedKeys?: readonly string[];
};

type AssistantWorkflowTracePayloadSanitizerPolicy = {
  redactedKeys: ReadonlySet<string>;
};

function truncateTraceString(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
}

function buildSanitizerPolicy(
  options: AssistantWorkflowTracePayloadSanitizerOptions | undefined,
): AssistantWorkflowTracePayloadSanitizerPolicy {
  if (!options?.redactedKeys?.length) return { redactedKeys: DEFAULT_REDACTED_KEYS };
  return {
    redactedKeys: new Set([
      ...DEFAULT_REDACTED_KEYS,
      ...options.redactedKeys,
    ]),
  };
}

function sanitizeTraceValue(
  value: unknown,
  depth: number,
  policy: AssistantWorkflowTracePayloadSanitizerPolicy,
): unknown {
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return truncateTraceString(value, TRACE_STRING_LIMIT);
  if (depth >= TRACE_COLLAPSE_DEPTH) {
    if (Array.isArray(value)) return `array(${value.length})`;
    const record = readAssistantWorkflowRecord(value);
    if (record) return `object(${Object.keys(record).length})`;
    return typeof value;
  }
  if (Array.isArray(value)) {
    const allNumeric = value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
    const limit = allNumeric ? TRACE_NUMERIC_ARRAY_LIMIT : TRACE_ARRAY_LIMIT;
    return value.slice(0, limit).map((entry) => sanitizeTraceValue(entry, depth + 1, policy));
  }
  const record = readAssistantWorkflowRecord(value);
  if (record) {
    const nested: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(record).slice(0, TRACE_OBJECT_ENTRY_LIMIT)) {
      nested[key] = policy.redactedKeys.has(key)
        ? "[redacted]"
        : sanitizeTraceValue(nestedValue, depth + 1, policy);
    }
    return nested;
  }
  return typeof value;
}

/**
 * Projects arbitrary trace values onto a bounded JSON-serializable form. It
 * truncates strings, limits collection breadth, collapses deeply nested data,
 * and redacts encrypted reasoning fields before trace storage or transport.
 */
export function sanitizeAssistantWorkflowTraceValue(
  value: unknown,
  depth = 0,
  options?: AssistantWorkflowTracePayloadSanitizerOptions,
): unknown {
  return sanitizeTraceValue(value, depth, buildSanitizerPolicy(options));
}

export function sanitizeAssistantWorkflowTracePayload(
  payload: Record<string, unknown>,
  options?: AssistantWorkflowTracePayloadSanitizerOptions,
): Record<string, unknown> {
  const policy = buildSanitizerPolicy(options);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload).slice(0, TRACE_PAYLOAD_ENTRY_LIMIT)) {
    sanitized[key] = policy.redactedKeys.has(key)
      ? "[redacted]"
      : sanitizeTraceValue(value, 0, policy);
  }
  return sanitized;
}

export function buildAssistantWorkflowTraceEntry(
  stage: string,
  payload?: Record<string, unknown>,
  timestamp: Date | string = new Date(),
  options?: AssistantWorkflowTracePayloadSanitizerOptions,
): AssistantWorkflowTraceEntry {
  const sanitizedPayload = payload ? sanitizeAssistantWorkflowTracePayload(payload, options) : undefined;
  return {
    stage,
    timestamp: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
    ...(sanitizedPayload ? { payload: sanitizedPayload } : {}),
  };
}

export function summarizeAssistantWorkflowToolArgsForTrace(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") {
      summary[key] = truncateTraceString(value, TOOL_ARGUMENT_STRING_LIMIT);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      summary[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      summary[key] = `array(${value.length})`;
      continue;
    }
    const record = readAssistantWorkflowRecord(value);
    summary[key] = record ? `object(${Object.keys(record).length})` : typeof value;
  }
  return summary;
}

export function findLatestAssistantWorkflowTracePayload(
  traceEvents: readonly AssistantWorkflowTraceEntryLike[] | null | undefined,
  stage: string,
): Record<string, unknown> | null {
  for (let index = (traceEvents?.length ?? 0) - 1; index >= 0; index -= 1) {
    const entry = traceEvents?.[index];
    if (!entry || entry.stage !== stage) continue;
    const payload = readAssistantWorkflowRecord(entry.payload);
    if (payload) return payload;
  }
  return null;
}
