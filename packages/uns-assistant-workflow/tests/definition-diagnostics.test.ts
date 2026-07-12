import { describe, expect, it } from "vitest";
import {
  defineAssistantWorkflow,
  validateAssistantWorkflowDefinition,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow definition diagnostics", () => {
  it("returns no diagnostics for a valid bound workflow", () => {
    const result = validateAssistantWorkflowDefinition(validWorkflow());

    expect(result).toEqual({
      valid: true,
      errorCount: 0,
      warningCount: 0,
      diagnostics: [],
    });
    expect(() => defineAssistantWorkflow(validWorkflow())).not.toThrow();
  });

  it("collects multiple definition errors without throwing", () => {
    const result = validateAssistantWorkflowDefinition({
      id: "",
      version: 0,
      intents: [{
        id: "Answer Docs",
        description: "",
        defaultPresentation: "card",
        requiredToolHints: ["missing_tool"],
        toolSelectionProfiles: [{
          id: "bad_profile",
          description: "",
          condition: {
            minHop: 2,
            maxHop: 1,
            selectedReason: "",
          },
          toolHints: ["missing_profile_tool"],
        }],
        planningStepProfiles: [{
          id: "bad_plan_profile",
          description: "",
          condition: {
            presentation: "",
            timeWindowHint: "",
            minConfidence: 0.9,
            maxConfidence: 0.5,
            requiredTools: [],
          },
          planningSteps: ["missing_profile_step"],
        }],
        memoryPolicy: { read: ["missing_slot"] },
        planningSteps: ["missing_step"],
        clarificationRules: ["missing_rule"],
      }],
      presentations: [],
      tools: [{
        name: "query_docs",
        provider: "mcp",
        effect: "read",
        sideEffectRisk: "low",
        cacheability: "request-scoped",
        retryClass: "bounded",
        outputKinds: [],
      }],
      toolBindings: [{
        name: "query_docs",
        provider: "http",
        method: "get" as never,
        path: "",
      }, {
        name: "orphan_tool",
        provider: "local-function",
        handlerId: "",
      }],
      memorySlots: [{
        id: "known_slot",
        description: "Known memory slot.",
        storage: "turn",
      }],
      planningSteps: [{
        id: "retrieve",
        description: "Retrieve docs.",
        kind: "retrieve",
        requiredToolHints: ["missing_tool"],
        readsMemory: ["missing_slot"],
      }],
      clarificationRules: [{
        id: "low_confidence",
        description: "Low confidence.",
        condition: "low_confidence",
        questionStyle: "confirm_intent",
        confidenceBelow: 2,
        readsMemory: ["missing_slot"],
      }],
    });

    expect(result.valid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(10);
    expect(result.warningCount).toBe(0);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "missing_workflow_id",
      "invalid_workflow_version",
      "unnormalized_id",
      "missing_description",
      "missing_tool_output_kinds",
      "missing_binding_field",
      "invalid_http_method",
      "binding_without_capability",
      "tool_provider_mismatch",
      "unknown_presentation",
      "unknown_tool_capability",
      "unknown_memory_slot",
      "unknown_planning_step",
      "unknown_clarification_rule",
      "invalid_confidence_threshold",
      "invalid_tool_selection_profile_condition",
      "invalid_planning_step_profile_condition",
    ]));
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "unknown_planning_step",
        severity: "error",
        path: "intents[0].planningSteps",
      }),
    ]));
  });

  it("reports duplicate and incomplete intent tool selection profiles", () => {
    const workflow = validWorkflow({
      intents: [{
        id: "answer_docs",
        description: "Answer docs.",
        defaultPresentation: "text",
        requiredToolHints: ["query_docs"],
        toolSelectionProfiles: [{
          id: "follow_up",
          description: "Follow-up retrieval.",
          toolHints: ["query_docs"],
        }, {
          id: "follow_up",
          description: "",
          toolHints: [],
        }],
        planningSteps: ["retrieve_docs"],
      }],
    });

    const result = validateAssistantWorkflowDefinition(workflow);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "duplicate_id",
        path: "intents[0].toolSelectionProfiles[1].id",
      }),
      expect.objectContaining({
        code: "missing_description",
        path: "intents[0].toolSelectionProfiles[1].description",
      }),
      expect.objectContaining({
        code: "missing_tool_hints",
        path: "intents[0].toolSelectionProfiles[1].toolHints",
      }),
    ]));
    expect(() => defineAssistantWorkflow(workflow)).toThrow(/Duplicate assistant workflow intent answer_docs tool selection profile: follow_up/);
  });

  it("reports duplicate and incomplete intent planning step profiles", () => {
    const workflow = validWorkflow({
      intents: [{
        id: "answer_docs",
        description: "Answer docs.",
        defaultPresentation: "text",
        requiredToolHints: ["query_docs"],
        planningSteps: ["retrieve_docs"],
        planningStepProfiles: [{
          id: "conditional_plan",
          description: "Conditional retrieval.",
          planningSteps: ["retrieve_docs"],
        }, {
          id: "conditional_plan",
          description: "",
          planningSteps: [],
        }],
      }],
    });

    const result = validateAssistantWorkflowDefinition(workflow);

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "duplicate_id",
        path: "intents[0].planningStepProfiles[1].id",
      }),
      expect.objectContaining({
        code: "missing_description",
        path: "intents[0].planningStepProfiles[1].description",
      }),
      expect.objectContaining({
        code: "unknown_planning_step",
        path: "intents[0].planningStepProfiles[1].planningSteps",
      }),
    ]));
    expect(() => defineAssistantWorkflow(workflow)).toThrow(/Duplicate assistant workflow intent answer_docs planning step profile: conditional_plan/);
  });

  it("warns when a tool capability has no binding", () => {
    const workflow = validWorkflow({
      tools: [{
        name: "query_docs",
        provider: "mcp",
        effect: "read",
        sideEffectRisk: "low",
        cacheability: "request-scoped",
        retryClass: "bounded",
        outputKinds: ["evidence"],
      }, {
        name: "list_docs",
        provider: "http",
        effect: "read",
        sideEffectRisk: "low",
        cacheability: "cacheable",
        retryClass: "safe",
        outputKinds: ["catalog"],
      }],
    });

    const result = validateAssistantWorkflowDefinition(workflow);

    expect(result).toMatchObject({
      valid: true,
      errorCount: 0,
      warningCount: 1,
      diagnostics: [{
        severity: "warning",
        code: "unbound_tool_capability",
        path: "tools[1].name",
      }],
    });
  });
});

function validWorkflow(
  overrides: Partial<AssistantWorkflowDefinition> = {},
): AssistantWorkflowDefinition {
  return {
    id: "diagnostics-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      planningSteps: ["retrieve_docs"],
    }],
    presentations: [{
      id: "text",
      description: "Text response.",
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
    }],
    ...overrides,
  };
}
