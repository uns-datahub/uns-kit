import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowSerializedDefinitionTuningBatch,
  parseAssistantWorkflowSerializedDefinitionTuningSuggestion,
  parseAssistantWorkflowSerializedDefinitionTuningSuggestionLines,
  runAssistantWorkflowDefinitionTuningReplayLines,
  serializeAssistantWorkflowDefinitionTuningSuggestion,
  stringifyAssistantWorkflowDefinitionTuningSuggestionLines,
  stringifyAssistantWorkflowSerializedDefinitionTuningSuggestionLines,
  type AssistantWorkflowDefinitionTuningSuggestion,
} from "../src/index.js";

describe("assistant workflow definition tuning JSON", () => {
  it("serializes and parses tuning suggestions", () => {
    const serialized = serializeAssistantWorkflowDefinitionTuningSuggestion(addHintSuggestion);

    expect(serialized).toMatchObject({
      schemaVersion: 1,
      id: "add_intent_tool_hint:answer_docs:list_sources",
      action: "add_intent_tool_hint",
      patchPreview: {
        kind: "append_intent_tool_hint",
        intentId: "answer_docs",
        toolName: "list_sources",
      },
    });
    expect(parseAssistantWorkflowSerializedDefinitionTuningSuggestion(serialized)).toEqual(serialized);
  });

  it("serializes and parses direct-route strategy patch previews", () => {
    const serialized = serializeAssistantWorkflowDefinitionTuningSuggestion(addDirectRouteStrategySuggestion);

    expect(serialized).toMatchObject({
      schemaVersion: 1,
      id: "add_direct_route_strategy:structured_view:last_event_interval",
      action: "add_direct_route_strategy",
      patchPreview: {
        kind: "append_direct_route_strategy",
        routeId: "structured_view",
        strategyId: "last_event_interval",
      },
    });
    expect(parseAssistantWorkflowSerializedDefinitionTuningSuggestion(serialized)).toEqual(serialized);
  });

  it("parses tuning suggestion NDJSON and preserves line errors", () => {
    const serializedLines = stringifyAssistantWorkflowSerializedDefinitionTuningSuggestionLines(
      [addHintSuggestion].map(serializeAssistantWorkflowDefinitionTuningSuggestion),
    );
    const input = [
      stringifyAssistantWorkflowDefinitionTuningSuggestionLines([addHintSuggestion]),
      "{bad json",
      JSON.stringify({ schemaVersion: 1, id: "bad" }),
      "",
    ].join("\n");

    expect(serializedLines).toBe(stringifyAssistantWorkflowDefinitionTuningSuggestionLines([addHintSuggestion]));

    expect(parseAssistantWorkflowSerializedDefinitionTuningSuggestionLines(input)).toMatchObject({
      lineCount: 3,
      suggestionCount: 1,
      errorCount: 2,
      errors: [
        { lineNumber: 2, reason: "invalid_json" },
        { lineNumber: 3, reason: "invalid_definition_tuning_suggestion" },
      ],
    });
  });

  it("builds batch summaries and can keep only applicable suggestions", () => {
    const all = [addHintSuggestion, reviewOnlySuggestion]
      .map(serializeAssistantWorkflowDefinitionTuningSuggestion);

    expect(buildAssistantWorkflowSerializedDefinitionTuningBatch(all, {
      generatedAt: "2026-06-29T10:00:00.000Z",
      onlyApplicable: true,
    })).toMatchObject({
      sourceSuggestionCount: 2,
      suggestionCount: 1,
      summary: {
        sourceSuggestionCount: 2,
        suggestionCount: 1,
        applicableSuggestionCount: 1,
        reviewOnlySuggestionCount: 0,
        actionCounts: [{ key: "add_intent_tool_hint", count: 1 }],
        patchKindCounts: [{ key: "append_intent_tool_hint", count: 1 }],
      },
    });
  });

  it("replays tuning suggestion lines into parse and batch payloads", () => {
    const result = runAssistantWorkflowDefinitionTuningReplayLines({
      suggestionLines: stringifyAssistantWorkflowDefinitionTuningSuggestionLines([
        addHintSuggestion,
        reviewOnlySuggestion,
      ]),
    }, {
      onlyApplicable: true,
    });

    expect(result).toMatchObject({
      parseErrorCount: 0,
      suggestionParse: {
        lineCount: 2,
        suggestionCount: 2,
      },
      batch: {
        sourceSuggestionCount: 2,
        suggestionCount: 1,
      },
    });
  });
});

const addHintSuggestion: AssistantWorkflowDefinitionTuningSuggestion = {
  id: "add_intent_tool_hint:answer_docs:list_sources",
  action: "add_intent_tool_hint",
  severity: "info",
  intentId: "answer_docs",
  toolName: "list_sources",
  signal: null,
  count: 3,
  requestIds: ["req-1", "req-2"],
  sourceSuggestionIds: ["review_unmodeled_selected_tool:answer_docs:list_sources"],
  rationale: "Trace selected list_sources for answer_docs.",
  suggestedAction: "Add a safe tool hint.",
  patchPreview: {
    kind: "append_intent_tool_hint",
    intentId: "answer_docs",
    toolName: "list_sources",
  },
};

const reviewOnlySuggestion: AssistantWorkflowDefinitionTuningSuggestion = {
  id: "review_tool_selection_policy:other:list_sources",
  action: "review_tool_selection_policy",
  severity: "info",
  intentId: "other",
  toolName: "list_sources",
  signal: null,
  count: 2,
  requestIds: ["req-3"],
  sourceSuggestionIds: ["review_unmodeled_selected_tool:other:list_sources"],
  rationale: "Fallback intent needs review.",
  suggestedAction: "Review policy manually.",
  patchPreview: { kind: "none" },
};

const addDirectRouteStrategySuggestion: AssistantWorkflowDefinitionTuningSuggestion = {
  id: "add_direct_route_strategy:structured_view:last_event_interval",
  action: "add_direct_route_strategy",
  severity: "info",
  intentId: "structured_view",
  toolName: null,
  signal: "structured:last_event_interval",
  count: 2,
  requestIds: ["req-4"],
  sourceSuggestionIds: ["review_direct_route_strategy:structured_view:structured_last_event_interval"],
  rationale: "Trace observed last_event_interval for structured_view.",
  suggestedAction: "Add strategy metadata after review.",
  patchPreview: {
    kind: "append_direct_route_strategy",
    routeId: "structured_view",
    strategyId: "last_event_interval",
    description: "Observed runtime strategy last_event_interval for direct route structured_view.",
  },
};
