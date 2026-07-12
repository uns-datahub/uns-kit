import { describe, expect, it } from "vitest";
import {
  assistantWorkflowClarification,
  assistantWorkflowDegraded,
  assistantWorkflowDirectRoute,
  assistantWorkflowDirectRouteFromInvocation,
  assistantWorkflowDirectRouteNotHandledFromInvocation,
  assistantWorkflowFinalText,
  assistantWorkflowNotHandled,
  assistantWorkflowStructuredArtifact,
  assistantWorkflowUnavailable,
  buildAssistantWorkflowOutcomeTraceEventPayload,
  buildAssistantWorkflowOutcomeTracePayload,
  getAssistantWorkflowDirectRouteOutcomeRoute,
  isAssistantWorkflowHandledOutcome,
  summarizeAssistantWorkflowOutcome,
} from "../src/index.js";

describe("assistant workflow outcomes", () => {
  it("summarizes handled and unhandled text outcomes", () => {
    const notHandled = assistantWorkflowNotHandled("no route matched");
    const finalText = assistantWorkflowFinalText("Done.", "stream");

    expect(isAssistantWorkflowHandledOutcome(notHandled)).toBe(false);
    expect(isAssistantWorkflowHandledOutcome(finalText)).toBe(true);
    expect(summarizeAssistantWorkflowOutcome(notHandled)).toEqual({
      kind: "not_handled",
      handled: false,
      contentChars: 0,
      reason: "no route matched",
      delivery: null,
      artifactKind: null,
      route: null,
    });
    expect(summarizeAssistantWorkflowOutcome(finalText)).toEqual({
      kind: "final_text",
      handled: true,
      contentChars: 5,
      reason: null,
      delivery: "stream",
      artifactKind: null,
      route: null,
    });
  });

  it("represents clarification, structured artifact, unavailable, and degraded outcomes", () => {
    expect(buildAssistantWorkflowOutcomeTracePayload(
      assistantWorkflowClarification("Which source?", "missing_source_scope"),
    )).toEqual({
      kind: "clarification",
      handled: true,
      contentChars: 13,
      reason: "missing_source_scope",
      delivery: null,
      artifactKind: null,
      route: null,
    });

    expect(summarizeAssistantWorkflowOutcome(
      assistantWorkflowStructuredArtifact("table", { rows: 2 }, "Here is the table."),
    )).toEqual({
      kind: "structured_artifact",
      handled: true,
      contentChars: 18,
      reason: null,
      delivery: null,
      artifactKind: "table",
      route: null,
    });

    expect(summarizeAssistantWorkflowOutcome(
      assistantWorkflowUnavailable("chart", "no_series_data"),
    )).toEqual({
      kind: "unavailable",
      handled: true,
      contentChars: 0,
      reason: "no_series_data",
      delivery: null,
      artifactKind: "chart",
      route: null,
    });

    expect(summarizeAssistantWorkflowOutcome(
      assistantWorkflowDegraded("Partial answer.", "tool_timeout"),
    )).toEqual({
      kind: "degraded",
      handled: true,
      contentChars: 15,
      reason: "tool_timeout",
      delivery: null,
      artifactKind: null,
      route: null,
    });
  });

  it("represents handled direct-route outcomes with route evidence", () => {
    const outcome = assistantWorkflowDirectRoute("value", {
      content: "Latest value is 42.",
      artifactKind: "value_card",
      payload: { topic: "factory/line-1/temperature" },
      reason: "attribute_intent",
      delivery: "return",
    });

    expect(outcome).toMatchObject({
      kind: "direct_route",
      route: "value",
      artifactKind: "value_card",
      payload: { topic: "factory/line-1/temperature" },
    });
    expect(isAssistantWorkflowHandledOutcome(outcome)).toBe(true);
    expect(buildAssistantWorkflowOutcomeTracePayload(outcome)).toEqual({
      kind: "direct_route",
      handled: true,
      contentChars: 19,
      reason: "attribute_intent",
      delivery: "return",
      artifactKind: "value_card",
      route: "value",
    });
  });

  it("builds direct-route outcomes from invocation route metadata", () => {
    const invocation = {
      outcomeRoute: "latest_value",
      routeId: "value",
    };

    expect(getAssistantWorkflowDirectRouteOutcomeRoute(invocation, "legacy_value")).toBe("latest_value");
    expect(getAssistantWorkflowDirectRouteOutcomeRoute({ routeId: "value" }, "legacy_value")).toBe("value");
    expect(getAssistantWorkflowDirectRouteOutcomeRoute(null, "legacy_value")).toBe("legacy_value");
    expect(buildAssistantWorkflowOutcomeTracePayload(
      assistantWorkflowDirectRouteFromInvocation(invocation, {
        content: "Latest value is 42.",
        reason: "handled",
        delivery: "return",
      }),
    )).toEqual({
      kind: "direct_route",
      handled: true,
      contentChars: 19,
      reason: "handled",
      delivery: "return",
      artifactKind: null,
      route: "latest_value",
    });
    expect(buildAssistantWorkflowOutcomeTracePayload(
      assistantWorkflowDirectRouteNotHandledFromInvocation({ routeId: "value" }),
    )).toMatchObject({
      kind: "not_handled",
      handled: false,
      reason: "value:not_handled",
    });
    expect(buildAssistantWorkflowOutcomeTracePayload(
      assistantWorkflowDirectRouteNotHandledFromInvocation({ routeId: "value" }, { reason: "runtime_disabled" }),
    )).toMatchObject({
      kind: "not_handled",
      handled: false,
      reason: "runtime_disabled",
    });
  });

  it("builds trace-event payloads with adapter context", () => {
    expect(buildAssistantWorkflowOutcomeTraceEventPayload({
      outcome: assistantWorkflowStructuredArtifact("chart", { series: 1 }, "chart block"),
      source: "final_answer",
      layer: "post_hop.structured_fast_path",
      metadata: {
        mode: "structured_tool_output",
        tool: "get_attribute_data_view",
        kind: "metadata_must_not_override_outcome",
      },
    })).toEqual({
      source: "final_answer",
      layer: "post_hop.structured_fast_path",
      mode: "structured_tool_output",
      tool: "get_attribute_data_view",
      kind: "structured_artifact",
      handled: true,
      contentChars: 11,
      reason: null,
      delivery: null,
      artifactKind: "chart",
      route: null,
    });
  });

  it("rejects required blank outcome fields", () => {
    expect(() => assistantWorkflowStructuredArtifact(" ", {}))
      .toThrow("Assistant workflow outcome artifactKind is required.");
    expect(() => assistantWorkflowDegraded("Partial answer.", " "))
      .toThrow("Assistant workflow outcome reason is required.");
    expect(() => assistantWorkflowUnavailable("chart", " "))
      .toThrow("Assistant workflow outcome reason is required.");
    expect(() => assistantWorkflowDirectRoute(" "))
      .toThrow("Assistant workflow outcome route is required.");
    expect(() => getAssistantWorkflowDirectRouteOutcomeRoute(null))
      .toThrow("Assistant workflow direct route outcome route is required.");
  });
});
