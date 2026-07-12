export const ASSISTANT_WORKFLOW_TRACE_STAGE = {
  chatRequestStart: "chat.request.start",
  userMessage: "user.message",
  contextSelected: "context.selected",
  modelSelection: "model.selection",
  modelSelectionFallback: "model.selection.fallback",
  modelSelectionRuntimeMismatch: "model.selection.runtime_mismatch",
  llmCompletion: "llm.completion",
  llmUsage: "llm.usage",
  schemaAdvisoryRequest: "schema_advisory.request",
  routePlannerDecision: "route_planner.decision",
  plannerClassifierDone: "planner_classifier.done",
  plannerWorkflowDecision: "planner_classifier.workflow_decision",
  toolCall: "tool.call",
  toolCallError: "tool.call.error",
  toolGuardrailHit: "tool.guardrail.hit",
  toolSelectionApplied: "tools.selected",
  toolSelectionSignalsLegacy: "tool_selection.signals.legacy",
  toolSelectionWorkflowComparison: "tool_selection.workflow_comparison",
  responseGuardrailHit: "response.guardrail.hit",
  responsesStateConfig: "responses.state.config",
  responsesStatefulPilotConfig: "responses.stateful_pilot.config",
  responsesStateRequest: "responses.state.request",
  responsesStatePersisted: "responses.state.persisted",
  responsesStateHistoryCompacted: "responses.state.history_compacted",
  responsesCreated: "responses.created",
  responsesOutputItem: "responses.output.item",
  responsesReasoningSummary: "responses.reasoning.summary",
  responsesFunctionCall: "responses.function_call",
  responsesHostedToolsConfig: "responses.hosted_tools.config",
  responsesHostedToolsRequest: "responses.hosted_tools.request",
  responsesHostedToolsIntentSkipped: "responses.hosted_tools.intent_skipped",
  responsesHostedToolsIntent: "responses.hosted_tools.intent",
  qualitySignalsFlagged: "quality.signals.flagged",
  qualitySignalsOk: "quality.signals.ok",
  outcome: "assistant_workflow.outcome",
  memoryPatch: "assistant_workflow.memory_patch",
  toolBindingRuntime: "assistant_workflow.tool_binding_runtime",
  threadProfileInjected: "thread.profile.injected",
  threadProfileInjectionSkipped: "thread.profile.injection_skipped",
  threadProfileUpdated: "thread.profile.updated",
  directRoutePolicy: "assistant_workflow.direct_route_policy",
  directRouteGap: "assistant_workflow.direct_route_gap",
  turnShortCircuit: "turn.shortcircuit",
} as const;

export type AssistantWorkflowTraceStage =
  typeof ASSISTANT_WORKFLOW_TRACE_STAGE[keyof typeof ASSISTANT_WORKFLOW_TRACE_STAGE];

export const ASSISTANT_WORKFLOW_TRACE_STAGES = Object.values(ASSISTANT_WORKFLOW_TRACE_STAGE);

/**
 * Marks schema-cost traces computed from the final tool definitions sent to
 * the provider. Older traces without this marker may describe a pre-authority
 * candidate and must not be mixed into cost comparisons.
 */
export const ASSISTANT_WORKFLOW_TOOL_SELECTION_SCHEMA_COST_SOURCE = {
  effectiveSelectedToolDefinitionsV1: "effective_selected_tool_definitions_v1",
} as const;

export const ASSISTANT_WORKFLOW_REPLAY_CANDIDATE_TRACE_STAGES = [
  ASSISTANT_WORKFLOW_TRACE_STAGE.plannerWorkflowDecision,
  ASSISTANT_WORKFLOW_TRACE_STAGE.toolSelectionWorkflowComparison,
  ASSISTANT_WORKFLOW_TRACE_STAGE.outcome,
  ASSISTANT_WORKFLOW_TRACE_STAGE.memoryPatch,
  ASSISTANT_WORKFLOW_TRACE_STAGE.toolBindingRuntime,
  ASSISTANT_WORKFLOW_TRACE_STAGE.threadProfileUpdated,
] as const satisfies readonly AssistantWorkflowTraceStage[];

export const ASSISTANT_WORKFLOW_DIRECT_ROUTE_TRACE_OUTCOMES = [
  "done",
  "skip",
  "recovered",
  "error",
] as const;

export type AssistantWorkflowDirectRouteTraceOutcome =
  typeof ASSISTANT_WORKFLOW_DIRECT_ROUTE_TRACE_OUTCOMES[number];

export type AssistantWorkflowDirectRouteTraceStage =
  `direct.${string}.route.${AssistantWorkflowDirectRouteTraceOutcome}`;

export type AssistantWorkflowDirectRouteTraceStageParts = {
  stage: AssistantWorkflowDirectRouteTraceStage;
  route: string;
  outcome: AssistantWorkflowDirectRouteTraceOutcome;
};

export function isAssistantWorkflowTraceStage(value: unknown): value is AssistantWorkflowTraceStage {
  return typeof value === "string" &&
    ASSISTANT_WORKFLOW_TRACE_STAGES.includes(value as AssistantWorkflowTraceStage);
}

export function isAssistantWorkflowReplayCandidateTraceStage(value: unknown): value is
  typeof ASSISTANT_WORKFLOW_REPLAY_CANDIDATE_TRACE_STAGES[number] {
  return typeof value === "string" &&
    ASSISTANT_WORKFLOW_REPLAY_CANDIDATE_TRACE_STAGES.includes(
      value as typeof ASSISTANT_WORKFLOW_REPLAY_CANDIDATE_TRACE_STAGES[number],
    );
}

export function isAssistantWorkflowDirectRouteTraceOutcome(
  value: unknown,
): value is AssistantWorkflowDirectRouteTraceOutcome {
  return typeof value === "string" &&
    ASSISTANT_WORKFLOW_DIRECT_ROUTE_TRACE_OUTCOMES.includes(value as AssistantWorkflowDirectRouteTraceOutcome);
}

export function buildAssistantWorkflowDirectRouteTraceStage(
  route: unknown,
  outcome: unknown,
): AssistantWorkflowDirectRouteTraceStage | null {
  const normalizedRoute = typeof route === "string" ? route.trim() : "";
  if (!normalizedRoute || !isAssistantWorkflowDirectRouteTraceOutcome(outcome)) return null;
  return `direct.${normalizedRoute}.route.${outcome}`;
}

export function parseAssistantWorkflowDirectRouteTraceStage(
  stage: unknown,
): AssistantWorkflowDirectRouteTraceStageParts | null {
  if (typeof stage !== "string") return null;
  const match = /^direct\.(.+)\.route\.(done|skip|recovered|error)$/.exec(stage);
  if (!match) return null;
  const route = match[1]?.trim() ?? "";
  const outcome = match[2];
  if (!route || !isAssistantWorkflowDirectRouteTraceOutcome(outcome)) return null;
  return {
    stage: stage as AssistantWorkflowDirectRouteTraceStage,
    route,
    outcome,
  };
}
