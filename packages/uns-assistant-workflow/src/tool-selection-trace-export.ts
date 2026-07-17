import type { AssistantWorkflowJsonValue } from "./run-report-json.js";
import {
  readAssistantWorkflowTraceBoolean as readBoolean,
  readAssistantWorkflowTraceNumber as readNumber,
  readAssistantWorkflowTracePayloadRecord as readRecord,
  readAssistantWorkflowTraceString as readString,
  readAssistantWorkflowTraceStringArray as readStringArray,
  readAssistantWorkflowTraceUserMessagePreview,
  type AssistantWorkflowTraceEvent,
} from "./trace-events.js";
import { ASSISTANT_WORKFLOW_TRACE_STAGE } from "./trace-stages.js";
import type {
  AssistantWorkflowDefinition,
  AssistantWorkflowToolContextRequirement,
} from "./definition.js";
import {
  buildAssistantWorkflowToolSelectionDecision,
} from "./tool-selection-policy.js";
import {
  buildAssistantWorkflowEvalCaseFromSerializedToolSelectionDecision,
  type AssistantWorkflowEvalCase,
  type AssistantWorkflowToolSelectionEvalCaseOptions,
} from "./eval-case.js";
import {
  parseAssistantWorkflowSerializedToolSelectionDecision,
  serializeAssistantWorkflowToolSelectionDecision,
  type AssistantWorkflowSerializedToolSelectionDecision,
} from "./tool-selection-json.js";

export type AssistantWorkflowToolSelectionTraceExportResult = {
  traceEventCount: number;
  candidateEventCount: number;
  decisionCount: number;
  skippedCandidateEventCount: number;
  decisions: AssistantWorkflowSerializedToolSelectionDecision[];
};

export type AssistantWorkflowToolSelectionTraceEvalCaseOptions =
  Omit<AssistantWorkflowToolSelectionEvalCaseOptions, "prompt"> & {
    prompt?: string | null;
  };

export type AssistantWorkflowToolSelectionTraceEvalCaseExportResult =
  AssistantWorkflowToolSelectionTraceExportResult & {
    prompt: string | null;
    evalCaseCount: number;
    missingPromptCount: number;
    cases: AssistantWorkflowEvalCase[];
  };

export type AssistantWorkflowToolSelectionTraceCurrentReplayOptions = {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  availableToolNames?: readonly string[] | null;
  availableContext?: readonly AssistantWorkflowToolContextRequirement[] | null;
  workflowAuthorityIntentIds?: readonly string[] | null;
  workflowAuthoritySegmentKeys?: readonly string[] | null;
  includeWorkflowToolCapabilities?: boolean;
};

export function buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent(
  event: AssistantWorkflowTraceEvent,
): AssistantWorkflowSerializedToolSelectionDecision | null {
  if (event.stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.toolSelectionWorkflowComparison) return null;
  const payload = readRecord(event.payload);
  if (!payload) return null;
  const authority = readRecord(payload["authority"]);
  const inferredWorkflowAuthorityReason = authority
    ? null
    : inferWorkflowAuthorityReason(payload);
  const selectedToolNames = authority
    ? readStringArray(authority["selectedToolNames"])
    : inferredWorkflowAuthorityReason
      ? inferWorkflowAuthoritySelectedToolNames(payload)
    : inferSelectedToolNames(payload);
  const workflowSuggestedToolNames = authority
    ? readStringArray(authority["workflowSuggestedToolNames"])
    : readStringArray(payload["workflowSuggestedTools"]);
  const comparisonPayload = toJsonRecordOrNull(payload);
  if (!comparisonPayload) return null;

  return parseAssistantWorkflowSerializedToolSelectionDecision({
    schemaVersion: 1,
    authority: {
      source: authority?.["source"] ?? (inferredWorkflowAuthorityReason ? "workflow" : "legacy-pruner"),
      reason: authority?.["reason"] ?? inferredWorkflowAuthorityReason ??
        inferLegacyAuthorityReason(payload, selectedToolNames),
      selectedToolNames,
      workflowSuggestedToolNames: workflowSuggestedToolNames.length
        ? workflowSuggestedToolNames
        : readStringArray(payload["workflowSuggestedTools"]),
      workflowStatus: typeof authority?.["workflowStatus"] === "string"
        ? authority["workflowStatus"]
        : readWorkflowStatus(payload),
    },
    effectiveToolNames: readStringArray(payload["effectiveToolNames"]).length
      ? readStringArray(payload["effectiveToolNames"])
      : selectedToolNames,
    effectiveReason: typeof payload["selectedReason"] === "string" ? payload["selectedReason"] : null,
    comparisonPayload,
  });
}

export function buildAssistantWorkflowSerializedToolSelectionDecisionsFromTraceEvents(
  events: readonly AssistantWorkflowTraceEvent[],
): AssistantWorkflowToolSelectionTraceExportResult {
  const decisions: AssistantWorkflowSerializedToolSelectionDecision[] = [];
  let candidateEventCount = 0;
  let skippedCandidateEventCount = 0;

  for (const event of events) {
    if (event.stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.toolSelectionWorkflowComparison) continue;
    candidateEventCount += 1;
    const decision = buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent(event);
    if (decision) {
      decisions.push(decision);
    } else {
      skippedCandidateEventCount += 1;
    }
  }

  return {
    traceEventCount: events.length,
    candidateEventCount,
    decisionCount: decisions.length,
    skippedCandidateEventCount,
    decisions,
  };
}

export function buildAssistantWorkflowCurrentSerializedToolSelectionDecisionsFromTraceEvents(
  events: readonly AssistantWorkflowTraceEvent[],
  options: AssistantWorkflowToolSelectionTraceCurrentReplayOptions,
): AssistantWorkflowToolSelectionTraceExportResult {
  const decisions: AssistantWorkflowSerializedToolSelectionDecision[] = [];
  let candidateEventCount = 0;
  let skippedCandidateEventCount = 0;
  let latestClassifierPayload: Record<string, unknown> | null = null;

  for (const event of events) {
    if (event.stage === ASSISTANT_WORKFLOW_TRACE_STAGE.plannerClassifierDone) {
      latestClassifierPayload = readRecord(event.payload);
      continue;
    }
    if (event.stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.toolSelectionWorkflowComparison) continue;

    candidateEventCount += 1;
    const decision = buildAssistantWorkflowCurrentSerializedToolSelectionDecisionFromTraceEvent(
      event,
      latestClassifierPayload,
      options,
    );
    if (decision) {
      decisions.push(decision);
    } else {
      skippedCandidateEventCount += 1;
    }
  }

  return {
    traceEventCount: events.length,
    candidateEventCount,
    decisionCount: decisions.length,
    skippedCandidateEventCount,
    decisions,
  };
}

export function buildAssistantWorkflowCurrentSerializedToolSelectionDecisionFromTraceEvent(
  event: AssistantWorkflowTraceEvent,
  classifierPayload: Record<string, unknown> | null,
  options: AssistantWorkflowToolSelectionTraceCurrentReplayOptions,
): AssistantWorkflowSerializedToolSelectionDecision | null {
  const payload = readRecord(event.payload);
  if (!payload) return null;
  const historicalDecision = buildAssistantWorkflowSerializedToolSelectionDecisionFromTraceEvent(event);
  if (!historicalDecision) return null;
  const selectedToolNames = historicalDecision.authority.selectedToolNames;
  const availableToolNames = buildCurrentReplayAvailableToolNames(
    options,
    selectedToolNames,
    historicalDecision.authority.workflowSuggestedToolNames,
    payload,
    classifierPayload,
  );
  const currentDecision = buildAssistantWorkflowToolSelectionDecision({
    workflow: options.workflow,
    classification: {
      intent: readString(classifierPayload?.["intent"]) ?? readString(payload["intent"]),
      presentation:
        readString(classifierPayload?.["presentation"]) ??
        readString(payload["effectivePresentation"]) ??
        readString(payload["defaultPresentation"]),
      toolsToExpose: firstNonEmptyStringArray(
        classifierPayload?.["tools"],
        classifierPayload?.["toolsToExpose"],
        payload["classifierTools"],
      ),
      ...(typeof classifierPayload?.["confidence"] === "number"
        ? { confidence: classifierPayload["confidence"] }
        : {}),
      ...(readString(classifierPayload?.["timeWindowHint"])
        ? { timeWindowHint: readString(classifierPayload?.["timeWindowHint"]) }
        : {}),
      entities: {
        containers: firstNonEmptyStringArray(classifierPayload?.["containers"], payload["containers"]),
        attributes: firstNonEmptyStringArray(classifierPayload?.["attributes"], payload["attributes"]),
        fullTopicPaths: firstNonEmptyStringArray(classifierPayload?.["fullTopicPaths"], payload["fullTopicPaths"]),
      },
    },
    availableToolNames,
    selectedToolNames,
    selectedMode: readString(payload["selectedMode"]),
    selectedReason: readString(payload["selectedReason"]),
    hop: readNumber(payload["hop"]),
    pruningEnabled: readBoolean(payload["pruningEnabled"]),
    availableContext: options.availableContext ?? null,
    workflowAuthorityIntentIds: options.workflowAuthorityIntentIds ?? null,
    workflowAuthoritySegmentKeys: options.workflowAuthoritySegmentKeys ?? null,
  });

  return serializeAssistantWorkflowToolSelectionDecision(currentDecision);
}

export function buildAssistantWorkflowToolSelectionEvalCasesFromTraceEvents(
  events: readonly AssistantWorkflowTraceEvent[],
  options: AssistantWorkflowToolSelectionTraceEvalCaseOptions = {},
): AssistantWorkflowToolSelectionTraceEvalCaseExportResult {
  const exportResult = buildAssistantWorkflowSerializedToolSelectionDecisionsFromTraceEvents(events);
  const prompt = normalizeOptionalString(options.prompt) ?? readPromptPreview(events);
  const cases = prompt
    ? exportResult.decisions.map((decision, index) =>
        buildAssistantWorkflowEvalCaseFromSerializedToolSelectionDecision(decision, {
          prompt,
          ...(options.id !== undefined && exportResult.decisions.length === 1 ? { id: options.id } : {}),
          ...(options.required !== undefined ? { required: options.required } : {}),
          ...(options.tags !== undefined ? { tags: options.tags } : {}),
          ...(options.source !== undefined ? { source: options.source } : {}),
          ...(options.notes !== undefined ? { notes: options.notes } : {}),
          metadata: {
            ...(options.metadata ?? {}),
            traceDecisionIndex: index,
          },
        })
      )
    : [];

  return {
    ...exportResult,
    prompt,
    evalCaseCount: cases.length,
    missingPromptCount: prompt ? 0 : exportResult.decisionCount,
    cases,
  };
}

export function buildAssistantWorkflowToolSelectionTraceExportPayload(
  result: AssistantWorkflowToolSelectionTraceExportResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    traceEventCount: result.traceEventCount,
    candidateEventCount: result.candidateEventCount,
    decisionCount: result.decisionCount,
    skippedCandidateEventCount: result.skippedCandidateEventCount,
  };
}

export function buildAssistantWorkflowToolSelectionTraceEvalCaseExportPayload(
  result: AssistantWorkflowToolSelectionTraceEvalCaseExportResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    ...buildAssistantWorkflowToolSelectionTraceExportPayload(result),
    prompt: result.prompt,
    evalCaseCount: result.evalCaseCount,
    missingPromptCount: result.missingPromptCount,
  };
}

function firstNonEmptyStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    const strings = readStringArray(value);
    if (strings.length > 0) return strings;
  }
  return [];
}

function buildCurrentReplayAvailableToolNames(
  options: AssistantWorkflowToolSelectionTraceCurrentReplayOptions,
  selectedToolNames: readonly string[],
  workflowSuggestedToolNames: readonly string[],
  payload: Record<string, unknown>,
  classifierPayload: Record<string, unknown> | null,
): string[] {
  if (options.availableToolNames !== undefined && options.availableToolNames !== null) {
    return uniqueStrings(readStringArray(options.availableToolNames));
  }
  return uniqueStrings([
    ...selectedToolNames,
    ...workflowSuggestedToolNames,
    ...(options.includeWorkflowToolCapabilities === false
      ? []
      : (options.workflow.tools ?? []).map((tool) => tool.name)),
    ...readStringArray(payload["workflowSuggestedTools"]),
    ...readStringArray(payload["toolHints"]),
    ...readStringArray(payload["requiredToolHints"]),
    ...readStringArray(payload["classifierTools"]),
    ...readStringArray(classifierPayload?.["tools"]),
    ...readStringArray(classifierPayload?.["toolsToExpose"]),
  ]);
}

function readPromptPreview(events: readonly AssistantWorkflowTraceEvent[]): string | null {
  for (const event of events) {
    const payload = readRecord(event.payload);
    if (!payload) continue;
    const candidate = readAssistantWorkflowTraceUserMessagePreview(event.stage, payload);
    if (candidate) return candidate;
  }
  return null;
}

function inferSelectedToolNames(payload: Record<string, unknown>): string[] {
  const explicit = readStringArray(payload["effectiveToolNames"]);
  if (explicit.length) return explicit;
  const selected = readStringArray(payload["selectedToolNames"]);
  if (selected.length) return selected;

  const candidateTools = readStringArray(payload["workflowSelectionCandidateTools"]);
  const workflowSuggestedTools = readStringArray(payload["workflowSuggestedTools"]);
  const comparableTools = candidateTools.length ? candidateTools : workflowSuggestedTools;
  const missingTools = candidateTools.length
    ? readStringArray(payload["missingWorkflowSelectionCandidateTools"])
    : readStringArray(payload["missingWorkflowSuggestedTools"]);
  const outsideTools = candidateTools.length
    ? readStringArray(payload["selectedOutsideWorkflowSelectionCandidate"])
    : readStringArray(payload["selectedOutsideWorkflowSuggestions"]);
  const missingSet = new Set(missingTools);
  return uniqueStrings([
    ...comparableTools.filter((toolName) => !missingSet.has(toolName)),
    ...outsideTools,
  ]);
}

function inferWorkflowAuthoritySelectedToolNames(payload: Record<string, unknown>): string[] {
  const explicit = readStringArray(payload["effectiveToolNames"]);
  if (explicit.length) return explicit;
  const selected = readStringArray(payload["selectedToolNames"]);
  if (selected.length) return selected;
  const candidateTools = readStringArray(payload["workflowSelectionCandidateTools"]);
  if (candidateTools.length) return candidateTools;
  return readStringArray(payload["workflowSuggestedTools"]);
}

function inferWorkflowAuthorityReason(payload: Record<string, unknown>): string | null {
  const selectedReason = readString(payload["selectedReason"]);
  return selectedReason === "workflow_equivalent" || selectedReason === "workflow_authority_enabled"
    ? selectedReason
    : null;
}

function inferLegacyAuthorityReason(
  payload: Record<string, unknown>,
  selectedToolNames: readonly string[],
): string {
  const workflowStatus = readWorkflowStatus(payload);
  if (workflowStatus === "blocked" || workflowStatus === "needs-clarification") {
    return "workflow_blocked";
  }
  if (payload["pruningEnabled"] === false) {
    return "workflow_selection_not_exercised";
  }
  const hasWorkflowTools = readStringArray(payload["workflowSelectionCandidateTools"]).length > 0 ||
    readStringArray(payload["workflowSuggestedTools"]).length > 0;
  const hasDiffSignals = readStringArray(payload["missingWorkflowSelectionCandidateTools"]).length > 0 ||
    readStringArray(payload["missingWorkflowSuggestedTools"]).length > 0 ||
    readStringArray(payload["selectedOutsideWorkflowSelectionCandidate"]).length > 0 ||
    readStringArray(payload["selectedOutsideWorkflowSuggestions"]).length > 0;
  return hasWorkflowTools || selectedToolNames.length > 0 || hasDiffSignals
    ? "workflow_differs"
    : "workflow_unavailable";
}

function readWorkflowStatus(payload: Record<string, unknown>): string | null {
  const workflowRun = readRecord(payload["workflowRun"]);
  if (typeof workflowRun?.["status"] === "string") return workflowRun["status"];
  const executionPlan = readRecord(payload["executionPlan"]);
  if (typeof executionPlan?.["status"] === "string") return executionPlan["status"];
  return null;
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed.length || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toJsonRecordOrNull(value: unknown): Record<string, AssistantWorkflowJsonValue> | null {
  if (!isJsonRecord(value)) return null;
  return value;
}

function isJsonRecord(value: unknown): value is Record<string, AssistantWorkflowJsonValue> {
  const record = readRecord(value);
  if (!record) return false;
  return Object.values(record).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AssistantWorkflowJsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonRecord(value);
}
