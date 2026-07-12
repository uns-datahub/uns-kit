import { describe, expect, it } from "vitest";

import {
  ASSISTANT_WORKFLOW_REPLAY_CANDIDATE_TRACE_STAGES,
  ASSISTANT_WORKFLOW_TRACE_STAGE,
  ASSISTANT_WORKFLOW_TRACE_STAGES,
  buildAssistantWorkflowDirectRouteTraceStage,
  isAssistantWorkflowDirectRouteTraceOutcome,
  isAssistantWorkflowReplayCandidateTraceStage,
  isAssistantWorkflowTraceStage,
  parseAssistantWorkflowDirectRouteTraceStage,
} from "../src/index.js";

describe("trace stages", () => {
  it("exports stable workflow trace stage names", () => {
    expect(ASSISTANT_WORKFLOW_TRACE_STAGE).toEqual({
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
    });
    expect(ASSISTANT_WORKFLOW_TRACE_STAGES).toContain("assistant_workflow.outcome");
  });

  it("identifies generic replay candidate stages", () => {
    expect(ASSISTANT_WORKFLOW_REPLAY_CANDIDATE_TRACE_STAGES).toEqual([
      "planner_classifier.workflow_decision",
      "tool_selection.workflow_comparison",
      "assistant_workflow.outcome",
      "assistant_workflow.memory_patch",
      "assistant_workflow.tool_binding_runtime",
      "thread.profile.updated",
    ]);
    expect(isAssistantWorkflowReplayCandidateTraceStage("tool_selection.workflow_comparison")).toBe(true);
    expect(isAssistantWorkflowReplayCandidateTraceStage("assistant_workflow.direct_route_policy")).toBe(false);
  });

  it("identifies known workflow trace stages", () => {
    expect(isAssistantWorkflowTraceStage("assistant_workflow.direct_route_policy")).toBe(true);
    expect(isAssistantWorkflowTraceStage("tool.call")).toBe(true);
    expect(isAssistantWorkflowTraceStage("tool.call.retry")).toBe(false);
  });

  it("builds and parses direct-route trace stages", () => {
    expect(buildAssistantWorkflowDirectRouteTraceStage(" structured ", "done")).toBe("direct.structured.route.done");
    expect(buildAssistantWorkflowDirectRouteTraceStage("structured", "ignored")).toBeNull();
    expect(isAssistantWorkflowDirectRouteTraceOutcome("recovered")).toBe(true);
    expect(parseAssistantWorkflowDirectRouteTraceStage("direct.instance_journey.route.skip")).toEqual({
      stage: "direct.instance_journey.route.skip",
      route: "instance_journey",
      outcome: "skip",
    });
    expect(parseAssistantWorkflowDirectRouteTraceStage("direct..route.done")).toBeNull();
    expect(parseAssistantWorkflowDirectRouteTraceStage("assistant_workflow.outcome")).toBeNull();
  });
});
