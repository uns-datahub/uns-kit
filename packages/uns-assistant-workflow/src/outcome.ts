export type AssistantWorkflowOutcome =
  | AssistantWorkflowNotHandledOutcome
  | AssistantWorkflowFinalTextOutcome
  | AssistantWorkflowClarificationOutcome
  | AssistantWorkflowStructuredArtifactOutcome
  | AssistantWorkflowUnavailableOutcome
  | AssistantWorkflowDirectRouteOutcome
  | AssistantWorkflowDegradedOutcome;

export type AssistantWorkflowOutcomeKind = AssistantWorkflowOutcome["kind"];

export type AssistantWorkflowOutcomeDelivery = "stream" | "return";

export type AssistantWorkflowNotHandledOutcome = {
  kind: "not_handled";
  reason?: string;
};

export type AssistantWorkflowFinalTextOutcome = {
  kind: "final_text";
  content: string;
  delivery?: AssistantWorkflowOutcomeDelivery;
};

export type AssistantWorkflowClarificationOutcome = {
  kind: "clarification";
  content: string;
  ruleId?: string;
};

export type AssistantWorkflowStructuredArtifactOutcome = {
  kind: "structured_artifact";
  artifactKind: string;
  payload: unknown;
  content?: string;
};

/**
 * A requested structured artifact cannot be produced from the available
 * runtime evidence. The reason is application-defined but must come from a
 * typed execution result, never inferred from final-answer prose.
 */
export type AssistantWorkflowUnavailableOutcome = {
  kind: "unavailable";
  artifactKind: string;
  reason: string;
  content?: string;
};

export type AssistantWorkflowDirectRouteOutcome = {
  kind: "direct_route";
  route: string;
  content?: string;
  payload?: unknown;
  artifactKind?: string;
  reason?: string;
  delivery?: AssistantWorkflowOutcomeDelivery;
};

export type AssistantWorkflowDirectRouteOutcomeOptions = {
  content?: string;
  payload?: unknown;
  artifactKind?: string;
  reason?: string;
  delivery?: AssistantWorkflowOutcomeDelivery;
};

export type AssistantWorkflowDirectRouteOutcomeRouteSource = {
  outcomeRoute?: string | null;
  routeId?: string | null;
};

export type AssistantWorkflowDirectRouteInvocationOutcomeOptions =
  AssistantWorkflowDirectRouteOutcomeOptions & {
    fallbackRoute?: string | null;
  };

export type AssistantWorkflowDirectRouteInvocationNotHandledOptions = {
  reason?: string;
  fallbackRoute?: string | null;
};

export type AssistantWorkflowDegradedOutcome = {
  kind: "degraded";
  content: string;
  reason: string;
};

export type AssistantWorkflowOutcomeSummary = {
  kind: AssistantWorkflowOutcomeKind;
  handled: boolean;
  contentChars: number;
  reason: string | null;
  delivery: AssistantWorkflowOutcomeDelivery | null;
  artifactKind: string | null;
  route: string | null;
};

export type AssistantWorkflowOutcomeTraceEventPayloadInput = {
  outcome: AssistantWorkflowOutcome;
  source?: string;
  layer?: string;
  skipEvent?: string | null;
  metadata?: Record<string, unknown>;
};

export function assistantWorkflowNotHandled(reason?: string): AssistantWorkflowNotHandledOutcome {
  const normalizedReason = normalizeOptionalString(reason);
  return normalizedReason ? { kind: "not_handled", reason: normalizedReason } : { kind: "not_handled" };
}

export function assistantWorkflowFinalText(
  content: string,
  delivery?: AssistantWorkflowOutcomeDelivery,
): AssistantWorkflowFinalTextOutcome {
  return {
    kind: "final_text",
    content,
    ...(delivery ? { delivery } : {}),
  };
}

export function assistantWorkflowClarification(
  content: string,
  ruleId?: string,
): AssistantWorkflowClarificationOutcome {
  const normalizedRuleId = normalizeOptionalString(ruleId);
  return {
    kind: "clarification",
    content,
    ...(normalizedRuleId ? { ruleId: normalizedRuleId } : {}),
  };
}

export function assistantWorkflowStructuredArtifact(
  artifactKind: string,
  payload: unknown,
  content?: string,
): AssistantWorkflowStructuredArtifactOutcome {
  const normalizedArtifactKind = normalizeRequiredString(artifactKind, "artifactKind");
  const normalizedContent = normalizeOptionalString(content);
  return {
    kind: "structured_artifact",
    artifactKind: normalizedArtifactKind,
    payload,
    ...(normalizedContent ? { content: normalizedContent } : {}),
  };
}

export function assistantWorkflowUnavailable(
  artifactKind: string,
  reason: string,
  content?: string,
): AssistantWorkflowUnavailableOutcome {
  const normalizedArtifactKind = normalizeRequiredString(artifactKind, "artifactKind");
  const normalizedReason = normalizeRequiredString(reason, "reason");
  const normalizedContent = normalizeOptionalString(content);
  return {
    kind: "unavailable",
    artifactKind: normalizedArtifactKind,
    reason: normalizedReason,
    ...(normalizedContent ? { content: normalizedContent } : {}),
  };
}

export function assistantWorkflowDirectRoute(
  route: string,
  options: AssistantWorkflowDirectRouteOutcomeOptions = {},
): AssistantWorkflowDirectRouteOutcome {
  const normalizedRoute = normalizeRequiredString(route, "route");
  const normalizedContent = normalizeOptionalString(options.content);
  const normalizedArtifactKind = normalizeOptionalString(options.artifactKind);
  const normalizedReason = normalizeOptionalString(options.reason);
  return {
    kind: "direct_route",
    route: normalizedRoute,
    ...(normalizedContent ? { content: normalizedContent } : {}),
    ...(options.payload !== undefined ? { payload: options.payload } : {}),
    ...(normalizedArtifactKind ? { artifactKind: normalizedArtifactKind } : {}),
    ...(normalizedReason ? { reason: normalizedReason } : {}),
    ...(options.delivery ? { delivery: options.delivery } : {}),
  };
}

export function getAssistantWorkflowDirectRouteOutcomeRoute(
  source: AssistantWorkflowDirectRouteOutcomeRouteSource | null | undefined,
  fallbackRoute?: string | null,
): string {
  const route =
    normalizeOptionalString(source?.outcomeRoute) ??
    normalizeOptionalString(source?.routeId) ??
    normalizeOptionalString(fallbackRoute);
  if (!route) {
    throw new Error("Assistant workflow direct route outcome route is required.");
  }
  return route;
}

export function assistantWorkflowDirectRouteFromInvocation(
  source: AssistantWorkflowDirectRouteOutcomeRouteSource | null | undefined,
  options: AssistantWorkflowDirectRouteInvocationOutcomeOptions = {},
): AssistantWorkflowDirectRouteOutcome {
  const { fallbackRoute, ...outcomeOptions } = options;
  return assistantWorkflowDirectRoute(
    getAssistantWorkflowDirectRouteOutcomeRoute(source, fallbackRoute),
    outcomeOptions,
  );
}

export function assistantWorkflowDirectRouteNotHandledFromInvocation(
  source: AssistantWorkflowDirectRouteOutcomeRouteSource | null | undefined,
  options: AssistantWorkflowDirectRouteInvocationNotHandledOptions = {},
): AssistantWorkflowNotHandledOutcome {
  const reason = normalizeOptionalString(options.reason);
  if (reason) return assistantWorkflowNotHandled(reason);
  const route = getAssistantWorkflowDirectRouteOutcomeRoute(source, options.fallbackRoute);
  return assistantWorkflowNotHandled(`${route}:not_handled`);
}

export function assistantWorkflowDegraded(content: string, reason: string): AssistantWorkflowDegradedOutcome {
  return {
    kind: "degraded",
    content,
    reason: normalizeRequiredString(reason, "reason"),
  };
}

export function isAssistantWorkflowHandledOutcome(outcome: AssistantWorkflowOutcome | null | undefined): boolean {
  return outcome !== null && outcome !== undefined && outcome.kind !== "not_handled";
}

export function summarizeAssistantWorkflowOutcome(
  outcome: AssistantWorkflowOutcome,
): AssistantWorkflowOutcomeSummary {
  return {
    kind: outcome.kind,
    handled: outcome.kind !== "not_handled",
    contentChars: getOutcomeContent(outcome).length,
    reason: getOutcomeReason(outcome),
    delivery: outcome.kind === "final_text" || outcome.kind === "direct_route"
      ? outcome.delivery ?? null
      : null,
    artifactKind: outcome.kind === "structured_artifact" || outcome.kind === "unavailable"
      ? outcome.artifactKind
      : outcome.kind === "direct_route"
        ? outcome.artifactKind ?? null
        : null,
    route: outcome.kind === "direct_route" ? outcome.route : null,
  };
}

export function buildAssistantWorkflowOutcomeTracePayload(
  outcome: AssistantWorkflowOutcome,
): Record<string, unknown> {
  return summarizeAssistantWorkflowOutcome(outcome);
}

export function buildAssistantWorkflowOutcomeTraceEventPayload(
  input: AssistantWorkflowOutcomeTraceEventPayloadInput,
): Record<string, unknown> {
  return {
    ...(input.source !== undefined ? { source: input.source } : {}),
    ...(input.layer !== undefined ? { layer: input.layer } : {}),
    ...(input.skipEvent !== undefined ? { skipEvent: input.skipEvent } : {}),
    ...(input.metadata ?? {}),
    ...buildAssistantWorkflowOutcomeTracePayload(input.outcome),
  };
}

function getOutcomeContent(outcome: AssistantWorkflowOutcome): string {
  switch (outcome.kind) {
    case "final_text":
    case "clarification":
    case "degraded":
      return outcome.content;
    case "structured_artifact":
    case "unavailable":
      return outcome.content ?? "";
    case "direct_route":
      return outcome.content ?? "";
    case "not_handled":
      return "";
  }
}

function getOutcomeReason(outcome: AssistantWorkflowOutcome): string | null {
  switch (outcome.kind) {
    case "not_handled":
      return outcome.reason ?? null;
    case "clarification":
      return outcome.ruleId ?? null;
    case "degraded":
      return outcome.reason;
    case "unavailable":
      return outcome.reason;
    case "direct_route":
      return outcome.reason ?? null;
    case "final_text":
    case "structured_artifact":
      return null;
  }
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeRequiredString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed.length) {
    throw new Error(`Assistant workflow outcome ${fieldName} is required.`);
  }
  return trimmed;
}
