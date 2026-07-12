import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowClarificationOutcomeTracePayload,
  buildAssistantWorkflowDegradedOutcomeTracePayload,
  buildAssistantWorkflowDirectRouteOutcomeTracePayload,
  buildAssistantWorkflowFinalTextOutcomeTracePayload,
  buildAssistantWorkflowStructuredArtifactOutcomeTracePayload,
  buildAssistantWorkflowUnavailableOutcomeTracePayload,
  getAssistantWorkflowDirectRouteOutcomeTraceRoute,
} from "../src/index.js";

describe("assistant workflow outcome trace helpers", () => {
  it("builds final text outcome trace payloads", () => {
    expect(buildAssistantWorkflowFinalTextOutcomeTracePayload({
      content: "Done.",
      delivery: "stream",
      mode: "final",
      streamed: true,
    })).toEqual({
      source: "final_answer",
      layer: "final_answer",
      mode: "final",
      streamed: true,
      kind: "final_text",
      handled: true,
      contentChars: 5,
      reason: null,
      delivery: "stream",
      artifactKind: null,
      route: null,
    });
  });

  it("builds structured artifact outcome trace payloads", () => {
    expect(buildAssistantWorkflowStructuredArtifactOutcomeTracePayload({
      content: "chart block",
      artifactKind: "chart",
      mode: "structured",
      submode: "chart_json",
      tool: "render_chart",
    })).toEqual({
      source: "final_answer",
      layer: "final_answer.structured_fast_path",
      mode: "structured",
      submode: "chart_json",
      tool: "render_chart",
      streamed: false,
      kind: "structured_artifact",
      handled: true,
      contentChars: 11,
      reason: null,
      delivery: null,
      artifactKind: "chart",
      route: null,
    });
  });

  it("builds clarification and degraded outcome trace payloads", () => {
    expect(buildAssistantWorkflowClarificationOutcomeTracePayload({
      content: "Which source?",
      ruleId: "missing_source",
      mode: "clarify",
    })).toMatchObject({
      source: "final_answer",
      layer: "final_answer.clarification",
      mode: "clarify",
      ruleId: "missing_source",
      kind: "clarification",
      reason: "missing_source",
    });

    expect(buildAssistantWorkflowDegradedOutcomeTracePayload({
      content: "Partial answer.",
      reason: "tool_timeout",
      hasToolResults: true,
      toolCount: 2,
      structuredBlockKinds: ["table"],
    })).toMatchObject({
      source: "final_answer",
      layer: "final_answer.degraded",
      kind: "degraded",
      reason: "tool_timeout",
      hasToolResults: true,
      toolCount: 2,
      structuredBlockKinds: ["table"],
    });
  });

  it("builds typed unavailable outcome trace payloads", () => {
    expect(buildAssistantWorkflowUnavailableOutcomeTracePayload({
      artifactKind: "chart",
      reason: "no_series_data",
      blockedArtifactKinds: ["table", "chart", "table"],
      source: "tool_execution",
      layer: "tool.get_batch_comparison_chart",
      tool: "get_batch_comparison_chart",
    })).toMatchObject({
      source: "tool_execution",
      layer: "tool.get_batch_comparison_chart",
      tool: "get_batch_comparison_chart",
      kind: "unavailable",
      handled: true,
      reason: "no_series_data",
      artifactKind: "chart",
      blockedArtifactKinds: ["table", "chart"],
    });
  });

  it("derives direct-route outcome identities from workflow and legacy route metadata", () => {
    expect(getAssistantWorkflowDirectRouteOutcomeTraceRoute({
      layer: "direct_route.structured_view",
      traceRoute: "structured",
    })).toBe("structured");
    expect(getAssistantWorkflowDirectRouteOutcomeTraceRoute({
      layer: "direct_route.structured_view",
      skipEvent: "direct.structured.route.skip",
    })).toBe("structured");
    expect(getAssistantWorkflowDirectRouteOutcomeTraceRoute({
      layer: "direct_route.value_lookup",
      skipEvent: "direct.value.route.skip",
      workflowInvocation: { outcomeRoute: "latest_value", routeId: "value" },
    })).toBe("latest_value");
  });

  it("builds direct-route handled and fallthrough trace payloads", () => {
    const entry = {
      layer: "direct_route.structured_view",
      skipEvent: "direct.structured.route.skip",
    };
    expect(buildAssistantWorkflowDirectRouteOutcomeTracePayload(entry, {
      handled: true,
      reason: "handled",
      source: "direct_route_dispatch",
    })).toEqual({
      source: "direct_route_dispatch",
      layer: "direct_route.structured_view",
      skipEvent: "direct.structured.route.skip",
      kind: "direct_route",
      handled: true,
      contentChars: 0,
      reason: "handled",
      delivery: null,
      artifactKind: null,
      route: "structured",
    });
    expect(buildAssistantWorkflowDirectRouteOutcomeTracePayload(entry, {
      handled: false,
      reason: "runtime_policy_disabled",
    })).toMatchObject({
      layer: "direct_route.structured_view",
      kind: "not_handled",
      handled: false,
      reason: "runtime_policy_disabled",
    });
  });
});
