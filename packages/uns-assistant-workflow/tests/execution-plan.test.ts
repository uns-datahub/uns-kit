import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDecision,
  buildAssistantWorkflowExecutionPlan,
  buildAssistantWorkflowExecutionPlanTracePayload,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow execution plan", () => {
  it("builds a ready execution plan when required steps and bindings are available", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision);

    expect(plan).toMatchObject({
      intent: "answer_docs",
      status: "ready",
      readyToolNames: ["query_docs", "list_docs"],
      requiredReadyToolNames: ["query_docs"],
      blockingReasons: [],
      warnings: [],
    });
    expect(plan.steps.map((step) => [step.id, step.status])).toEqual([
      ["retrieve_docs", "ready"],
      ["synthesize_answer", "ready"],
    ]);
    expect(buildAssistantWorkflowExecutionPlanTracePayload(plan)).toMatchObject({
      intent: "answer_docs",
      status: "ready",
      executionHints: {
        needsClarification: false,
        needsSynthesis: true,
      },
    });
  });

  it("marks execution as needing clarification when a blocking rule fires", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        confidence: 0.9,
        entities: {},
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision);

    expect(plan.status).toBe("needs-clarification");
    expect(plan.clarificationRuleIds).toEqual(["missing_source_scope"]);
    expect(plan.blockingReasons).toContain("clarification required: missing_source_scope");
  });

  it("blocks when required tools have no executable binding", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      toolBindings: [{
        name: "list_docs",
        provider: "http",
        path: "/docs",
      }],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision);

    expect(plan.status).toBe("blocked");
    expect(plan.missingBindingNames).toEqual(["query_docs"]);
    expect(plan.blockingReasons).toContain("workflow required tool query_docs is missing-binding");
    expect(plan.steps[0]).toMatchObject({
      id: "retrieve_docs",
      status: "blocked",
      missingBindingNames: ["query_docs"],
    });
  });

  it("keeps optional missing tools as a partial non-blocking plan", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      toolBindings: [{
        name: "query_docs",
        provider: "mcp",
        serverId: "docs",
        toolName: "query",
      }],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision);

    expect(plan.status).toBe("partial");
    expect(plan.blockingReasons).toEqual([]);
    expect(plan.warnings).toContain("synthesize_answer optional tool list_docs is missing-binding");
    expect(plan.steps[1]).toMatchObject({
      id: "synthesize_answer",
      status: "partial",
      missingBindingNames: ["list_docs"],
    });
  });

  it("blocks required tools when the runtime context is missing", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision, {
      availableContext: ["auth"],
    });

    expect(plan.status).toBe("blocked");
    expect(plan.requiredContext).toEqual(["document-scope", "auth"]);
    expect(plan.missingContextRequirements).toEqual(["document-scope"]);
    expect(plan.requiredReadyToolNames).toEqual([]);
    expect(plan.blockingReasons).toContain("workflow required tool query_docs missing context: document-scope");
    expect(plan.steps[0]).toMatchObject({
      id: "retrieve_docs",
      status: "blocked",
      requiredContext: ["document-scope"],
      missingContextRequirements: ["document-scope"],
    });
  });

  it("requires declared dependencies to be selected before dependent steps", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      intents: [{
        ...baseWorkflow().intents[0]!,
        planningSteps: ["synthesize_answer", "retrieve_docs"],
      }],
      planningSteps: [{
        ...baseWorkflow().planningSteps![0]!,
      }, {
        ...baseWorkflow().planningSteps![1]!,
        dependsOn: ["retrieve_docs"],
      }],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision);

    expect(plan.status).toBe("blocked");
    expect(plan.steps[0]).toMatchObject({
      id: "synthesize_answer",
      dependsOnStepIds: ["retrieve_docs"],
      outOfOrderDependencyStepIds: ["retrieve_docs"],
      status: "blocked",
    });
    expect(plan.blockingReasons).toContain(
      "synthesize_answer dependency must run first: retrieve_docs",
    );
  });

  it("blocks a dependent step when its dependency is not selected", () => {
    const workflow = defineAssistantWorkflow({
      ...baseWorkflow(),
      intents: [{
        ...baseWorkflow().intents[0]!,
        planningSteps: ["synthesize_answer"],
      }],
      planningSteps: [{
        ...baseWorkflow().planningSteps![0]!,
      }, {
        ...baseWorkflow().planningSteps![1]!,
        dependsOn: ["retrieve_docs"],
      }],
    });
    const decision = buildAssistantWorkflowDecision(
      workflow,
      {
        intent: "answer_docs",
        confidence: 0.9,
        entities: { containers: ["manual"] },
      },
      ["query_docs", "list_docs"],
    );

    const plan = buildAssistantWorkflowExecutionPlan(workflow, decision);

    expect(plan.status).toBe("blocked");
    expect(plan.steps[0]).toMatchObject({
      missingDependencyStepIds: ["retrieve_docs"],
      status: "blocked",
    });
    expect(plan.blockingReasons).toContain(
      "synthesize_answer missing dependency step: retrieve_docs",
    );
  });
});

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "execution-plan-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      planningSteps: ["retrieve_docs", "synthesize_answer"],
      clarificationRules: ["missing_source_scope"],
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
      requiredContext: ["document-scope"],
    }, {
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
      requiredContext: ["auth"],
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }, {
      name: "list_docs",
      provider: "http",
      path: "/docs",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve supporting docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
    }, {
      id: "synthesize_answer",
      description: "Synthesize final answer.",
      kind: "synthesize",
      toolHints: ["list_docs"],
    }],
    clarificationRules: [{
      id: "missing_source_scope",
      description: "Ask for source scope.",
      condition: "missing_required_entity",
      questionStyle: "ask_scope",
      blocksExecution: true,
      requiredEntityKinds: ["container"],
    }],
  };
}
