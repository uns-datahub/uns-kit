import {
  assistantWorkflowDirectRouteFromInvocation,
  assistantWorkflowDirectRouteNotHandledFromInvocation,
  assistantWorkflowClarification,
  assistantWorkflowDegraded,
  assistantWorkflowFinalText,
  assistantWorkflowStructuredArtifact,
  assistantWorkflowUnavailable,
  buildAssistantWorkflowOutcomeTraceEventPayload,
  getAssistantWorkflowDirectRouteOutcomeRoute,
  type AssistantWorkflowDirectRouteOutcome,
  type AssistantWorkflowDirectRouteOutcomeOptions,
  type AssistantWorkflowDirectRouteOutcomeRouteSource,
  type AssistantWorkflowOutcome,
  type AssistantWorkflowOutcomeDelivery,
} from "./outcome.js";
import { parseAssistantWorkflowDirectRouteTraceStage } from "./trace-stages.js";

export type AssistantWorkflowFinalTextOutcomeTraceInput = {
  content: string;
  delivery?: AssistantWorkflowOutcomeDelivery;
  source?: string;
  layer?: string;
  mode?: string;
  streamed?: boolean;
};

export type AssistantWorkflowStructuredArtifactOutcomeTraceInput = {
  content: string;
  artifactKind: string;
  source?: string;
  layer?: string;
  mode?: string;
  submode?: string;
  tool?: string;
  streamed?: boolean;
};

export type AssistantWorkflowUnavailableOutcomeTraceInput = {
  artifactKind: string;
  reason: string;
  /** Artifact kinds that cannot be produced because this prerequisite is unavailable. */
  blockedArtifactKinds?: readonly string[];
  content?: string;
  source?: string;
  layer?: string;
  mode?: string;
  tool?: string;
};

export type AssistantWorkflowClarificationOutcomeTraceInput = {
  content: string;
  ruleId?: string;
  source?: string;
  layer?: string;
  mode?: string;
  streamed?: boolean;
};

export type AssistantWorkflowDegradedOutcomeTraceInput = {
  content: string;
  reason: string;
  source?: string;
  layer?: string;
  mode?: string;
  hasToolResults?: boolean;
  toolCount?: number;
  structuredBlockKinds?: string[];
  streamed?: boolean;
};

/**
 * The host's minimal direct-route identity. The core deliberately accepts
 * legacy trace metadata so applications can migrate outcome reporting before
 * their route registry is fully workflow-authored.
 */
export type AssistantWorkflowDirectRouteOutcomeTraceEntry = {
  layer: string;
  skipEvent?: string | null;
  traceRoute?: string | null;
  workflowInvocation?: AssistantWorkflowDirectRouteOutcomeRouteSource | null;
};

export type AssistantWorkflowDirectRouteOutcomeInput = {
  handled: boolean;
  content?: string;
  artifactKind?: string;
  payload?: unknown;
  reason?: string;
  delivery?: AssistantWorkflowOutcomeDelivery;
};

export function buildAssistantWorkflowFinalTextOutcomeTracePayload(
  input: AssistantWorkflowFinalTextOutcomeTraceInput,
): Record<string, unknown> {
  return buildAssistantWorkflowOutcomeTraceEventPayload({
    outcome: assistantWorkflowFinalText(input.content, input.delivery),
    source: input.source ?? "final_answer",
    layer: input.layer ?? "final_answer",
    metadata: {
      mode: input.mode ?? null,
      streamed: input.streamed ?? null,
    },
  });
}

export function buildAssistantWorkflowStructuredArtifactOutcomeTracePayload(
  input: AssistantWorkflowStructuredArtifactOutcomeTraceInput,
): Record<string, unknown> {
  return buildAssistantWorkflowOutcomeTraceEventPayload({
    outcome: assistantWorkflowStructuredArtifact(input.artifactKind, {}, input.content),
    source: input.source ?? "final_answer",
    layer: input.layer ?? "final_answer.structured_fast_path",
    metadata: {
      mode: input.mode ?? null,
      submode: input.submode ?? null,
      tool: input.tool ?? null,
      streamed: input.streamed ?? false,
    },
  });
}

export function buildAssistantWorkflowUnavailableOutcomeTracePayload(
  input: AssistantWorkflowUnavailableOutcomeTraceInput,
): Record<string, unknown> {
  return buildAssistantWorkflowOutcomeTraceEventPayload({
    outcome: assistantWorkflowUnavailable(input.artifactKind, input.reason, input.content),
    source: input.source ?? "tool_execution",
    layer: input.layer ?? "tool.unavailable",
    metadata: {
      mode: input.mode ?? null,
      tool: input.tool ?? null,
      blockedArtifactKinds: normalizeNonEmptyStrings(input.blockedArtifactKinds),
    },
  });
}

export function buildAssistantWorkflowClarificationOutcomeTracePayload(
  input: AssistantWorkflowClarificationOutcomeTraceInput,
): Record<string, unknown> {
  return buildAssistantWorkflowOutcomeTraceEventPayload({
    outcome: assistantWorkflowClarification(input.content, input.ruleId),
    source: input.source ?? "final_answer",
    layer: input.layer ?? "final_answer.clarification",
    metadata: {
      mode: input.mode ?? null,
      ruleId: input.ruleId ?? null,
      streamed: input.streamed ?? false,
    },
  });
}

export function buildAssistantWorkflowDegradedOutcomeTracePayload(
  input: AssistantWorkflowDegradedOutcomeTraceInput,
): Record<string, unknown> {
  return buildAssistantWorkflowOutcomeTraceEventPayload({
    outcome: assistantWorkflowDegraded(input.content, input.reason),
    source: input.source ?? "final_answer",
    layer: input.layer ?? "final_answer.degraded",
    metadata: {
      mode: input.mode ?? null,
      hasToolResults: input.hasToolResults ?? null,
      toolCount: input.toolCount ?? null,
      structuredBlockKinds: input.structuredBlockKinds ?? [],
      streamed: input.streamed ?? false,
    },
  });
}

export function getAssistantWorkflowDirectRouteOutcomeTraceRoute(
  entry: AssistantWorkflowDirectRouteOutcomeTraceEntry,
): string {
  return getAssistantWorkflowDirectRouteOutcomeRoute(
    entry.workflowInvocation,
    getAssistantWorkflowLegacyDirectRouteOutcomeTraceRoute(entry),
  );
}

export function buildAssistantWorkflowDirectRouteOutcome(
  entry: AssistantWorkflowDirectRouteOutcomeTraceEntry,
  input: AssistantWorkflowDirectRouteOutcomeInput,
): AssistantWorkflowOutcome {
  const fallbackRoute = getAssistantWorkflowLegacyDirectRouteOutcomeTraceRoute(entry);
  if (!input.handled) {
    return assistantWorkflowDirectRouteNotHandledFromInvocation(entry.workflowInvocation, {
      ...(input.reason ? { reason: input.reason } : {}),
      fallbackRoute,
    });
  }
  const options: AssistantWorkflowDirectRouteOutcomeOptions = {};
  if (input.content !== undefined) options.content = input.content;
  if (input.artifactKind !== undefined) options.artifactKind = input.artifactKind;
  if (input.payload !== undefined) options.payload = input.payload;
  if (input.reason !== undefined) options.reason = input.reason;
  if (input.delivery !== undefined) options.delivery = input.delivery;
  return assistantWorkflowDirectRouteFromInvocation(entry.workflowInvocation, {
    ...options,
    fallbackRoute,
  });
}

export function buildAssistantWorkflowDirectRouteOutcomeTracePayload(
  entry: AssistantWorkflowDirectRouteOutcomeTraceEntry,
  input: AssistantWorkflowDirectRouteOutcomeInput & {
    source?: string;
  },
): Record<string, unknown> {
  return buildAssistantWorkflowOutcomeTraceEventPayload({
    outcome: buildAssistantWorkflowDirectRouteOutcome(entry, input),
    ...(input.source !== undefined ? { source: input.source } : {}),
    layer: entry.layer,
    ...(entry.skipEvent !== undefined ? { skipEvent: entry.skipEvent } : {}),
  });
}

function getAssistantWorkflowLegacyDirectRouteOutcomeTraceRoute(
  entry: AssistantWorkflowDirectRouteOutcomeTraceEntry,
): string {
  const traceRoute = entry.traceRoute?.trim();
  if (traceRoute) return traceRoute;
  const skipRoute = parseAssistantWorkflowDirectRouteTraceStage(entry.skipEvent);
  if (skipRoute) return skipRoute.route;
  const directLayerRoute = /^direct_route\.(.+)$/.exec(entry.layer)?.[1];
  if (directLayerRoute?.trim()) return directLayerRoute.trim();
  return entry.layer.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function normalizeNonEmptyStrings(values: readonly string[] | undefined): string[] {
  if (!values?.length) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
