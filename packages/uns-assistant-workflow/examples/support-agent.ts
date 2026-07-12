import {
  assistantWorkflowFinalText,
  buildAssistantWorkflowDefinitionPackage,
  defineAssistantWorkflow,
  type AssistantWorkflowDefinitionPackageSmokeSuiteInput,
} from "../src/index.js";

export const SUPPORT_AGENT_WORKFLOW = defineAssistantWorkflow({
  id: "support-agent",
  version: 1,
  description: "Answers support questions from documentation evidence.",
  intents: [{
    id: "answer_docs",
    description: "Answer questions from documentation evidence.",
    defaultPresentation: "text",
    executionBias: "llm-first",
    requiredToolHints: ["query_docs"],
    toolHints: ["list_docs", "query_docs"],
    memoryPolicy: {
      read: ["source_scope"],
      write: ["source_scope"],
    },
    planningSteps: ["classify_intent", "retrieve_docs", "synthesize_answer"],
    clarificationRules: ["missing_source_scope"],
  }],
  tools: [{
    name: "list_docs",
    provider: "http",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "cacheable",
    retryClass: "safe",
    outputKinds: ["catalog"],
    requiredContext: ["auth"],
  }, {
    name: "query_docs",
    provider: "mcp",
    effect: "read",
    sideEffectRisk: "low",
    cacheability: "request-scoped",
    retryClass: "bounded",
    outputKinds: ["evidence", "text"],
    requiredContext: ["document-scope"],
  }],
  toolBindings: [{
    name: "list_docs",
    provider: "http",
    method: "GET",
    path: "/docs",
    baseUrlRef: "docs_api",
  }, {
    name: "query_docs",
    provider: "mcp",
    serverId: "docs",
    toolName: "query",
  }],
  memorySlots: [{
    id: "source_scope",
    description: "Preferred documentation source for the current thread.",
    storage: "thread-state",
  }],
  planningSteps: [{
    id: "classify_intent",
    description: "Classify the user request.",
    kind: "classify",
  }, {
    id: "retrieve_docs",
    description: "Retrieve evidence from documentation.",
    kind: "retrieve",
    requiredToolHints: ["query_docs"],
    readsMemory: ["source_scope"],
  }, {
    id: "synthesize_answer",
    description: "Answer with cited evidence.",
    kind: "synthesize",
    toolHints: ["query_docs"],
  }],
  clarificationRules: [{
    id: "missing_source_scope",
    description: "Ask for a documentation source when it is missing.",
    condition: "missing_required_entity",
    questionStyle: "ask_scope",
    requiredEntityKinds: ["container"],
    blocksExecution: true,
  }],
  presentations: [{
    id: "text",
    description: "Plain text answer.",
  }],
});

export const SUPPORT_AGENT_PACKAGE = buildAssistantWorkflowDefinitionPackage([SUPPORT_AGENT_WORKFLOW], {
  generatedAt: "2026-06-29T12:00:00.000Z",
  packageId: "support-suite",
  packageVersion: "0.1.0",
  description: "Example support assistant workflow package.",
  tags: ["support", "docs"],
});

export const SUPPORT_AGENT_SMOKE_SUITE = {
  runCases: [{
    id: "ready-doc-answer",
    classification: {
      intent: "answer_docs",
      confidence: 0.9,
      entities: {
        containers: ["docs"],
      },
    },
    availableToolNames: ["list_docs", "query_docs"],
    availableContext: ["auth", "document-scope"],
    expectedRunStatus: "ready",
  }],
  executionCases: [{
    id: "fixture-doc-answer",
    classification: {
      intent: "answer_docs",
      confidence: 0.9,
      entities: {
        containers: ["docs"],
      },
    },
    availableToolNames: ["list_docs", "query_docs"],
    availableContext: ["auth", "document-scope"],
    fixtures: {
      query_docs: {
        status: "success",
        output: {
          rows: 2,
          sources: ["install.md", "faq.md"],
        },
      },
    },
    outcome: assistantWorkflowFinalText("Use the installation guide and FAQ."),
    expectedExecutionStatus: "report_built",
    expectedReportStatus: "completed",
    expectedToolResultStatus: "complete",
  }],
} satisfies AssistantWorkflowDefinitionPackageSmokeSuiteInput;
