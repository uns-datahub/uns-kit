import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDecision,
  buildAssistantWorkflowPlan,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow planning", () => {
  it("adds conditional planning steps from matching profiles", () => {
    const workflow = defineAssistantWorkflow(workflowDefinition());

    const plan = buildAssistantWorkflowPlan(
      workflow,
      "history_lookup",
      ["get_attribute_data_view", "get_instance_journey"],
      {
        presentation: "chart",
        timeWindowHint: "last_event",
        toolsToExpose: ["get_attribute_data_view", "get_instance_journey"],
        confidence: 0.91,
      },
    );

    expect(plan).toMatchObject({
      stepIds: ["classify_intent", "fetch_history", "fetch_instance_journey", "synthesize_answer"],
      activePlanningStepProfileIds: ["last_event_context"],
      profileStepIds: ["fetch_instance_journey"],
      toolHints: ["get_attribute_data_view", "get_instance_journey"],
      requiredToolHints: ["get_attribute_data_view", "get_instance_journey"],
      missingPlanningSteps: [],
    });
  });

  it("keeps conditional planning steps inactive when context does not match", () => {
    const workflow = defineAssistantWorkflow(workflowDefinition());

    const plan = buildAssistantWorkflowPlan(
      workflow,
      "history_lookup",
      ["get_attribute_data_view", "get_instance_journey"],
      {
        presentation: "chart",
        timeWindowHint: "last_hour",
        toolsToExpose: ["get_attribute_data_view", "get_instance_journey"],
        confidence: 0.91,
      },
    );

    expect(plan).toMatchObject({
      stepIds: ["classify_intent", "fetch_history", "synthesize_answer"],
      activePlanningStepProfileIds: [],
      profileStepIds: [],
      toolHints: ["get_attribute_data_view"],
      requiredToolHints: ["get_attribute_data_view"],
    });
  });

  it("passes classifier context from decisions into conditional planning", () => {
    const workflow = defineAssistantWorkflow(workflowDefinition());

    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "history_lookup",
        presentation: "chart",
        timeWindowHint: "last_event",
        toolsToExpose: ["get_attribute_data_view", "get_instance_journey"],
        confidence: 0.91,
        entities: {},
      },
      ["get_attribute_data_view", "get_instance_journey"],
    );

    expect(decision.plan).toMatchObject({
      activePlanningStepProfileIds: ["last_event_context"],
      profileStepIds: ["fetch_instance_journey"],
      stepIds: ["classify_intent", "fetch_history", "fetch_instance_journey", "synthesize_answer"],
    });
  });
});

function workflowDefinition(): AssistantWorkflowDefinition {
  return {
    id: "planning-profile-agent",
    version: 1,
    intents: [{
      id: "history_lookup",
      description: "Fetch history.",
      defaultPresentation: "chart",
      planningSteps: ["classify_intent", "fetch_history", "synthesize_answer"],
      planningStepProfiles: [{
        id: "last_event_context",
        description: "Fetch lifecycle context when the history window is anchored to the latest event.",
        condition: {
          presentation: "chart",
          timeWindowHint: "last_event",
          minConfidence: 0.7,
          requiredTools: ["get_attribute_data_view", "get_instance_journey"],
        },
        planningSteps: ["fetch_instance_journey"],
      }],
    }],
    presentations: [{ id: "chart", description: "Chart." }],
    tools: [{
      name: "get_attribute_data_view",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["chart"],
    }, {
      name: "get_instance_journey",
      provider: "local-function",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["table"],
    }],
    planningSteps: [{
      id: "classify_intent",
      description: "Classify.",
      kind: "classify",
    }, {
      id: "fetch_history",
      description: "Fetch history.",
      kind: "fetch",
      requiredToolHints: ["get_attribute_data_view"],
      toolHints: ["get_attribute_data_view"],
    }, {
      id: "fetch_instance_journey",
      description: "Fetch lifecycle context.",
      kind: "fetch",
      requiredToolHints: ["get_instance_journey"],
      toolHints: ["get_instance_journey"],
    }, {
      id: "synthesize_answer",
      description: "Synthesize.",
      kind: "synthesize",
    }],
  };
}
