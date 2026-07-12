import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionDiff,
  buildAssistantWorkflowDefinitionDiffTracePayload,
  defineAssistantWorkflow,
} from "../src/index.js";

describe("assistant workflow definition diff", () => {
  it("summarizes workflow-level and per-intent definition changes", () => {
    const before = defineAssistantWorkflow({
      id: "support-agent",
      version: 1,
      intents: [{
        id: "answer_docs",
        description: "Answer from docs.",
        toolHints: ["query_docs"],
        planningSteps: ["retrieve_docs"],
      }],
      tools: [{
        name: "query_docs",
        provider: "local-function",
        effect: "read",
        sideEffectRisk: "low",
        cacheability: "request-scoped",
        retryClass: "safe",
        outputKinds: ["evidence"],
      }],
      directRoutes: [{
        id: "structured_view",
        description: "Structured view route.",
        effect: "read",
        outcomeRoute: "structured",
        strategies: [{
          id: "explicit_path",
          description: "Resolve an explicit path.",
        }],
      }],
      planningSteps: [{
        id: "retrieve_docs",
        description: "Retrieve docs.",
        kind: "retrieve",
      }],
    });
    const after = defineAssistantWorkflow({
      ...before,
      version: 2,
      intents: [{
        id: "answer_docs",
        description: "Answer from docs.",
        toolHints: ["query_docs", "list_sources"],
        requiredToolHints: ["query_docs"],
        planningSteps: ["retrieve_docs", "list_sources_step"],
        toolSelectionProfiles: [{
          id: "follow_up_retrieval",
          description: "Expose source listing on follow-up turns.",
          condition: { minHop: 1 },
          toolHints: ["list_sources"],
        }],
        planningStepProfiles: [{
          id: "source_listing_plan",
          description: "List sources when the classifier asks for that tool.",
          condition: { requiredTools: ["list_sources"] },
          planningSteps: ["list_sources_step"],
        }],
      }],
      tools: [
        ...(before.tools ?? []),
        {
          name: "list_sources",
          provider: "local-function",
          effect: "read",
          sideEffectRisk: "low",
          cacheability: "cacheable",
          retryClass: "safe",
          outputKinds: ["catalog"],
        },
      ],
      planningSteps: [
        ...(before.planningSteps ?? []),
        {
          id: "list_sources_step",
          description: "List sources.",
          kind: "retrieve",
        },
      ],
      directRoutes: [{
        ...(before.directRoutes?.[0] as NonNullable<typeof before.directRoutes>[number]),
        strategies: [
          ...(before.directRoutes?.[0]?.strategies ?? []),
          {
            id: "last_event_interval",
            description: "Resolve a latest event interval.",
          },
        ],
      }],
    });

    const diff = buildAssistantWorkflowDefinitionDiff(before, after);

    expect(diff).toMatchObject({
      fromWorkflowId: "support-agent",
      toWorkflowId: "support-agent",
      fromVersion: 1,
      toVersion: 2,
      changed: true,
      versionChanged: true,
      addedToolNames: ["list_sources"],
      directRouteDiffs: [{
        routeId: "structured_view",
        addedStrategyIds: ["last_event_interval"],
        changed: true,
      }],
      addedPlanningStepIds: ["list_sources_step"],
      intentDiffs: [{
        intentId: "answer_docs",
        addedToolHints: ["list_sources"],
        addedRequiredToolHints: ["query_docs"],
        addedPlanningSteps: ["list_sources_step"],
        addedToolSelectionProfileIds: ["follow_up_retrieval"],
        addedPlanningStepProfileIds: ["source_listing_plan"],
        changed: true,
      }],
    });
    expect(buildAssistantWorkflowDefinitionDiffTracePayload(diff)).toMatchObject({
      changed: true,
      intentDiffs: [{
        intentId: "answer_docs",
        addedToolHints: ["list_sources"],
        addedToolSelectionProfileIds: ["follow_up_retrieval"],
        addedPlanningStepProfileIds: ["source_listing_plan"],
      }],
      directRouteDiffs: [{
        routeId: "structured_view",
        addedStrategyIds: ["last_event_interval"],
      }],
    });
  });

  it("reports unchanged definitions", () => {
    const workflow = defineAssistantWorkflow({
      id: "support-agent",
      version: 1,
      intents: [{ id: "answer_docs", description: "Answer from docs." }],
    });

    expect(buildAssistantWorkflowDefinitionDiff(workflow, workflow)).toMatchObject({
      changed: false,
      versionChanged: false,
      intentDiffs: [],
    });
  });
});
