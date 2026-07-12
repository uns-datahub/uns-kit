import { ASSISTANT_WORKFLOW_TRACE_STAGE } from "./trace-stages.js";
import {
  readAssistantWorkflowBoolean,
  readAssistantWorkflowBooleanRecord,
  readAssistantWorkflowNumber,
  readAssistantWorkflowRecord,
  readAssistantWorkflowString,
  readAssistantWorkflowStringArray,
} from "./value-readers.js";

export {
  readAssistantWorkflowBoolean as readAssistantWorkflowTraceBoolean,
  readAssistantWorkflowBooleanRecord as readAssistantWorkflowTraceBooleanRecord,
  readAssistantWorkflowNumber as readAssistantWorkflowTraceNumber,
  readAssistantWorkflowRecord as readAssistantWorkflowTracePayloadRecord,
  readAssistantWorkflowString as readAssistantWorkflowTraceString,
  readAssistantWorkflowStringArray as readAssistantWorkflowTraceStringArray,
} from "./value-readers.js";

export type AssistantWorkflowTraceEvent = {
  stage: string;
  timestamp?: string | null;
  payload?: Record<string, unknown> | null;
};

export type AssistantWorkflowTraceUserMessagePreviewOptions = {
  limit?: number;
  omission?: string;
};

const ERROR_STAGE_EXACT = new Set<string>([
  ASSISTANT_WORKFLOW_TRACE_STAGE.responseGuardrailHit,
  ASSISTANT_WORKFLOW_TRACE_STAGE.toolGuardrailHit,
  ASSISTANT_WORKFLOW_TRACE_STAGE.toolCallError,
]);

const ERROR_STAGE_SUFFIXES = [".error", ".timeout.fallback", ".invalid"];

export function parseAssistantWorkflowTraceEvents(raw: unknown): AssistantWorkflowTraceEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantWorkflowTraceEvent[] = [];
  for (const entry of raw) {
    const record = readAssistantWorkflowRecord(entry);
    if (!record) continue;
    const stage = readAssistantWorkflowString(record["stage"]);
    if (!stage) continue;
    out.push({
      stage,
      timestamp: readAssistantWorkflowString(record["timestamp"]),
      payload: readTraceEventPayload(record["payload"]),
    });
  }
  return out;
}

function readTraceEventPayload(value: unknown): Record<string, unknown> | null {
  const record = readAssistantWorkflowRecord(value);
  if (record) return record;
  if (typeof value !== "string" || !value.trim().length) return null;
  try {
    return readAssistantWorkflowRecord(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export function readAssistantWorkflowTraceUserMessagePreview(
  stage: string,
  payload: Record<string, unknown>,
  options: AssistantWorkflowTraceUserMessagePreviewOptions = {},
): string | null {
  const candidate =
    stage === ASSISTANT_WORKFLOW_TRACE_STAGE.chatRequestStart || stage === ASSISTANT_WORKFLOW_TRACE_STAGE.userMessage
      ? readAssistantWorkflowString(payload["message"]) ?? readAssistantWorkflowString(payload["content"])
      : stage === ASSISTANT_WORKFLOW_TRACE_STAGE.schemaAdvisoryRequest
        ? readAssistantWorkflowString(payload["message"]) ??
          readAssistantWorkflowString(payload["prompt"]) ??
          readAssistantWorkflowString(payload["key"])
        : null;
  return candidate ? truncateTracePreview(candidate, options.limit, options.omission) : null;
}

export function isAssistantWorkflowErrorTraceStage(stage: string): boolean {
  if (ERROR_STAGE_EXACT.has(stage)) return true;
  return ERROR_STAGE_SUFFIXES.some((suffix) => stage.endsWith(suffix));
}

function truncateTracePreview(value: string, limit = 240, omission = "..."): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= limit) return trimmed;
  if (limit <= omission.length) return omission.slice(0, Math.max(limit, 0));
  return `${trimmed.slice(0, limit - omission.length)}${omission}`;
}
