import {
  ASSISTANT_WORKFLOW_TRACE_STAGE,
  parseAssistantWorkflowDirectRouteTraceStage,
} from "./trace-stages.js";
import {
  isAssistantWorkflowErrorTraceStage,
  readAssistantWorkflowTraceBoolean as readBoolean,
  readAssistantWorkflowTraceBooleanRecord as readBooleanRecord,
  readAssistantWorkflowTraceNumber as readNumber,
  readAssistantWorkflowTracePayloadRecord as readRecord,
  readAssistantWorkflowTraceString as readString,
  readAssistantWorkflowTraceStringArray as readStringArray,
  readAssistantWorkflowTraceUserMessagePreview,
  type AssistantWorkflowTraceEvent,
} from "./trace-events.js";

export {
  isAssistantWorkflowErrorTraceStage,
  readAssistantWorkflowTraceUserMessagePreview,
} from "./trace-events.js";
export type { AssistantWorkflowTraceEvent } from "./trace-events.js";

export type AssistantWorkflowTraceClassifierSummary = {
  intent: string | null;
  presentation: string | null;
  confidence: number | null;
  toolsToExpose: string[];
};

export type AssistantWorkflowTracePlanSummary = {
  stepIds: string[];
  activePlanningStepProfileIds: string[];
  profileStepIds: string[];
  missingPlanningSteps: string[];
  missingToolHints: string[];
  missingRequiredToolHints: string[];
  executionHints: Record<string, boolean>;
};

export type AssistantWorkflowTraceMemorySummary = {
  readSlots: string[];
  writeSlots: string[];
  injectSlots: string[];
  missingMemorySlots: string[];
};

export type AssistantWorkflowTraceAppliedMemoryPatchSummary = {
  slotId: string;
  operation: string;
  changed: boolean;
};

export type AssistantWorkflowTraceSkippedMemoryPatchSummary = {
  slotId: string | null;
  operation: string | null;
  reason: string;
};

export type AssistantWorkflowTraceIntentWritePolicySummary = {
  intentId: string | null;
  writeSlots: string[];
  missingMemorySlots: string[];
  changedSlots: string[];
  appliedPatchCount: number | null;
  skippedPatchCount: number | null;
  skippedPatches: AssistantWorkflowTraceSkippedMemoryPatchSummary[];
  profilePatchEquivalent: boolean | null;
  profilePatchComparedFields: string[];
  profilePatchMismatchedFields: string[];
};

export type AssistantWorkflowTraceMemoryPatchSummary = {
  stage: string;
  changedSlots: string[];
  changedProfileFields: string[];
  appliedPatchCount: number | null;
  skippedPatchCount: number | null;
  appliedPatches: AssistantWorkflowTraceAppliedMemoryPatchSummary[];
  skippedPatches: AssistantWorkflowTraceSkippedMemoryPatchSummary[];
  profilePatchEquivalent: boolean | null;
  profilePatchComparedFields: string[];
  profilePatchMismatchedFields: string[];
  patchDerivation: string | null;
  profileWriteMode: string | null;
  profileWriteSource: string | null;
  profileWriteReason: string | null;
  intentWritePolicy: AssistantWorkflowTraceIntentWritePolicySummary | null;
};

export type AssistantWorkflowTraceThreadProfileWriteSummary = {
  stage: string;
  changed: boolean | null;
  changedFields: string[];
  writeMode: string | null;
  writeSource: string | null;
  writeReason: string | null;
};

export type AssistantWorkflowTraceClarificationSummary = {
  ruleIds: string[];
  suggestedRuleIds: string[];
  blockingRuleIds: string[];
  missingClarificationRules: string[];
  needsClarification: boolean;
  reasons: string[];
};

export type AssistantWorkflowTraceClarificationComparisonSummary = {
  stage: string;
  intent: string | null;
  expectedRuleIds: string[];
  expectedBlockingRuleIds: string[];
  expectedSuggestedRuleIds: string[];
  produced: boolean | null;
  observedRuleId: string | null;
  equivalentRuleIds: string[];
  matched: boolean | null;
  missingExpectedRuleIds: string[];
  unexpectedObservedRuleId: string | null;
  source: string | null;
  layer: string | null;
  reason: string | null;
};

export type AssistantWorkflowTraceAuthoritySummary = {
  source: string | null;
  reason: string | null;
  selectedToolNames: string[];
  workflowSuggestedToolNames: string[];
  workflowStatus: string | null;
};

export type AssistantWorkflowTraceWorkflowSummary = {
  sourceStage: string;
  workflowId: string | null;
  workflowVersion: number | null;
  intent: string | null;
  matchedIntent: boolean | null;
  effectivePresentation: string | null;
  executionBias: string | null;
  workflowSuggestedTools: string[];
  workflowSelectionCandidateTools: string[];
  workflowSelectionOptionalToolMode: string | null;
  workflowSelectionExcludedOptionalTools: string[];
  workflowSelectionActiveProfileIds: string[];
  workflowSelectionProfileTools: string[];
  workflowSelectionProfileExcludedTools: string[];
  workflowAuthorityIntentIds: string[];
  workflowAuthoritySegmentKeys: string[];
  workflowAuthorityProfileKeys: string[];
  toolSelectionPruningEnabled: boolean | null;
  toolSelectionMode: string | null;
  missingToolHints: string[];
  missingRequiredToolHints: string[];
  extraClassifierTools: string[];
  missingWorkflowSuggestedTools: string[];
  missingWorkflowSelectionCandidateTools: string[];
  selectedOutsideWorkflowSuggestions: string[];
  selectedOutsideWorkflowSelectionCandidate: string[];
  plan: AssistantWorkflowTracePlanSummary | null;
  memory: AssistantWorkflowTraceMemorySummary | null;
  clarification: AssistantWorkflowTraceClarificationSummary | null;
  authority: AssistantWorkflowTraceAuthoritySummary | null;
};

export type AssistantWorkflowTraceToolCallSummary = {
  tool: string;
  requestedTool: string | null;
  hop: number | null;
  success: boolean;
  synthetic: boolean;
  parallel: boolean;
  resultChars: number | null;
  topic: string | null;
  structuredArtifactKinds: string[];
};

/**
 * The tool set that the runtime actually sent to a provider for one hop.
 * This is deliberately separate from workflow comparison data, which may
 * describe a broader candidate before runtime authority narrows it.
 */
export type AssistantWorkflowTraceToolSelectionSummary = {
  stage: string;
  hop: number | null;
  mode: string | null;
  reason: string | null;
  pruningEnabled: boolean | null;
  toolCount: number | null;
  totalToolCount: number | null;
  schemaCostSource: string | null;
  approxSchemaChars: number | null;
  approxSavedChars: number | null;
  toolNames: string[];
};

export type AssistantWorkflowTraceQualitySummary = {
  flagged: boolean;
  signalNames: string[];
  passedSignalNames: string[];
};

export type AssistantWorkflowTraceDirectRouteSummary = {
  stage: string;
  route: string;
  outcome: "done" | "skip" | "recovered" | "error";
  reason: string | null;
  strategy: string | null;
  topic: string | null;
  tool: string | null;
  mode: string | null;
  handled: boolean | null;
  contentChars: number | null;
  tookMs: number | null;
};

export type AssistantWorkflowTraceDirectRoutePolicySummary = {
  stage: string;
  intent: string | null;
  route: string | null;
  enabled: boolean | null;
  reason: string | null;
  policyRouteIds: string[];
};

export type AssistantWorkflowTraceDirectRouteGapSummary = {
  stage: string;
  handlerId: string | null;
  layer: string | null;
  route: string | null;
  reason: string | null;
};

export type AssistantWorkflowTraceOutcomeSummary = {
  stage: string;
  kind: string;
  handled: boolean;
  contentChars: number | null;
  reason: string | null;
  delivery: string | null;
  artifactKind: string | null;
  route: string | null;
  source: string | null;
  layer: string | null;
  skipEvent: string | null;
  mode: string | null;
  submode: string | null;
  tool: string | null;
  ruleId: string | null;
  streamed: boolean | null;
};

export type AssistantWorkflowTraceToolRuntimeBindingSummary = {
  stage: string;
  toolName: string | null;
  status: string | null;
  capabilityProvider: string | null;
  bindingProvider: string | null;
  runtimeAdapterId: string | null;
  policyMismatchFields: string[];
};

export type AssistantWorkflowTraceSummary = {
  userMessagePreview: string | null;
  classifier: AssistantWorkflowTraceClassifierSummary | null;
  workflow: AssistantWorkflowTraceWorkflowSummary | null;
  directRoutes: AssistantWorkflowTraceDirectRouteSummary[];
  directRoutePolicies: AssistantWorkflowTraceDirectRoutePolicySummary[];
  directRouteGaps: AssistantWorkflowTraceDirectRouteGapSummary[];
  memoryPatches: AssistantWorkflowTraceMemoryPatchSummary[];
  threadProfileWrites: AssistantWorkflowTraceThreadProfileWriteSummary[];
  outcomes: AssistantWorkflowTraceOutcomeSummary[];
  handledOutcome: AssistantWorkflowTraceOutcomeSummary | null;
  toolRuntimeBindings: AssistantWorkflowTraceToolRuntimeBindingSummary[];
  clarificationComparisons: AssistantWorkflowTraceClarificationComparisonSummary[];
  toolSelections: AssistantWorkflowTraceToolSelectionSummary[];
  toolCalls: AssistantWorkflowTraceToolCallSummary[];
  toolCallNames: string[];
  errorStages: string[];
  quality: AssistantWorkflowTraceQualitySummary;
  traceEventCount: number;
};

export type AssistantWorkflowTraceEvalCandidate = {
  promptPreview: string;
  expectedIntent: string | null;
  expectedPresentation: string | null;
  expectedPlanStepIds: string[];
  expectedActivePlanningStepProfileIds: string[];
  expectedProfileStepIds: string[];
  expectedTools: string[];
  qualitySignalNames: string[];
  notes: string[];
};

export type AssistantWorkflowTraceTuningSignalName =
  | "missing_classifier"
  | "workflow_missing_required_tools"
  | "workflow_missing_optional_tools"
  | "workflow_missing_planning_steps"
  | "workflow_suggested_not_selected"
  | "selected_outside_workflow"
  | "classifier_extra_tools"
  | "clarification_runtime_mismatch"
  | "workflow_memory_patch_mismatch"
  | "trace_errors"
  | "quality_signal";

export type AssistantWorkflowTraceTuningSignal = {
  name: AssistantWorkflowTraceTuningSignalName;
  severity: "info" | "warning";
  detail: string | null;
};

export function buildAssistantWorkflowTraceSummary(
  events: readonly AssistantWorkflowTraceEvent[],
): AssistantWorkflowTraceSummary {
  let userMessagePreview: string | null = null;
  let classifier: AssistantWorkflowTraceClassifierSummary | null = null;
  let workflow: AssistantWorkflowTraceWorkflowSummary | null = null;
  const directRoutes: AssistantWorkflowTraceDirectRouteSummary[] = [];
  const directRoutePolicies: AssistantWorkflowTraceDirectRoutePolicySummary[] = [];
  const directRouteGaps: AssistantWorkflowTraceDirectRouteGapSummary[] = [];
  const memoryPatches: AssistantWorkflowTraceMemoryPatchSummary[] = [];
  const threadProfileWrites: AssistantWorkflowTraceThreadProfileWriteSummary[] = [];
  const outcomes: AssistantWorkflowTraceOutcomeSummary[] = [];
  const toolRuntimeBindings: AssistantWorkflowTraceToolRuntimeBindingSummary[] = [];
  const clarificationComparisons: AssistantWorkflowTraceClarificationComparisonSummary[] = [];
  const toolSelections: AssistantWorkflowTraceToolSelectionSummary[] = [];
  const toolCalls: AssistantWorkflowTraceToolCallSummary[] = [];
  const errorStages: string[] = [];
  let qualityFlagged = false;
  const qualitySignalNames = new Set<string>();
  const passedSignalNames = new Set<string>();

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const stage = typeof event.stage === "string" ? event.stage : "";
    if (!stage) continue;

    if (isAssistantWorkflowErrorTraceStage(stage)) {
      errorStages.push(stage);
    }

    const payload = readRecord(event.payload);
    if (!payload) continue;

    if (!userMessagePreview) {
      userMessagePreview = readAssistantWorkflowTraceUserMessagePreview(stage, payload);
    }

    const directRoute = readDirectRouteSummary(stage, payload);
    if (directRoute) {
      directRoutes.push(directRoute);
      continue;
    }

    const directRoutePolicy = readDirectRoutePolicySummary(stage, payload);
    if (directRoutePolicy) {
      directRoutePolicies.push(directRoutePolicy);
      continue;
    }

    const directRouteGap = readDirectRouteGapSummary(stage, payload);
    if (directRouteGap) {
      directRouteGaps.push(directRouteGap);
      continue;
    }

    const memoryPatch = readMemoryPatchSummary(stage, payload);
    if (memoryPatch) {
      memoryPatches.push(memoryPatch);
      continue;
    }

    const threadProfileWrite = readThreadProfileWriteSummary(stage, payload);
    if (threadProfileWrite) {
      threadProfileWrites.push(threadProfileWrite);
      continue;
    }

    const outcome = readOutcomeSummary(stage, payload);
    if (outcome) {
      outcomes.push(outcome);
      continue;
    }

    const toolRuntimeBinding = readToolRuntimeBindingSummary(stage, payload);
    if (toolRuntimeBinding) {
      toolRuntimeBindings.push(toolRuntimeBinding);
      continue;
    }

    const clarificationComparison = readClarificationComparisonSummary(stage, payload);
    if (clarificationComparison) {
      clarificationComparisons.push(clarificationComparison);
      continue;
    }

    if (stage === ASSISTANT_WORKFLOW_TRACE_STAGE.plannerClassifierDone) {
      classifier = readClassifierSummary(payload);
      continue;
    }

    if (
      stage === ASSISTANT_WORKFLOW_TRACE_STAGE.plannerWorkflowDecision ||
      stage === ASSISTANT_WORKFLOW_TRACE_STAGE.toolSelectionWorkflowComparison
    ) {
      const nextWorkflow = readWorkflowSummary(stage, payload);
      workflow = workflow ? mergeWorkflowSummaries(workflow, nextWorkflow) : nextWorkflow;
      if (!classifier && stage === ASSISTANT_WORKFLOW_TRACE_STAGE.plannerWorkflowDecision) {
        classifier = readClassifierSummary(payload);
      }
      continue;
    }

    if (stage === ASSISTANT_WORKFLOW_TRACE_STAGE.toolSelectionApplied) {
      toolSelections.push(readToolSelectionSummary(stage, payload));
      continue;
    }

    if (
      stage === ASSISTANT_WORKFLOW_TRACE_STAGE.toolCall ||
      stage === ASSISTANT_WORKFLOW_TRACE_STAGE.toolCallError
    ) {
      const toolCall = readToolCallSummary(stage, payload);
      if (toolCall) toolCalls.push(toolCall);
      continue;
    }

    if (
      stage === ASSISTANT_WORKFLOW_TRACE_STAGE.qualitySignalsFlagged ||
      stage === ASSISTANT_WORKFLOW_TRACE_STAGE.qualitySignalsOk
    ) {
      if (stage === ASSISTANT_WORKFLOW_TRACE_STAGE.qualitySignalsFlagged) qualityFlagged = true;
      for (const name of readQualitySignalNames(payload["triggered"])) {
        qualitySignalNames.add(name);
      }
      for (const name of readStringArray(payload["passed"])) {
        passedSignalNames.add(name);
      }
    }
  }

  return {
    userMessagePreview,
    classifier,
    workflow,
    directRoutes,
    directRoutePolicies,
    directRouteGaps,
    memoryPatches,
    threadProfileWrites,
    outcomes,
    handledOutcome: [...outcomes].reverse().find((outcome) => outcome.handled) ?? null,
    toolRuntimeBindings,
    clarificationComparisons,
    toolSelections,
    toolCalls,
    toolCallNames: uniqueStrings(toolCalls.map((call) => call.tool)),
    errorStages: uniqueStrings(errorStages),
    quality: {
      flagged: qualityFlagged,
      signalNames: [...qualitySignalNames].sort(),
      passedSignalNames: [...passedSignalNames].sort(),
    },
    traceEventCount: events.length,
  };
}

export function buildAssistantWorkflowTraceEvalCandidate(
  summary: AssistantWorkflowTraceSummary,
): AssistantWorkflowTraceEvalCandidate | null {
  if (!summary.userMessagePreview) return null;

  const expectedIntent = summary.classifier?.intent ?? summary.workflow?.intent ?? null;
  const expectedPresentation =
    summary.classifier?.presentation ?? summary.workflow?.effectivePresentation ?? null;
  const expectedTools = uniqueStrings([
    ...(summary.workflow?.workflowSelectionCandidateTools.length
      ? summary.workflow.workflowSelectionCandidateTools
      : summary.workflow?.workflowSuggestedTools ?? []),
    ...summary.toolCallNames,
  ]);
  const notes = collectAssistantWorkflowTraceTuningSignals(summary).map((signal) =>
    signal.detail ? `${signal.name}: ${signal.detail}` : signal.name
  );

  return {
    promptPreview: summary.userMessagePreview,
    expectedIntent,
    expectedPresentation,
    expectedPlanStepIds: summary.workflow?.plan?.stepIds ?? [],
    expectedActivePlanningStepProfileIds: summary.workflow?.plan?.activePlanningStepProfileIds ?? [],
    expectedProfileStepIds: summary.workflow?.plan?.profileStepIds ?? [],
    expectedTools,
    qualitySignalNames: summary.quality.signalNames,
    notes,
  };
}

export function collectAssistantWorkflowTraceTuningSignals(
  summary: AssistantWorkflowTraceSummary,
): AssistantWorkflowTraceTuningSignal[] {
  const signals: AssistantWorkflowTraceTuningSignal[] = [];

  if (!summary.classifier) {
    signals.push({
      name: "missing_classifier",
      severity: "info",
      detail: "turn did not emit planner_classifier.done",
    });
  }

  const workflow = summary.workflow;
  if (workflow) {
    if (workflow.missingRequiredToolHints.length) {
      signals.push({
        name: "workflow_missing_required_tools",
        severity: "warning",
        detail: workflow.missingRequiredToolHints.join(", "),
      });
    }
    if (workflow.missingToolHints.length) {
      signals.push({
        name: "workflow_missing_optional_tools",
        severity: "info",
        detail: workflow.missingToolHints.join(", "),
      });
    }
    if (workflow.plan?.missingPlanningSteps.length) {
      signals.push({
        name: "workflow_missing_planning_steps",
        severity: "warning",
        detail: workflow.plan.missingPlanningSteps.join(", "),
      });
    }
    if (hasAssistantWorkflowConstrainedToolSelectionEvidence(workflow)) {
      const missingSelectionCandidateTools = getMissingWorkflowSelectionCandidateTools(workflow);
      if (missingSelectionCandidateTools.length) {
        signals.push({
          name: "workflow_suggested_not_selected",
          severity: "info",
          detail: missingSelectionCandidateTools.join(", "),
        });
      }
      const unmodeledToolCalls = getAssistantWorkflowUnmodeledToolCalls(
        workflow,
        summary.toolCallNames,
      );
      if (unmodeledToolCalls.length) {
        signals.push({
          name: "selected_outside_workflow",
          severity: "info",
          detail: unmodeledToolCalls.join(", "),
        });
      }
    }
    if (workflow.extraClassifierTools.length) {
      signals.push({
        name: "classifier_extra_tools",
        severity: "info",
        detail: workflow.extraClassifierTools.join(", "),
      });
    }
  }

  for (const comparison of summary.clarificationComparisons) {
    if (comparison.matched !== false) continue;
    signals.push({
      name: "clarification_runtime_mismatch",
      severity: "warning",
      detail: buildClarificationComparisonMismatchDetail(comparison),
    });
  }

  for (const patch of summary.memoryPatches) {
    if (patch.profilePatchEquivalent !== false) continue;
    signals.push({
      name: "workflow_memory_patch_mismatch",
      severity: "warning",
      detail: patch.profilePatchMismatchedFields.length
        ? patch.profilePatchMismatchedFields.join(", ")
        : "profile patch mismatch",
    });
  }

  if (summary.errorStages.length) {
    signals.push({
      name: "trace_errors",
      severity: "warning",
      detail: summary.errorStages.join(", "),
    });
  }

  for (const name of summary.quality.signalNames) {
    signals.push({
      name: "quality_signal",
      severity: "warning",
      detail: name,
    });
  }

  return signals;
}

function buildClarificationComparisonMismatchDetail(
  comparison: AssistantWorkflowTraceClarificationComparisonSummary,
): string {
  if (comparison.missingExpectedRuleIds.length) {
    return `missing ${comparison.missingExpectedRuleIds.join(", ")}`;
  }
  if (comparison.unexpectedObservedRuleId) {
    return `unexpected ${comparison.unexpectedObservedRuleId}`;
  }
  if (comparison.observedRuleId) {
    return `unmatched ${comparison.observedRuleId}`;
  }
  return "clarification policy mismatch";
}

function readClassifierSummary(payload: Record<string, unknown>): AssistantWorkflowTraceClassifierSummary {
  return {
    intent: readString(payload["intent"]),
    presentation: readString(payload["presentation"]),
    confidence: readNumber(payload["confidence"]),
    toolsToExpose: readStringArray(payload["toolsToExpose"]),
  };
}

function readClarificationComparisonSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceClarificationComparisonSummary | null {
  if (stage !== "clarification.workflow_comparison") return null;
  return {
    stage,
    intent: readString(payload["intent"]),
    expectedRuleIds: readStringArray(payload["expectedRuleIds"]),
    expectedBlockingRuleIds: readStringArray(payload["expectedBlockingRuleIds"]),
    expectedSuggestedRuleIds: readStringArray(payload["expectedSuggestedRuleIds"]),
    produced: readBoolean(payload["produced"]),
    observedRuleId: readString(payload["observedRuleId"]),
    equivalentRuleIds: readStringArray(payload["equivalentRuleIds"]),
    matched: readBoolean(payload["matched"]),
    missingExpectedRuleIds: readStringArray(payload["missingExpectedRuleIds"]),
    unexpectedObservedRuleId: readString(payload["unexpectedObservedRuleId"]),
    source: readString(payload["source"]),
    layer: readString(payload["layer"]),
    reason: readString(payload["reason"]),
  };
}

function readWorkflowSummary(
  sourceStage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceWorkflowSummary {
  const workflowRun = readRecord(payload["workflowRun"]);
  const memoryPolicy = readRecord(payload["memoryPolicy"]);
  const clarificationPolicy = readRecord(payload["clarificationPolicy"]);
  const authority = readRecord(payload["authority"]);
  return {
    sourceStage,
    workflowId: readString(payload["workflowId"]) ?? readString(workflowRun?.["workflowId"]),
    workflowVersion: readNumber(payload["workflowVersion"]) ?? readNumber(workflowRun?.["workflowVersion"]),
    intent: readString(payload["intent"]),
    matchedIntent: readBoolean(payload["matchedIntent"]),
    effectivePresentation: readString(payload["effectivePresentation"]),
    executionBias: readString(payload["executionBias"]),
    workflowSuggestedTools: readStringArray(payload["workflowSuggestedTools"]),
    workflowSelectionCandidateTools: readStringArray(payload["workflowSelectionCandidateTools"]),
    workflowSelectionOptionalToolMode: readString(payload["workflowSelectionOptionalToolMode"]),
    workflowSelectionExcludedOptionalTools: readStringArray(payload["workflowSelectionExcludedOptionalTools"]),
    workflowSelectionActiveProfileIds: readStringArray(payload["workflowSelectionActiveProfileIds"]),
    workflowSelectionProfileTools: readStringArray(payload["workflowSelectionProfileTools"]),
    workflowSelectionProfileExcludedTools: readStringArray(payload["workflowSelectionProfileExcludedTools"]),
    workflowAuthorityIntentIds: readStringArray(payload["workflowAuthorityIntentIds"]),
    workflowAuthoritySegmentKeys: readStringArray(payload["workflowAuthoritySegmentKeys"]),
    workflowAuthorityProfileKeys: readStringArray(payload["workflowAuthorityProfileKeys"]),
    toolSelectionPruningEnabled: readBoolean(payload["pruningEnabled"]),
    toolSelectionMode: readString(payload["selectedMode"]),
    missingToolHints: readStringArray(payload["missingToolHints"]),
    missingRequiredToolHints: readStringArray(payload["missingRequiredToolHints"]),
    extraClassifierTools: readStringArray(payload["extraClassifierTools"]),
    missingWorkflowSuggestedTools: readStringArray(payload["missingWorkflowSuggestedTools"]),
    missingWorkflowSelectionCandidateTools: readStringArray(payload["missingWorkflowSelectionCandidateTools"]),
    selectedOutsideWorkflowSuggestions: readStringArray(payload["selectedOutsideWorkflowSuggestions"]),
    selectedOutsideWorkflowSelectionCandidate: readStringArray(payload["selectedOutsideWorkflowSelectionCandidate"]),
    plan: readPlanSummary(payload["plan"]),
    memory: memoryPolicy
      ? {
          readSlots: readStringArray(memoryPolicy["readSlots"]),
          writeSlots: readStringArray(memoryPolicy["writeSlots"]),
          injectSlots: readStringArray(memoryPolicy["injectSlots"]),
          missingMemorySlots: readStringArray(memoryPolicy["missingMemorySlots"]),
        }
      : null,
    clarification: clarificationPolicy
      ? {
          ruleIds: readStringArray(clarificationPolicy["ruleIds"]),
          suggestedRuleIds: readStringArray(clarificationPolicy["suggestedRuleIds"]),
          blockingRuleIds: readStringArray(clarificationPolicy["blockingRuleIds"]),
          missingClarificationRules: readStringArray(clarificationPolicy["missingClarificationRules"]),
          needsClarification: readBoolean(clarificationPolicy["needsClarification"]) ?? false,
          reasons: readStringArray(clarificationPolicy["reasons"]),
        }
      : null,
    authority: authority
      ? {
          source: readString(authority["source"]),
          reason: readString(authority["reason"]),
          selectedToolNames: readStringArray(authority["selectedToolNames"]),
          workflowSuggestedToolNames: readStringArray(authority["workflowSuggestedToolNames"]),
          workflowStatus: readString(authority["workflowStatus"]),
        }
      : null,
  };
}

function mergeWorkflowSummaries(
  previous: AssistantWorkflowTraceWorkflowSummary,
  next: AssistantWorkflowTraceWorkflowSummary,
): AssistantWorkflowTraceWorkflowSummary {
  return {
    sourceStage: next.sourceStage,
    workflowId: next.workflowId ?? previous.workflowId,
    workflowVersion: next.workflowVersion ?? previous.workflowVersion,
    intent: next.intent ?? previous.intent,
    matchedIntent: next.matchedIntent ?? previous.matchedIntent,
    effectivePresentation: next.effectivePresentation ?? previous.effectivePresentation,
    executionBias: next.executionBias ?? previous.executionBias,
    workflowSuggestedTools: mergeStringArrays(previous.workflowSuggestedTools, next.workflowSuggestedTools),
    workflowSelectionCandidateTools: mergeStringArrays(previous.workflowSelectionCandidateTools, next.workflowSelectionCandidateTools),
    workflowSelectionOptionalToolMode: next.workflowSelectionOptionalToolMode ?? previous.workflowSelectionOptionalToolMode,
    workflowSelectionExcludedOptionalTools: mergeStringArrays(
      previous.workflowSelectionExcludedOptionalTools,
      next.workflowSelectionExcludedOptionalTools,
    ),
    workflowSelectionActiveProfileIds: mergeStringArrays(
      previous.workflowSelectionActiveProfileIds,
      next.workflowSelectionActiveProfileIds,
    ),
    workflowSelectionProfileTools: mergeStringArrays(previous.workflowSelectionProfileTools, next.workflowSelectionProfileTools),
    workflowSelectionProfileExcludedTools: mergeStringArrays(
      previous.workflowSelectionProfileExcludedTools,
      next.workflowSelectionProfileExcludedTools,
    ),
    workflowAuthorityIntentIds: mergeStringArrays(
      previous.workflowAuthorityIntentIds,
      next.workflowAuthorityIntentIds,
    ),
    workflowAuthoritySegmentKeys: mergeStringArrays(
      previous.workflowAuthoritySegmentKeys,
      next.workflowAuthoritySegmentKeys,
    ),
    workflowAuthorityProfileKeys: mergeStringArrays(
      previous.workflowAuthorityProfileKeys,
      next.workflowAuthorityProfileKeys,
    ),
    toolSelectionPruningEnabled: next.toolSelectionPruningEnabled ?? previous.toolSelectionPruningEnabled,
    toolSelectionMode: next.toolSelectionMode ?? previous.toolSelectionMode,
    missingToolHints: mergeStringArrays(previous.missingToolHints, next.missingToolHints),
    missingRequiredToolHints: mergeStringArrays(previous.missingRequiredToolHints, next.missingRequiredToolHints),
    extraClassifierTools: mergeStringArrays(previous.extraClassifierTools, next.extraClassifierTools),
    missingWorkflowSuggestedTools: mergeStringArrays(previous.missingWorkflowSuggestedTools, next.missingWorkflowSuggestedTools),
    missingWorkflowSelectionCandidateTools: mergeStringArrays(
      previous.missingWorkflowSelectionCandidateTools,
      next.missingWorkflowSelectionCandidateTools,
    ),
    selectedOutsideWorkflowSuggestions: mergeStringArrays(
      previous.selectedOutsideWorkflowSuggestions,
      next.selectedOutsideWorkflowSuggestions,
    ),
    selectedOutsideWorkflowSelectionCandidate: mergeStringArrays(
      previous.selectedOutsideWorkflowSelectionCandidate,
      next.selectedOutsideWorkflowSelectionCandidate,
    ),
    plan: next.plan ?? previous.plan,
    memory: next.memory ?? previous.memory,
    clarification: next.clarification ?? previous.clarification,
    authority: next.authority ?? previous.authority,
  };
}

function mergeStringArrays(previous: readonly string[], next: readonly string[]): string[] {
  return uniqueStrings([...previous, ...next]);
}

export function getMissingWorkflowSelectionCandidateTools(
  workflow: AssistantWorkflowTraceWorkflowSummary,
): string[] {
  if (!workflow.workflowSelectionCandidateTools.length) {
    return workflow.missingWorkflowSuggestedTools;
  }
  if (workflow.missingWorkflowSelectionCandidateTools.length) {
    return workflow.missingWorkflowSelectionCandidateTools;
  }
  const selectedToolNames = workflow.authority?.selectedToolNames ?? [];
  if (!selectedToolNames.length) {
    return workflow.missingWorkflowSuggestedTools.filter((tool) =>
      workflow.workflowSelectionCandidateTools.includes(tool)
    );
  }
  const selectedSet = new Set(selectedToolNames);
  return workflow.workflowSelectionCandidateTools.filter((tool) => !selectedSet.has(tool));
}

/**
 * A full catalog records availability, not a routing decision. Older traces did
 * not include this metadata, so they retain the legacy interpretation.
 */
export function hasAssistantWorkflowConstrainedToolSelectionEvidence(
  workflow: AssistantWorkflowTraceWorkflowSummary,
): boolean {
  return !(
    workflow.toolSelectionPruningEnabled === false
    && workflow.toolSelectionMode === "full"
  );
}

/**
 * Prompt exposure alone is not definition-tuning evidence. A tool must have
 * been invoked and be absent from the workflow's full hint set.
 */
export function getAssistantWorkflowUnmodeledToolCalls(
  workflow: AssistantWorkflowTraceWorkflowSummary,
  toolCallNames: readonly string[],
): string[] {
  const workflowTools = new Set(workflow.workflowSuggestedTools);
  return uniqueStrings(toolCallNames.filter((toolName) => !workflowTools.has(toolName)));
}

export function getSelectedOutsideWorkflowSelectionCandidate(
  workflow: AssistantWorkflowTraceWorkflowSummary,
): string[] {
  if (!workflow.workflowSelectionCandidateTools.length) {
    return workflow.selectedOutsideWorkflowSuggestions;
  }
  if (workflow.selectedOutsideWorkflowSelectionCandidate.length) {
    return workflow.selectedOutsideWorkflowSelectionCandidate;
  }
  const candidateSet = new Set(workflow.workflowSelectionCandidateTools);
  const selectedToolNames = workflow.authority?.selectedToolNames ?? [];
  if (!selectedToolNames.length) return [];
  return selectedToolNames.filter((tool) => !candidateSet.has(tool));
}

function readPlanSummary(value: unknown): AssistantWorkflowTracePlanSummary | null {
  const plan = readRecord(value);
  if (!plan) return null;
  return {
    stepIds: readStringArray(plan["stepIds"]),
    activePlanningStepProfileIds: readStringArray(plan["activePlanningStepProfileIds"]),
    profileStepIds: readStringArray(plan["profileStepIds"]),
    missingPlanningSteps: readStringArray(plan["missingPlanningSteps"]),
    missingToolHints: readStringArray(plan["missingToolHints"]),
    missingRequiredToolHints: readStringArray(plan["missingRequiredToolHints"]),
    executionHints: readBooleanRecord(plan["executionHints"]),
  };
}

function readToolCallSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceToolCallSummary | null {
  const tool = readString(payload["tool"]) ?? readString(payload["effectiveToolName"]);
  if (!tool) return null;
  const args = readRecord(payload["args"]);
  return {
    tool,
    requestedTool: readString(payload["requestedTool"]) ?? readString(payload["requestedToolName"]),
    hop: readNumber(payload["hop"]),
    success: stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.toolCallError,
    synthetic: readBoolean(payload["synthetic"]) ?? false,
    parallel: readBoolean(payload["parallel"]) ?? false,
    resultChars: readNumber(payload["resultChars"]),
    topic: args ? readString(args["topic"]) : null,
    structuredArtifactKinds: readStringArray(payload["structuredArtifactKinds"]),
  };
}

function readToolSelectionSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceToolSelectionSummary {
  return {
    stage,
    hop: readNumber(payload["hop"]),
    mode: readString(payload["mode"]),
    reason: readString(payload["reason"]),
    pruningEnabled: readBoolean(payload["toolPruningEnabled"]),
    toolCount: readNumber(payload["toolCount"]),
    totalToolCount: readNumber(payload["totalToolCount"]),
    schemaCostSource: readString(payload["schemaCostSource"]),
    approxSchemaChars: readNumber(payload["approxSchemaChars"]),
    approxSavedChars: readNumber(payload["approxSavedChars"]),
    toolNames: readStringArray(payload["tools"]),
  };
}

function readOutcomeSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceOutcomeSummary | null {
  if (stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.outcome) return null;
  const kind = readString(payload["kind"]);
  if (!kind) return null;
  return {
    stage,
    kind,
    handled: readBoolean(payload["handled"]) ?? false,
    contentChars: readNumber(payload["contentChars"]),
    reason: readString(payload["reason"]),
    delivery: readString(payload["delivery"]),
    artifactKind: readString(payload["artifactKind"]),
    route: readString(payload["route"]),
    source: readString(payload["source"]),
    layer: readString(payload["layer"]),
    skipEvent: readString(payload["skipEvent"]),
    mode: readString(payload["mode"]),
    submode: readString(payload["submode"]),
    tool: readString(payload["tool"]),
    ruleId: readString(payload["ruleId"]),
    streamed: readBoolean(payload["streamed"]),
  };
}

function readToolRuntimeBindingSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceToolRuntimeBindingSummary | null {
  if (stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.toolBindingRuntime) return null;
  return {
    stage,
    toolName: readString(payload["toolName"]),
    status: readString(payload["status"]),
    capabilityProvider: readString(payload["capabilityProvider"]),
    bindingProvider: readString(payload["bindingProvider"]),
    runtimeAdapterId: readString(payload["runtimeAdapterId"]),
    policyMismatchFields: readPolicyMismatchFields(payload["policyMismatches"]),
  };
}

function readMemoryPatchSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceMemoryPatchSummary | null {
  if (stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.memoryPatch) return null;
  return {
    stage,
    changedSlots: readStringArray(payload["changedSlots"]),
    changedProfileFields: readStringArray(payload["changedProfileFields"]),
    appliedPatchCount: readNumber(payload["appliedPatchCount"]),
    skippedPatchCount: readNumber(payload["skippedPatchCount"]),
    appliedPatches: readAppliedMemoryPatches(payload["appliedPatches"]),
    skippedPatches: readSkippedMemoryPatches(payload["skippedPatches"]),
    profilePatchEquivalent: readBoolean(payload["profilePatchEquivalent"]),
    profilePatchComparedFields: readStringArray(payload["profilePatchComparedFields"]),
    profilePatchMismatchedFields: readStringArray(payload["profilePatchMismatchedFields"]),
    patchDerivation: readString(payload["patchDerivation"]),
    profileWriteMode: readString(payload["profileWriteMode"]),
    profileWriteSource: readString(payload["profileWriteSource"]),
    profileWriteReason: readString(payload["profileWriteReason"]),
    intentWritePolicy: readIntentWritePolicySummary(payload["intentWritePolicy"]),
  };
}

function readIntentWritePolicySummary(value: unknown): AssistantWorkflowTraceIntentWritePolicySummary | null {
  const policy = readRecord(value);
  if (!policy) return null;
  return {
    intentId: readString(policy["intentId"]),
    writeSlots: readStringArray(policy["writeSlots"]),
    missingMemorySlots: readStringArray(policy["missingMemorySlots"]),
    changedSlots: readStringArray(policy["changedSlots"]),
    appliedPatchCount: readNumber(policy["appliedPatchCount"]),
    skippedPatchCount: readNumber(policy["skippedPatchCount"]),
    skippedPatches: readSkippedMemoryPatches(policy["skippedPatches"]),
    profilePatchEquivalent: readBoolean(policy["profilePatchEquivalent"]),
    profilePatchComparedFields: readStringArray(policy["profilePatchComparedFields"]),
    profilePatchMismatchedFields: readStringArray(policy["profilePatchMismatchedFields"]),
  };
}

function readThreadProfileWriteSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceThreadProfileWriteSummary | null {
  if (stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.threadProfileUpdated) return null;
  return {
    stage,
    changed: readBoolean(payload["changed"]),
    changedFields: readStringArray(payload["changedFields"]),
    writeMode: readString(payload["writeMode"]),
    writeSource: readString(payload["writeSource"]),
    writeReason: readString(payload["writeReason"]),
  };
}

function readPolicyMismatchFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.flatMap((entry) => {
    const record = readRecord(entry);
    const field = record ? readString(record["field"]) : null;
    return field ? [field] : [];
  }));
}

function readAppliedMemoryPatches(value: unknown): AssistantWorkflowTraceAppliedMemoryPatchSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = readRecord(entry);
    if (!record) return [];
    const slotId = readString(record["slotId"]);
    const operation = readString(record["operation"]);
    if (!slotId || !operation) return [];
    return [{
      slotId,
      operation,
      changed: readBoolean(record["changed"]) ?? false,
    }];
  });
}

function readSkippedMemoryPatches(value: unknown): AssistantWorkflowTraceSkippedMemoryPatchSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = readRecord(entry);
    if (!record) return [];
    const reason = readString(record["reason"]);
    if (!reason) return [];
    return [{
      slotId: readString(record["slotId"]),
      operation: readString(record["operation"]),
      reason,
    }];
  });
}

function readDirectRouteSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceDirectRouteSummary | null {
  const parsedStage = parseAssistantWorkflowDirectRouteTraceStage(stage);
  if (!parsedStage) return null;
  return {
    stage,
    route: parsedStage.route,
    outcome: parsedStage.outcome,
    reason: readString(payload["reason"]),
    strategy: readString(payload["strategy"]),
    topic: readString(payload["topic"]),
    tool: readString(payload["tool"]),
    mode: readString(payload["mode"]),
    handled: readBoolean(payload["handled"]),
    contentChars: readNumber(payload["contentChars"]),
    tookMs: readNumber(payload["tookMs"]),
  };
}

function readDirectRoutePolicySummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceDirectRoutePolicySummary | null {
  if (stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.directRoutePolicy) return null;
  return {
    stage,
    intent: readString(payload["intent"]),
    route: readString(payload["route"]),
    enabled: readBoolean(payload["enabled"]),
    reason: readString(payload["reason"]),
    policyRouteIds: readStringArray(payload["policyRouteIds"]),
  };
}

function readDirectRouteGapSummary(
  stage: string,
  payload: Record<string, unknown>,
): AssistantWorkflowTraceDirectRouteGapSummary | null {
  if (stage !== ASSISTANT_WORKFLOW_TRACE_STAGE.directRouteGap) return null;
  return {
    stage,
    handlerId: readString(payload["handlerId"]),
    layer: readString(payload["layer"]),
    route: readString(payload["route"]),
    reason: readString(payload["reason"]),
  };
}

function readQualitySignalNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      out.push(entry);
      continue;
    }
    const record = readRecord(entry);
    const name = record ? readString(record["name"]) : null;
    if (name) out.push(name);
  }
  return uniqueStrings(out);
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
