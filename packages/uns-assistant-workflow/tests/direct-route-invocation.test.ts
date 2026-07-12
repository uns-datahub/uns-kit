import { describe, expect, it } from "vitest";

import {
  buildAssistantWorkflowDirectRouteExecutionDecision,
  buildAssistantWorkflowDirectRouteExecutionDecisionTracePayload,
  buildAssistantWorkflowDirectRouteHandlerDecision,
  buildAssistantWorkflowDirectRouteHandlerDecisionTracePayload,
  buildAssistantWorkflowDirectRouteHandlerPlanDecision,
  buildAssistantWorkflowDirectRouteHandlerPlanDecisionTracePayload,
  buildAssistantWorkflowDirectRouteInvocation,
  buildAssistantWorkflowDirectRouteInvocationPolicyTracePayload,
  buildAssistantWorkflowDirectRouteInvocationTracePayload,
  buildAssistantWorkflowDirectRouteStrategyDecision,
  buildAssistantWorkflowDirectRouteStrategyDecisionTracePayload,
  buildAssistantWorkflowDirectRouteToolDecision,
  buildAssistantWorkflowDirectRouteToolDecisionTracePayload,
  defineAssistantWorkflow,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "test-workflow",
  version: 2,
  description: "Test workflow.",
  intents: [{
    id: "answer_docs",
    description: "Answer from docs.",
    directRoutes: ["docs_answer"],
  }],
  tools: [],
  directRoutes: [{
    id: "docs_answer",
    description: "Answer directly from cached evidence.",
    effect: "read",
    outcomeRoute: "docs_answer",
    requiredToolHints: ["query_docs"],
    strategies: [{
      id: "cached_evidence",
      description: "Use cached evidence.",
      requiredToolHints: ["query_docs"],
    }],
  }],
});

describe("direct route invocation", () => {
  it("builds a ready invocation from an intent-owned route", () => {
    const invocation = buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });

    expect(invocation).toEqual({
      workflowId: "test-workflow",
      workflowVersion: 2,
      intentId: "answer_docs",
      routeId: "docs_answer",
      status: "ready",
      enabled: true,
      reason: "enabled",
      policyRouteIds: ["docs_answer"],
      effect: "read",
      outcomeRoute: "docs_answer",
      requiredToolHints: ["query_docs"],
      strategyIds: ["cached_evidence"],
      strategies: [{
        id: "cached_evidence",
        requiredToolHints: ["query_docs"],
      }],
    });
    expect(buildAssistantWorkflowDirectRouteInvocationTracePayload(invocation)).toMatchObject({
      workflowId: "test-workflow",
      workflowVersion: 2,
      intent: "answer_docs",
      route: "docs_answer",
      status: "ready",
      enabled: true,
      effect: "read",
      outcomeRoute: "docs_answer",
      requiredToolHints: ["query_docs"],
      strategyIds: ["cached_evidence"],
      strategies: [{
        id: "cached_evidence",
        requiredToolHints: ["query_docs"],
      }],
    });
    expect(buildAssistantWorkflowDirectRouteInvocationPolicyTracePayload(invocation)).toEqual({
      intent: "answer_docs",
      route: "docs_answer",
      enabled: true,
      reason: "enabled",
      policyRouteIds: ["docs_answer"],
    });
  });

  it("keeps route metadata when runtime policy disables an otherwise valid route", () => {
    expect(buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: false,
    })).toMatchObject({
      intentId: "answer_docs",
      routeId: "docs_answer",
      status: "disabled",
      enabled: false,
      reason: "runtime_disabled",
      policyRouteIds: ["docs_answer"],
      effect: "read",
      outcomeRoute: "docs_answer",
      requiredToolHints: ["query_docs"],
    });
  });

  it("supports catalog-scoped route invocations", () => {
    expect(buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      routeId: "docs_answer",
      runtimeEnabled: true,
      policyScope: "catalog",
    })).toMatchObject({
      intentId: null,
      routeId: "docs_answer",
      status: "ready",
      enabled: true,
      reason: "enabled",
      policyRouteIds: ["docs_answer"],
    });
  });

  it("marks undeclared routes as missing-route", () => {
    expect(buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "missing_route",
      runtimeEnabled: true,
    })).toMatchObject({
      intentId: "answer_docs",
      routeId: "missing_route",
      status: "missing-route",
      enabled: false,
      reason: "route_not_declared",
      policyRouteIds: ["docs_answer"],
      effect: null,
      outcomeRoute: null,
      requiredToolHints: [],
      strategyIds: [],
      strategies: [],
    });
  });

  it("builds execution decisions from invocation, route, and observed intent", () => {
    const invocation = buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });

    const ready = buildAssistantWorkflowDirectRouteExecutionDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
    });
    const routeMismatch = buildAssistantWorkflowDirectRouteExecutionDecision({
      invocation,
      expectedRouteId: "other_route",
      observedIntentId: "answer_docs",
    });
    const intentMismatch = buildAssistantWorkflowDirectRouteExecutionDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "other_intent",
    });
    const disabled = buildAssistantWorkflowDirectRouteExecutionDecision({
      invocation: buildAssistantWorkflowDirectRouteInvocation({
        workflow: WORKFLOW,
        intentId: "answer_docs",
        routeId: "docs_answer",
        runtimeEnabled: false,
      }),
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
    });

    expect(ready).toMatchObject({
      execute: true,
      reason: "ready",
      routeId: "docs_answer",
      expectedRouteId: "docs_answer",
      intentId: "answer_docs",
      observedIntentId: "answer_docs",
      invocationStatus: "ready",
      enabled: true,
    });
    expect(buildAssistantWorkflowDirectRouteExecutionDecisionTracePayload(ready)).toMatchObject({
      execute: true,
      reason: "ready",
      route: "docs_answer",
      expectedRoute: "docs_answer",
      intent: "answer_docs",
      observedIntent: "answer_docs",
    });
    expect(routeMismatch).toMatchObject({ execute: false, reason: "route_mismatch" });
    expect(intentMismatch).toMatchObject({ execute: false, reason: "intent_mismatch" });
    expect(disabled).toMatchObject({
      execute: false,
      reason: "invocation_not_ready",
      invocationStatus: "disabled",
      enabled: false,
    });
  });

  it("builds strategy decisions from declared route strategies", () => {
    const invocation = buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });
    const readyExecution = buildAssistantWorkflowDirectRouteExecutionDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
    });

    const ready = buildAssistantWorkflowDirectRouteStrategyDecision({
      invocation,
      strategyId: "cached_evidence",
      routeExecution: readyExecution,
    });
    const missing = buildAssistantWorkflowDirectRouteStrategyDecision({
      invocation,
      routeExecution: readyExecution,
    });
    const undeclared = buildAssistantWorkflowDirectRouteStrategyDecision({
      invocation,
      strategyId: "other_strategy",
      routeExecution: readyExecution,
    });
    const routeNotExecutable = buildAssistantWorkflowDirectRouteStrategyDecision({
      invocation,
      strategyId: "cached_evidence",
      routeExecution: buildAssistantWorkflowDirectRouteExecutionDecision({
        invocation,
        expectedRouteId: "other_route",
        observedIntentId: "answer_docs",
      }),
    });

    expect(ready).toMatchObject({
      execute: true,
      reason: "ready",
      routeId: "docs_answer",
      strategyId: "cached_evidence",
      declaredStrategyIds: ["cached_evidence"],
      routeExecutionReason: "ready",
    });
    expect(buildAssistantWorkflowDirectRouteStrategyDecisionTracePayload(ready)).toMatchObject({
      execute: true,
      reason: "ready",
      route: "docs_answer",
      strategy: "cached_evidence",
      declaredStrategies: ["cached_evidence"],
      routeExecutionReason: "ready",
    });
    expect(missing).toMatchObject({ execute: false, reason: "strategy_missing" });
    expect(undeclared).toMatchObject({ execute: false, reason: "strategy_not_declared" });
    expect(routeNotExecutable).toMatchObject({
      execute: false,
      reason: "route_not_executable",
      routeExecutionReason: "route_mismatch",
    });
  });

  it("builds tool decisions from route and strategy tool hints", () => {
    const invocation = buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });
    const routeExecution = buildAssistantWorkflowDirectRouteExecutionDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
    });
    const strategyDecision = buildAssistantWorkflowDirectRouteStrategyDecision({
      invocation,
      strategyId: "cached_evidence",
      routeExecution,
    });

    const ready = buildAssistantWorkflowDirectRouteToolDecision({
      invocation,
      toolName: "query_docs",
      routeExecution,
      strategyDecision,
    });
    const missing = buildAssistantWorkflowDirectRouteToolDecision({
      invocation,
      routeExecution,
      strategyDecision,
    });
    const disallowed = buildAssistantWorkflowDirectRouteToolDecision({
      invocation,
      toolName: "other_tool",
      routeExecution,
      strategyDecision,
    });
    const strategyBlocked = buildAssistantWorkflowDirectRouteToolDecision({
      invocation,
      toolName: "query_docs",
      routeExecution,
      strategyDecision: buildAssistantWorkflowDirectRouteStrategyDecision({
        invocation,
        strategyId: "other_strategy",
        routeExecution,
      }),
    });

    expect(ready).toMatchObject({
      execute: true,
      reason: "ready",
      routeId: "docs_answer",
      strategyId: "cached_evidence",
      toolName: "query_docs",
      allowedToolHints: ["query_docs"],
      routeExecutionReason: "ready",
      strategyReason: "ready",
    });
    expect(buildAssistantWorkflowDirectRouteToolDecisionTracePayload(ready)).toMatchObject({
      execute: true,
      reason: "ready",
      route: "docs_answer",
      strategy: "cached_evidence",
      tool: "query_docs",
      allowedTools: ["query_docs"],
      routeExecutionReason: "ready",
      strategyReason: "ready",
    });
    expect(missing).toMatchObject({ execute: false, reason: "tool_missing" });
    expect(disallowed).toMatchObject({ execute: false, reason: "tool_not_allowed" });
    expect(strategyBlocked).toMatchObject({
      execute: false,
      reason: "strategy_not_executable",
      strategyReason: "strategy_not_declared",
    });
  });

  it("combines route, strategy, and tool authorization for a direct handler", () => {
    const invocation = buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });

    const ready = buildAssistantWorkflowDirectRouteHandlerDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
      strategyId: "cached_evidence",
      toolName: "query_docs",
    });
    const deniedTool = buildAssistantWorkflowDirectRouteHandlerDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
      strategyId: "cached_evidence",
      toolName: "get_attribute_data_view",
    });
    const deniedRoute = buildAssistantWorkflowDirectRouteHandlerDecision({
      invocation,
      expectedRouteId: "other_route",
      observedIntentId: "answer_docs",
      strategyId: "cached_evidence",
      toolName: "query_docs",
    });
    const deniedStrategy = buildAssistantWorkflowDirectRouteHandlerDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
      strategyId: "other_strategy",
      toolName: "query_docs",
    });

    expect(ready).toMatchObject({
      execute: true,
      reason: "ready",
      routeExecution: { execute: true, reason: "ready" },
      strategyDecision: { execute: true, strategyId: "cached_evidence" },
      toolDecision: { execute: true, toolName: "query_docs" },
    });
    expect(buildAssistantWorkflowDirectRouteHandlerDecisionTracePayload(ready)).toMatchObject({
      execute: true,
      reason: "ready",
      routeExecution: { route: "docs_answer", execute: true },
      strategyDecision: { strategy: "cached_evidence", execute: true },
      toolDecision: { tool: "query_docs", execute: true },
    });
    expect(deniedTool).toMatchObject({
      execute: false,
      reason: "tool_not_executable",
      toolDecision: { execute: false, reason: "tool_not_allowed", toolName: "get_attribute_data_view" },
    });
    expect(deniedRoute).toMatchObject({
      execute: false,
      reason: "route_not_executable",
      routeExecution: { execute: false, reason: "route_mismatch" },
      strategyDecision: null,
      toolDecision: null,
    });
    expect(deniedStrategy).toMatchObject({
      execute: false,
      reason: "strategy_not_executable",
      strategyDecision: { execute: false, reason: "strategy_not_declared" },
      toolDecision: null,
    });
  });

  it("requires every declared tool before a multi-tool direct-route plan can run", () => {
    const invocation = buildAssistantWorkflowDirectRouteInvocation({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });

    const ready = buildAssistantWorkflowDirectRouteHandlerPlanDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
      strategyId: "cached_evidence",
      toolNames: ["query_docs", "query_docs"],
    });
    const denied = buildAssistantWorkflowDirectRouteHandlerPlanDecision({
      invocation,
      expectedRouteId: "docs_answer",
      observedIntentId: "answer_docs",
      strategyId: "cached_evidence",
      toolNames: ["query_docs", "get_attribute_data_view"],
    });

    expect(ready).toMatchObject({
      execute: true,
      reason: "ready",
      toolDecisions: [
        { execute: true, toolName: "query_docs" },
        { execute: true, toolName: "query_docs" },
      ],
    });
    expect(buildAssistantWorkflowDirectRouteHandlerPlanDecisionTracePayload(ready)).toMatchObject({
      execute: true,
      toolDecisions: [
        { execute: true, tool: "query_docs" },
        { execute: true, tool: "query_docs" },
      ],
    });
    expect(denied).toMatchObject({
      execute: false,
      reason: "tool_not_executable",
      toolDecisions: [
        { execute: true, toolName: "query_docs" },
        { execute: false, reason: "tool_not_allowed", toolName: "get_attribute_data_view" },
      ],
    });
  });
});
