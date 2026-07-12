import {
  buildAssistantWorkflowDirectRouteRuntimeDecision,
  type AssistantWorkflowDirectRouteRuntimeDecision,
  type AssistantWorkflowDirectRouteRuntimeDecisionScope,
} from "./direct-route-policy.js";
import {
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowDirectRouteDefinition,
} from "./definition.js";

export type AssistantWorkflowDirectRouteInvocationStatus =
  | "ready"
  | "disabled"
  | "missing-route";

export type AssistantWorkflowDirectRouteStrategyInvocation = {
  id: string;
  requiredToolHints: string[];
};

export type AssistantWorkflowDirectRouteInvocation = {
  workflowId: string;
  workflowVersion: number;
  intentId: string | null;
  routeId: string;
  status: AssistantWorkflowDirectRouteInvocationStatus;
  enabled: boolean;
  reason: AssistantWorkflowDirectRouteRuntimeDecision["reason"];
  policyRouteIds: string[];
  effect: AssistantWorkflowDirectRouteDefinition["effect"] | null;
  outcomeRoute: string | null;
  requiredToolHints: string[];
  strategyIds: string[];
  strategies: AssistantWorkflowDirectRouteStrategyInvocation[];
};

export type AssistantWorkflowDirectRouteExecutionDecisionReason =
  | "ready"
  | "invocation_not_ready"
  | "route_mismatch"
  | "intent_mismatch";

export type AssistantWorkflowDirectRouteExecutionDecision = {
  execute: boolean;
  reason: AssistantWorkflowDirectRouteExecutionDecisionReason;
  routeId: string;
  expectedRouteId: string | null;
  intentId: string | null;
  observedIntentId: string | null;
  invocationStatus: AssistantWorkflowDirectRouteInvocationStatus;
  enabled: boolean;
};

export type AssistantWorkflowDirectRouteStrategyDecisionReason =
  | "ready"
  | "route_not_executable"
  | "strategy_missing"
  | "strategy_not_declared";

export type AssistantWorkflowDirectRouteStrategyDecision = {
  execute: boolean;
  reason: AssistantWorkflowDirectRouteStrategyDecisionReason;
  routeId: string;
  strategyId: string | null;
  declaredStrategyIds: string[];
  routeExecutionReason: AssistantWorkflowDirectRouteExecutionDecisionReason;
  invocationStatus: AssistantWorkflowDirectRouteInvocationStatus;
  enabled: boolean;
};

export type AssistantWorkflowDirectRouteToolDecisionReason =
  | "ready"
  | "route_not_executable"
  | "strategy_not_executable"
  | "tool_missing"
  | "tool_not_allowed";

export type AssistantWorkflowDirectRouteToolDecision = {
  execute: boolean;
  reason: AssistantWorkflowDirectRouteToolDecisionReason;
  routeId: string;
  strategyId: string | null;
  toolName: string | null;
  allowedToolHints: string[];
  routeRequiredToolHints: string[];
  strategyRequiredToolHints: string[];
  routeExecutionReason: AssistantWorkflowDirectRouteExecutionDecisionReason;
  strategyReason: AssistantWorkflowDirectRouteStrategyDecisionReason | null;
  invocationStatus: AssistantWorkflowDirectRouteInvocationStatus;
  enabled: boolean;
};

/**
 * The complete workflow authorization result for a concrete direct-route
 * handler. Route planners remain domain-specific, while this contract keeps
 * route, strategy, and tool authorization together at the execution boundary.
 */
export type AssistantWorkflowDirectRouteHandlerDecision = {
  execute: boolean;
  reason:
    | "ready"
    | "route_not_executable"
    | "strategy_not_executable"
    | "tool_not_executable";
  routeExecution: AssistantWorkflowDirectRouteExecutionDecision;
  strategyDecision: AssistantWorkflowDirectRouteStrategyDecision | null;
  toolDecision: AssistantWorkflowDirectRouteToolDecision | null;
};

/**
 * Authorization result for a direct-route strategy that needs several tools.
 * Every listed tool must be declared by the selected route/strategy before a
 * controller-local handler can begin executing its domain-specific plan.
 */
export type AssistantWorkflowDirectRouteHandlerPlanDecision = {
  execute: boolean;
  reason:
    | "ready"
    | "route_not_executable"
    | "strategy_not_executable"
    | "tool_not_executable";
  routeExecution: AssistantWorkflowDirectRouteExecutionDecision;
  strategyDecision: AssistantWorkflowDirectRouteStrategyDecision | null;
  toolDecisions: AssistantWorkflowDirectRouteToolDecision[];
};

export type AssistantWorkflowDirectRouteInvocationInput = {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  routeId: unknown;
  runtimeEnabled: boolean;
  intentId?: unknown;
  policyScope?: AssistantWorkflowDirectRouteRuntimeDecisionScope;
};

export function buildAssistantWorkflowDirectRouteInvocation(
  input: AssistantWorkflowDirectRouteInvocationInput,
): AssistantWorkflowDirectRouteInvocation {
  const routeId = normalizeAssistantWorkflowId(input.routeId) ?? "";
  const route = findDirectRoute(input.workflow, routeId);
  const decision = buildAssistantWorkflowDirectRouteRuntimeDecision({
    workflow: input.workflow,
    routeId,
    runtimeEnabled: input.runtimeEnabled,
    ...(input.intentId !== undefined ? { intentId: input.intentId } : {}),
    ...(input.policyScope ? { policyScope: input.policyScope } : {}),
  });
  const status: AssistantWorkflowDirectRouteInvocationStatus =
    !route ? "missing-route" : decision.enabled ? "ready" : "disabled";

  return {
    workflowId: input.workflow.id,
    workflowVersion: input.workflow.version,
    intentId: decision.intentId,
    routeId,
    status,
    enabled: decision.enabled,
    reason: decision.reason,
    policyRouteIds: [...decision.policyRouteIds],
    effect: route?.effect ?? null,
    outcomeRoute: route?.outcomeRoute ?? null,
    requiredToolHints: [...(route?.requiredToolHints ?? [])],
    strategyIds: (route?.strategies ?? []).map((strategy) => strategy.id),
    strategies: (route?.strategies ?? []).map((strategy) => ({
      id: strategy.id,
      requiredToolHints: [...(strategy.requiredToolHints ?? [])],
    })),
  };
}

export function buildAssistantWorkflowDirectRouteInvocationTracePayload(
  invocation: AssistantWorkflowDirectRouteInvocation,
): Record<string, unknown> {
  return {
    workflowId: invocation.workflowId,
    workflowVersion: invocation.workflowVersion,
    intent: invocation.intentId,
    route: invocation.routeId,
    status: invocation.status,
    enabled: invocation.enabled,
    reason: invocation.reason,
    policyRouteIds: invocation.policyRouteIds,
    effect: invocation.effect,
    outcomeRoute: invocation.outcomeRoute,
    requiredToolHints: invocation.requiredToolHints,
    strategyIds: invocation.strategyIds,
    strategies: invocation.strategies,
  };
}

export function buildAssistantWorkflowDirectRouteInvocationPolicyTracePayload(
  invocation: AssistantWorkflowDirectRouteInvocation,
): Record<string, unknown> {
  return {
    intent: invocation.intentId,
    route: invocation.routeId,
    enabled: invocation.enabled,
    reason: invocation.reason,
    policyRouteIds: [...invocation.policyRouteIds],
  };
}

export function buildAssistantWorkflowDirectRouteExecutionDecision(input: {
  invocation: AssistantWorkflowDirectRouteInvocation;
  expectedRouteId?: unknown;
  observedIntentId?: unknown;
  requireIntentMatch?: boolean;
}): AssistantWorkflowDirectRouteExecutionDecision {
  const expectedRouteId = normalizeAssistantWorkflowId(input.expectedRouteId) ?? null;
  const observedIntentId = normalizeAssistantWorkflowId(input.observedIntentId) ?? null;
  const requireIntentMatch = input.requireIntentMatch ?? input.invocation.intentId !== null;
  const base = {
    routeId: input.invocation.routeId,
    expectedRouteId,
    intentId: input.invocation.intentId,
    observedIntentId,
    invocationStatus: input.invocation.status,
    enabled: input.invocation.enabled,
  };

  if (input.invocation.status !== "ready" || !input.invocation.enabled) {
    return { ...base, execute: false, reason: "invocation_not_ready" };
  }
  if (expectedRouteId && input.invocation.routeId !== expectedRouteId) {
    return { ...base, execute: false, reason: "route_mismatch" };
  }
  if (requireIntentMatch && input.invocation.intentId !== null && observedIntentId !== input.invocation.intentId) {
    return { ...base, execute: false, reason: "intent_mismatch" };
  }
  return { ...base, execute: true, reason: "ready" };
}

export function buildAssistantWorkflowDirectRouteExecutionDecisionTracePayload(
  decision: AssistantWorkflowDirectRouteExecutionDecision,
): Record<string, unknown> {
  return {
    execute: decision.execute,
    reason: decision.reason,
    route: decision.routeId,
    expectedRoute: decision.expectedRouteId,
    intent: decision.intentId,
    observedIntent: decision.observedIntentId,
    invocationStatus: decision.invocationStatus,
    enabled: decision.enabled,
  };
}

export function buildAssistantWorkflowDirectRouteStrategyDecision(input: {
  invocation: AssistantWorkflowDirectRouteInvocation;
  strategyId?: unknown;
  routeExecution?: AssistantWorkflowDirectRouteExecutionDecision;
}): AssistantWorkflowDirectRouteStrategyDecision {
  const strategyId = normalizeAssistantWorkflowId(input.strategyId) ?? null;
  const routeExecution = input.routeExecution ?? buildAssistantWorkflowDirectRouteExecutionDecision({
    invocation: input.invocation,
  });
  const base = {
    routeId: input.invocation.routeId,
    strategyId,
    declaredStrategyIds: [...input.invocation.strategyIds],
    routeExecutionReason: routeExecution.reason,
    invocationStatus: input.invocation.status,
    enabled: input.invocation.enabled,
  };

  if (!routeExecution.execute) {
    return { ...base, execute: false, reason: "route_not_executable" };
  }
  if (!strategyId) {
    return { ...base, execute: false, reason: "strategy_missing" };
  }
  if (!input.invocation.strategyIds.includes(strategyId)) {
    return { ...base, execute: false, reason: "strategy_not_declared" };
  }
  return { ...base, execute: true, reason: "ready" };
}

export function buildAssistantWorkflowDirectRouteStrategyDecisionTracePayload(
  decision: AssistantWorkflowDirectRouteStrategyDecision,
): Record<string, unknown> {
  return {
    execute: decision.execute,
    reason: decision.reason,
    route: decision.routeId,
    strategy: decision.strategyId,
    declaredStrategies: decision.declaredStrategyIds,
    routeExecutionReason: decision.routeExecutionReason,
    invocationStatus: decision.invocationStatus,
    enabled: decision.enabled,
  };
}

export function buildAssistantWorkflowDirectRouteToolDecision(input: {
  invocation: AssistantWorkflowDirectRouteInvocation;
  toolName?: unknown;
  routeExecution?: AssistantWorkflowDirectRouteExecutionDecision;
  strategyDecision?: AssistantWorkflowDirectRouteStrategyDecision | null;
}): AssistantWorkflowDirectRouteToolDecision {
  const toolName = normalizeAssistantWorkflowId(input.toolName) ?? null;
  const routeExecution = input.routeExecution ?? buildAssistantWorkflowDirectRouteExecutionDecision({
    invocation: input.invocation,
  });
  const strategyDecision = input.strategyDecision ?? null;
  const strategy = strategyDecision?.strategyId
    ? findInvocationStrategy(input.invocation, strategyDecision.strategyId)
    : null;
  const strategyRequiredToolHints = strategy?.requiredToolHints ?? [];
  const routeRequiredToolHints = [...input.invocation.requiredToolHints];
  const allowedToolHints = normalizeToolHints(
    strategyRequiredToolHints.length > 0 ? strategyRequiredToolHints : routeRequiredToolHints,
  );
  const base = {
    routeId: input.invocation.routeId,
    strategyId: strategyDecision?.strategyId ?? null,
    toolName,
    allowedToolHints,
    routeRequiredToolHints,
    strategyRequiredToolHints,
    routeExecutionReason: routeExecution.reason,
    strategyReason: strategyDecision?.reason ?? null,
    invocationStatus: input.invocation.status,
    enabled: input.invocation.enabled,
  };

  if (!routeExecution.execute) {
    return { ...base, execute: false, reason: "route_not_executable" };
  }
  if (strategyDecision && !strategyDecision.execute) {
    return { ...base, execute: false, reason: "strategy_not_executable" };
  }
  if (!toolName) {
    return { ...base, execute: false, reason: "tool_missing" };
  }
  if (!allowedToolHints.includes(toolName)) {
    return { ...base, execute: false, reason: "tool_not_allowed" };
  }
  return { ...base, execute: true, reason: "ready" };
}

export function buildAssistantWorkflowDirectRouteHandlerDecision(input: {
  invocation: AssistantWorkflowDirectRouteInvocation;
  expectedRouteId: unknown;
  observedIntentId?: unknown;
  requireIntentMatch?: boolean;
  strategyId?: unknown;
  toolName?: unknown;
}): AssistantWorkflowDirectRouteHandlerDecision {
  const routeExecution = buildAssistantWorkflowDirectRouteExecutionDecision({
    invocation: input.invocation,
    expectedRouteId: input.expectedRouteId,
    ...(input.observedIntentId !== undefined ? { observedIntentId: input.observedIntentId } : {}),
    ...(input.requireIntentMatch !== undefined ? { requireIntentMatch: input.requireIntentMatch } : {}),
  });
  if (!routeExecution.execute) {
    return {
      execute: false,
      reason: "route_not_executable",
      routeExecution,
      strategyDecision: null,
      toolDecision: null,
    };
  }

  const strategyDecision = input.strategyId === undefined
    ? null
    : buildAssistantWorkflowDirectRouteStrategyDecision({
      invocation: input.invocation,
      strategyId: input.strategyId,
      routeExecution,
    });
  if (strategyDecision && !strategyDecision.execute) {
    return {
      execute: false,
      reason: "strategy_not_executable",
      routeExecution,
      strategyDecision,
      toolDecision: null,
    };
  }

  const toolDecision = input.toolName === undefined
    ? null
    : buildAssistantWorkflowDirectRouteToolDecision({
      invocation: input.invocation,
      toolName: input.toolName,
      routeExecution,
      ...(strategyDecision ? { strategyDecision } : {}),
    });
  if (toolDecision && !toolDecision.execute) {
    return {
      execute: false,
      reason: "tool_not_executable",
      routeExecution,
      strategyDecision,
      toolDecision,
    };
  }

  return {
    execute: true,
    reason: "ready",
    routeExecution,
    strategyDecision,
    toolDecision,
  };
}

export function buildAssistantWorkflowDirectRouteHandlerPlanDecision(input: {
  invocation: AssistantWorkflowDirectRouteInvocation;
  expectedRouteId: unknown;
  observedIntentId?: unknown;
  requireIntentMatch?: boolean;
  strategyId?: unknown;
  toolNames?: readonly unknown[];
}): AssistantWorkflowDirectRouteHandlerPlanDecision {
  const handler = buildAssistantWorkflowDirectRouteHandlerDecision({
    invocation: input.invocation,
    expectedRouteId: input.expectedRouteId,
    ...(input.observedIntentId !== undefined ? { observedIntentId: input.observedIntentId } : {}),
    ...(input.requireIntentMatch !== undefined ? { requireIntentMatch: input.requireIntentMatch } : {}),
    ...(input.strategyId !== undefined ? { strategyId: input.strategyId } : {}),
  });
  if (!handler.execute) {
    return {
      execute: false,
      reason: handler.reason,
      routeExecution: handler.routeExecution,
      strategyDecision: handler.strategyDecision,
      toolDecisions: [],
    };
  }

  const toolDecisions = (input.toolNames ?? []).map((toolName) =>
    buildAssistantWorkflowDirectRouteToolDecision({
      invocation: input.invocation,
      toolName,
      routeExecution: handler.routeExecution,
      ...(handler.strategyDecision ? { strategyDecision: handler.strategyDecision } : {}),
    })
  );
  if (toolDecisions.some((decision) => !decision.execute)) {
    return {
      execute: false,
      reason: "tool_not_executable",
      routeExecution: handler.routeExecution,
      strategyDecision: handler.strategyDecision,
      toolDecisions,
    };
  }

  return {
    execute: true,
    reason: "ready",
    routeExecution: handler.routeExecution,
    strategyDecision: handler.strategyDecision,
    toolDecisions,
  };
}

export function buildAssistantWorkflowDirectRouteHandlerDecisionTracePayload(
  decision: AssistantWorkflowDirectRouteHandlerDecision,
): Record<string, unknown> {
  return {
    execute: decision.execute,
    reason: decision.reason,
    routeExecution: buildAssistantWorkflowDirectRouteExecutionDecisionTracePayload(decision.routeExecution),
    strategyDecision: decision.strategyDecision
      ? buildAssistantWorkflowDirectRouteStrategyDecisionTracePayload(decision.strategyDecision)
      : null,
    toolDecision: decision.toolDecision
      ? buildAssistantWorkflowDirectRouteToolDecisionTracePayload(decision.toolDecision)
      : null,
  };
}

export function buildAssistantWorkflowDirectRouteHandlerPlanDecisionTracePayload(
  decision: AssistantWorkflowDirectRouteHandlerPlanDecision,
): Record<string, unknown> {
  return {
    execute: decision.execute,
    reason: decision.reason,
    routeExecution: buildAssistantWorkflowDirectRouteExecutionDecisionTracePayload(decision.routeExecution),
    strategyDecision: decision.strategyDecision
      ? buildAssistantWorkflowDirectRouteStrategyDecisionTracePayload(decision.strategyDecision)
      : null,
    toolDecisions: decision.toolDecisions.map(buildAssistantWorkflowDirectRouteToolDecisionTracePayload),
  };
}

export function buildAssistantWorkflowDirectRouteToolDecisionTracePayload(
  decision: AssistantWorkflowDirectRouteToolDecision,
): Record<string, unknown> {
  return {
    execute: decision.execute,
    reason: decision.reason,
    route: decision.routeId,
    strategy: decision.strategyId,
    tool: decision.toolName,
    allowedTools: decision.allowedToolHints,
    routeRequiredTools: decision.routeRequiredToolHints,
    strategyRequiredTools: decision.strategyRequiredToolHints,
    routeExecutionReason: decision.routeExecutionReason,
    strategyReason: decision.strategyReason,
    invocationStatus: decision.invocationStatus,
    enabled: decision.enabled,
  };
}

function findDirectRoute(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  routeId: string,
): AssistantWorkflowDirectRouteDefinition | null {
  if (!routeId) return null;
  return workflow.directRoutes?.find((route) => route.id === routeId) ?? null;
}

function findInvocationStrategy(
  invocation: AssistantWorkflowDirectRouteInvocation,
  strategyId: string,
): AssistantWorkflowDirectRouteStrategyInvocation | null {
  return (invocation.strategies ?? []).find((strategy) => strategy.id === strategyId) ?? null;
}

function normalizeToolHints(values: readonly string[]): string[] {
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
