import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDecision,
  buildAssistantWorkflowPromptFacts,
  buildAssistantWorkflowDirectRoutePolicy,
  buildAssistantWorkflowDirectRouteRuntimeDecision,
  buildAssistantWorkflowDirectRouteRuntimeDecisionTracePayload,
  findAssistantWorkflowToolBinding,
  getAssistantWorkflowToolBindings,
  resolveAssistantWorkflowTools,
  summarizeAssistantWorkflowToolBindings,
  buildAssistantWorkflowToolPolicyRecommendations,
  compileAssistantWorkflowForPlanner,
  defineAssistantWorkflow,
  shouldRequireAssistantWorkflowFirstHopTool,
} from "../src/index.js";

const WORKFLOW = defineAssistantWorkflow({
  id: "generic-support-agent",
  version: 1,
  description: "Generic assistant workflow fixture.",
  intents: [
    {
      id: "answer_docs",
      description: "Answer questions from documentation evidence.",
      defaultPresentation: "text",
      executionBias: "llm-first",
      firstHopToolPolicy: "require-tool",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs", "query_docs"],
      memoryPolicy: {
        read: ["source_scope"],
        write: ["source_scope"],
      },
      planningSteps: ["classify_intent", "retrieve_docs", "synthesize_answer"],
      clarificationRules: ["missing_source_scope"],
      directRoutes: ["docs_answer"],
    },
  ],
  tools: [
    {
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
      requiredContext: ["auth"],
    },
    {
      name: "store_note",
      provider: "local-function",
      effect: "write",
      sideEffectRisk: "high",
      cacheability: "not-cacheable",
      retryClass: "never",
      outputKinds: ["artifact"],
      requiresConfirmation: true,
    },
    {
      name: "web_search",
      provider: "openai-hosted",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence", "link"],
    },
    {
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence", "text"],
      requiredContext: ["document-scope"],
    },
    {
      name: "inspect_data",
      provider: "repl",
      effect: "compute",
      sideEffectRisk: "medium",
      cacheability: "not-cacheable",
      retryClass: "never",
      outputKinds: ["table"],
      requiresConfirmation: true,
    },
  ],
  toolBindings: [
    {
      name: "list_docs",
      provider: "http",
      method: "GET",
      path: "/docs",
      baseUrlRef: "docs_api",
    },
    {
      name: "store_note",
      provider: "local-function",
      handlerId: "notes.store",
    },
    {
      name: "web_search",
      provider: "openai-hosted",
      hostedToolType: "web_search_preview",
    },
    {
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    },
    {
      name: "inspect_data",
      provider: "repl",
      runtimeId: "python",
      functionName: "inspect_table",
    },
  ],
  directRoutes: [
    {
      id: "docs_answer",
      description: "Return a direct documentation answer when retrieval is already deterministic.",
      effect: "read",
      outcomeRoute: "docs_answer",
      requiredToolHints: ["query_docs"],
      strategies: [{
        id: "cached_evidence",
        description: "Use cached evidence when the request already resolved its source scope.",
        requiredToolHints: ["query_docs"],
      }],
    },
  ],
  memorySlots: [
    {
      id: "source_scope",
      description: "Preferred documentation source for the current thread.",
      storage: "thread-state",
    },
  ],
  planningSteps: [
    {
      id: "classify_intent",
      description: "Classify the user request.",
      kind: "classify",
    },
    {
      id: "retrieve_docs",
      description: "Retrieve supporting documentation evidence.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
      readsMemory: ["source_scope"],
    },
    {
      id: "synthesize_answer",
      description: "Answer with evidence.",
      kind: "synthesize",
      toolHints: ["query_docs"],
    },
  ],
  clarificationRules: [
    {
      id: "missing_source_scope",
      description: "Ask for a source when the documentation scope is missing.",
      condition: "missing_required_entity",
      questionStyle: "ask_scope",
      requiredEntityKinds: ["container"],
      blocksExecution: true,
    },
  ],
  subintents: [{ id: "evidence_only", description: "Return direct evidence." }],
  presentations: [{ id: "text", description: "Text answer." }],
  derivedTransforms: [{ id: "none", description: "No transform." }],
});

describe("assistant workflow package contract", () => {
  it("resolves a generic first-hop tool requirement from the intent definition", () => {
    const decision = buildAssistantWorkflowDecision(WORKFLOW, { intent: "answer_docs" }, ["query_docs"]);

    expect(decision.firstHopToolPolicy).toBe("require-tool");
    expect(shouldRequireAssistantWorkflowFirstHopTool(WORKFLOW, "answer_docs")).toBe(true);
    expect(shouldRequireAssistantWorkflowFirstHopTool(WORKFLOW, "unknown")).toBe(false);
  });

  it("rejects intent direct routes that are not registered", () => {
    expect(() =>
      defineAssistantWorkflow({
        id: "bad-direct-route",
        version: 1,
        intents: [{
          id: "answer_docs",
          description: "Answer docs.",
          directRoutes: ["missing_route"],
        }],
        directRoutes: [{
          id: "known_route",
          description: "Known direct route.",
          effect: "read",
        }],
      }),
    ).toThrow(/intent answer_docs references unknown direct route: missing_route/);
  });

  it("rejects duplicate direct route strategy ids", () => {
    expect(() =>
      defineAssistantWorkflow({
        id: "bad-direct-route-strategy",
        version: 1,
        intents: [{
          id: "answer_docs",
          description: "Answer docs.",
        }],
        directRoutes: [{
          id: "known_route",
          description: "Known direct route.",
          effect: "read",
          strategies: [
            { id: "cached", description: "Cached route." },
            { id: "cached", description: "Duplicate route." },
          ],
        }],
      }),
    ).toThrow(/Duplicate assistant workflow direct route known_route strategy id: cached/);
  });

  it("compiles generic workflow vocabulary and planner facts", () => {
    expect(buildAssistantWorkflowPromptFacts(WORKFLOW)).toEqual({
      intents: "answer_docs = Answer questions from documentation evidence.",
      subintents: "evidence_only = Return direct evidence.",
      presentations: "text",
      derivedTransforms: "none",
    });

    expect(compileAssistantWorkflowForPlanner(WORKFLOW)).toMatchObject({
      intentValues: ["answer_docs"],
      subintentValues: ["evidence_only"],
      presentationValues: ["text"],
      derivedTransformValues: ["none"],
    });
  });

  it("builds a decision with memory, plan, clarification, and tool hints", () => {
    const decision = buildAssistantWorkflowDecision(
      WORKFLOW,
      {
        intent: "answer_docs",
        presentation: "text",
        toolsToExpose: ["query_docs", "inspect_data"],
        confidence: 0.9,
        entities: {},
      },
      ["list_docs", "query_docs", "inspect_data"],
    );

    expect(decision).toMatchObject({
      intent: "answer_docs",
      matchedIntent: true,
      defaultPresentation: "text",
      effectivePresentation: "text",
      executionBias: "llm-first",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs", "query_docs"],
      classifierTools: ["query_docs", "inspect_data"],
      workflowSuggestedTools: ["query_docs", "inspect_data", "list_docs"],
      extraClassifierTools: ["inspect_data"],
    });
    expect(decision.memoryPolicy.readSlots).toEqual(["source_scope"]);
    expect(decision.plan.steps.map((step) => step.id)).toEqual([
      "classify_intent",
      "retrieve_docs",
      "synthesize_answer",
    ]);
    expect(decision.clarificationPolicy.blockingRuleIds).toEqual(["missing_source_scope"]);
  });

  it("resolves direct route policy and runtime decisions from workflow definitions", () => {
    expect(buildAssistantWorkflowDirectRoutePolicy(WORKFLOW, "answer_docs")).toMatchObject({
      intentId: "answer_docs",
      routeIds: ["docs_answer"],
      missingRouteIds: [],
      routes: [{
        id: "docs_answer",
        effect: "read",
        outcomeRoute: "docs_answer",
        requiredToolHints: ["query_docs"],
        strategies: [{
          id: "cached_evidence",
          requiredToolHints: ["query_docs"],
        }],
      }],
    });

    const enabled = buildAssistantWorkflowDirectRouteRuntimeDecision({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: true,
    });
    const disabled = buildAssistantWorkflowDirectRouteRuntimeDecision({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "docs_answer",
      runtimeEnabled: false,
    });
    const missing = buildAssistantWorkflowDirectRouteRuntimeDecision({
      workflow: WORKFLOW,
      intentId: "answer_docs",
      routeId: "other_route",
      runtimeEnabled: true,
    });
    const catalog = buildAssistantWorkflowDirectRouteRuntimeDecision({
      workflow: WORKFLOW,
      routeId: "docs_answer",
      runtimeEnabled: true,
      policyScope: "catalog",
    });

    expect(enabled).toEqual({
      intentId: "answer_docs",
      routeId: "docs_answer",
      enabled: true,
      reason: "enabled",
      policyRouteIds: ["docs_answer"],
    });
    expect(buildAssistantWorkflowDirectRouteRuntimeDecisionTracePayload(enabled)).toEqual({
      intent: "answer_docs",
      route: "docs_answer",
      enabled: true,
      reason: "enabled",
      policyRouteIds: ["docs_answer"],
    });
    expect(disabled).toMatchObject({ enabled: false, reason: "runtime_disabled" });
    expect(missing).toMatchObject({ enabled: false, reason: "route_not_declared" });
    expect(catalog).toEqual({
      intentId: null,
      routeId: "docs_answer",
      enabled: true,
      reason: "enabled",
      policyRouteIds: ["docs_answer"],
    });
  });

  it("derives default policy recommendations from generic tool capabilities", () => {
    expect(buildAssistantWorkflowToolPolicyRecommendations(WORKFLOW, ["inspect_data"])).toEqual([{
      toolName: "inspect_data",
      assistantVisibleByDefault: true,
      cacheable: false,
      confirmationRequired: true,
      enabledByDefault: true,
      explicitCallAllowedByDefault: true,
      outputKinds: ["table"],
      readOnly: true,
      requiredContext: [],
      retryAllowed: false,
      schemaAssistantVisibleByDefault: false,
      sideEffectRisk: "medium",
    }]);
  });

  it("resolves generic tool provider bindings separately from capabilities", () => {
    expect(findAssistantWorkflowToolBinding(WORKFLOW, " query_docs ")).toMatchObject({
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    });

    expect(getAssistantWorkflowToolBindings(WORKFLOW, ["list_docs", "missing", "list_docs"]))
      .toMatchObject({
        bindings: [{ name: "list_docs", provider: "http" }],
        missingToolBindings: ["missing"],
      });

    expect(summarizeAssistantWorkflowToolBindings(WORKFLOW)).toEqual({
      bindingCount: 5,
      providers: {
        http: 1,
        "local-function": 1,
        "openai-hosted": 1,
        mcp: 1,
        repl: 1,
      },
      coverage: {
        boundToolNames: ["list_docs", "store_note", "web_search", "query_docs", "inspect_data"],
        unboundToolNames: [],
        bindingWithoutCapabilityNames: [],
        providerMismatches: [],
      },
    });

    expect(resolveAssistantWorkflowTools(WORKFLOW, ["list_docs", "query_docs", "missing"])).toMatchObject({
      readyToolNames: ["list_docs", "query_docs"],
      missingCapabilityNames: ["missing"],
      missingBindingNames: [],
      providerMismatchNames: [],
      resolutions: [
        { toolName: "list_docs", status: "ready", provider: "http" },
        { toolName: "query_docs", status: "ready", provider: "mcp" },
        { toolName: "missing", status: "missing-capability", provider: null },
      ],
    });
  });
});
