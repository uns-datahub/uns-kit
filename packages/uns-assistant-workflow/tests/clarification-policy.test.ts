import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowClarificationPolicy,
  buildAssistantWorkflowClarificationRuntimeComparison,
  defineAssistantWorkflow,
  findAssistantWorkflowClarificationRule,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "clarification-test-agent",
  version: 1,
  intents: [
    {
      id: "chart",
      description: "Chart a scoped measurement.",
      clarificationRules: ["low_confidence", "missing_scope", "ambiguous_scope", "resolver_ambiguous_scope"],
    },
    {
      id: "docs",
      description: "Answer from documents.",
      clarificationRules: ["missing_docs_scope"],
    },
  ],
  memorySlots: [
    {
      id: "pending_clarification",
      description: "Pending clarification marker.",
      storage: "thread-state",
    },
  ],
  clarificationRules: [
    {
      id: "low_confidence",
      description: "Confirm low-confidence requests.",
      condition: "low_confidence",
      questionStyle: "confirm_intent",
      blocksExecution: true,
      priority: 10,
      confidenceBelow: 0.55,
      writesMemory: ["pending_clarification"],
    },
    {
      id: "missing_scope",
      description: "Ask for a missing data scope.",
      condition: "missing_required_entity",
      questionStyle: "ask_scope",
      blocksExecution: true,
      priority: 20,
      requiredEntityKinds: ["full_topic_path", "container", "attribute"],
    },
    {
      id: "ambiguous_scope",
      description: "Ask the user to pick among multiple data scopes.",
      condition: "multiple_entity_candidates",
      questionStyle: "choose_entity",
      blocksExecution: true,
      priority: 30,
      satisfiedByResolvedScope: true,
      requiredEntityKinds: ["full_topic_path", "container", "attribute"],
    },
    {
      id: "resolver_ambiguous_scope",
      description: "Ask the user to pick when the deterministic resolver returns several concrete scopes.",
      condition: "resolver_candidates_ambiguous",
      questionStyle: "choose_entity",
      blocksExecution: true,
      priority: 30,
    },
    {
      id: "missing_docs_scope",
      description: "Ask for document source scope.",
      condition: "missing_required_entity",
      questionStyle: "ask_scope",
      blocksExecution: false,
      priority: 20,
      requiredEntityKinds: ["full_topic_path"],
    },
  ],
});

describe("assistant workflow clarification policy", () => {
  it("resolves and evaluates blocking clarification rules", () => {
    expect(findAssistantWorkflowClarificationRule(WORKFLOW, " low_confidence ")?.condition)
      .toBe("low_confidence");

    const policy = buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", {
      confidence: 0.4,
      entities: {
        fullTopicPaths: ["factory/line-1/temperature"],
      },
    });

    expect(policy.ruleIds).toEqual(["low_confidence", "missing_scope", "ambiguous_scope", "resolver_ambiguous_scope"]);
    expect(policy.suggestedRuleIds).toEqual(["low_confidence"]);
    expect(policy.blockingRuleIds).toEqual(["low_confidence"]);
    expect(policy.needsClarification).toBe(true);
  });

  it("keeps non-blocking clarification pressure visible", () => {
    const policy = buildAssistantWorkflowClarificationPolicy(WORKFLOW, "docs", {
      confidence: 0.9,
      entities: {
        fullTopicPaths: [],
      },
    });

    expect(policy.suggestedRuleIds).toEqual(["missing_docs_scope"]);
    expect(policy.blockingRuleIds).toEqual([]);
    expect(policy.needsClarification).toBe(false);
  });

  it("distinguishes resolver ambiguity from multiple explicit entities", () => {
    const policy = buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", {
      confidence: 0.9,
      entities: {
        containers: ["factory/line-1"],
        attributes: ["temperature"],
      },
      resolverCandidatesAmbiguous: true,
    });

    expect(policy.suggestedRuleIds).toEqual(["resolver_ambiguous_scope"]);
    expect(policy.blockingRuleIds).toEqual(["resolver_ambiguous_scope"]);
    expect(policy.reasons).toEqual(["resolver returned multiple concrete scope candidates"]);
  });

  it("lets a host-provided resolved scope satisfy only opt-in scope rules", () => {
    const input = {
      confidence: 0.9,
      entities: {
        containers: ["factory/line-1", "factory/line-2"],
      },
    };

    expect(buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", input)).toMatchObject({
      blockingRuleIds: ["ambiguous_scope"],
      suggestedRuleIds: ["ambiguous_scope"],
      resolvedScope: false,
    });

    const resolved = buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", {
      ...input,
      resolvedScope: true,
    });
    expect(resolved).toMatchObject({
      blockingRuleIds: [],
      suggestedRuleIds: [],
      resolvedScope: true,
    });
    expect(resolved.rules).toContainEqual(expect.objectContaining({
      id: "ambiguous_scope",
      satisfiedByResolvedScope: true,
    }));

    expect(buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", {
      ...input,
      confidence: 0.4,
      resolvedScope: true,
    }).blockingRuleIds).toEqual(["low_confidence"]);
  });

  it("compares observed runtime clarifications to workflow policy rules", () => {
    const policy = buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", {
      confidence: 0.9,
      entities: {
        attributes: ["temperature", "pressure"],
      },
    });

    expect(buildAssistantWorkflowClarificationRuntimeComparison(policy, {
      produced: true,
      ruleId: "attribute_disambiguation",
      source: "final_answer",
      layer: "in_hop.disambiguation_clarification",
    }, {
      equivalentRuleIds: {
        attribute_disambiguation: ["ambiguous_scope"],
      },
    })).toEqual({
      expectedRuleIds: ["ambiguous_scope"],
      expectedBlockingRuleIds: ["ambiguous_scope"],
      expectedSuggestedRuleIds: ["ambiguous_scope"],
      produced: true,
      observedRuleId: "attribute_disambiguation",
      equivalentRuleIds: ["attribute_disambiguation", "ambiguous_scope"],
      matched: true,
      missingExpectedRuleIds: [],
      unexpectedObservedRuleId: null,
      source: "final_answer",
      layer: "in_hop.disambiguation_clarification",
      reason: null,
    });
  });

  it("reports missing expected blocking clarifications", () => {
    const policy = buildAssistantWorkflowClarificationPolicy(WORKFLOW, "chart", {
      confidence: 0.9,
      entities: {},
    });

    expect(buildAssistantWorkflowClarificationRuntimeComparison(policy, {
      produced: false,
      reason: "runtime_policy_disabled",
    })).toMatchObject({
      produced: false,
      matched: false,
      missingExpectedRuleIds: ["missing_scope"],
      unexpectedObservedRuleId: null,
      reason: "runtime_policy_disabled",
    });
  });
});
