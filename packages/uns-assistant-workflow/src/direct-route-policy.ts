import {
  findAssistantWorkflowIntent,
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowDirectRouteDefinition,
} from "./definition.js";

export type AssistantWorkflowDirectRoutePolicy = {
  intentId: string | null;
  routeIds: string[];
  routes: AssistantWorkflowDirectRouteDefinition[];
  missingRouteIds: string[];
};

export type AssistantWorkflowDirectRouteRuntimeDecision = {
  intentId: string | null;
  routeId: string;
  enabled: boolean;
  reason: "enabled" | "runtime_disabled" | "intent_not_found" | "route_not_declared";
  policyRouteIds: string[];
};

export type AssistantWorkflowDirectRouteRuntimeDecisionScope = "intent" | "catalog";

export function buildAssistantWorkflowDirectRoutePolicy(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
): AssistantWorkflowDirectRoutePolicy {
  const normalizedIntentId = normalizeAssistantWorkflowId(intentId);
  const intent = findAssistantWorkflowIntent(workflow, normalizedIntentId);
  const routeIds = uniqueStrings(intent?.directRoutes ?? []);
  const routesById = new Map((workflow.directRoutes ?? []).map((route) => [route.id, route] as const));
  const routes = routeIds.flatMap((routeId) => {
    const route = routesById.get(routeId);
    return route ? [route] : [];
  });
  const missingRouteIds = routeIds.filter((routeId) => !routesById.has(routeId));

  return {
    intentId: intent?.id ?? normalizedIntentId,
    routeIds,
    routes,
    missingRouteIds,
  };
}

export function buildAssistantWorkflowDirectRouteRuntimeDecision(input: {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  intentId?: unknown;
  routeId: unknown;
  runtimeEnabled: boolean;
  policyScope?: AssistantWorkflowDirectRouteRuntimeDecisionScope;
}): AssistantWorkflowDirectRouteRuntimeDecision {
  const routeId = normalizeAssistantWorkflowId(input.routeId) ?? "";
  if (input.policyScope === "catalog") {
    const routeIds = new Set((input.workflow.directRoutes ?? []).map((route) => route.id));
    if (!routeId || !routeIds.has(routeId)) {
      return {
        intentId: null,
        routeId,
        enabled: false,
        reason: "route_not_declared",
        policyRouteIds: [],
      };
    }
    if (!input.runtimeEnabled) {
      return {
        intentId: null,
        routeId,
        enabled: false,
        reason: "runtime_disabled",
        policyRouteIds: [routeId],
      };
    }
    return {
      intentId: null,
      routeId,
      enabled: true,
      reason: "enabled",
      policyRouteIds: [routeId],
    };
  }
  const policy = buildAssistantWorkflowDirectRoutePolicy(input.workflow, input.intentId);
  if (!policy.intentId || !findAssistantWorkflowIntent(input.workflow, policy.intentId)) {
    return {
      intentId: policy.intentId,
      routeId,
      enabled: false,
      reason: "intent_not_found",
      policyRouteIds: policy.routeIds,
    };
  }
  if (!routeId || !policy.routeIds.includes(routeId)) {
    return {
      intentId: policy.intentId,
      routeId,
      enabled: false,
      reason: "route_not_declared",
      policyRouteIds: policy.routeIds,
    };
  }
  if (!input.runtimeEnabled) {
    return {
      intentId: policy.intentId,
      routeId,
      enabled: false,
      reason: "runtime_disabled",
      policyRouteIds: policy.routeIds,
    };
  }
  return {
    intentId: policy.intentId,
    routeId,
    enabled: true,
    reason: "enabled",
    policyRouteIds: policy.routeIds,
  };
}

export function buildAssistantWorkflowDirectRouteRuntimeDecisionTracePayload(
  decision: AssistantWorkflowDirectRouteRuntimeDecision,
): Record<string, unknown> {
  return {
    intent: decision.intentId,
    route: decision.routeId,
    enabled: decision.enabled,
    reason: decision.reason,
    policyRouteIds: decision.policyRouteIds,
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeAssistantWorkflowId(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
