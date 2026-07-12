import { describe, expect, it } from "vitest";
import {
  estimateAssistantWorkflowToolSchemaChars,
  selectAssistantWorkflowToolsByRules,
  type AssistantWorkflowToolSelectionRule,
} from "../src/index.js";

type TestSignal =
  | "docsIntent"
  | "chartIntent"
  | "followUp"
  | "ragFallback";

type TestTool = {
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const RULES: readonly AssistantWorkflowToolSelectionRule<TestSignal>[] = [
  {
    id: "docs_lane",
    condition: { allSignals: ["docsIntent"] },
    toolNames: ["list_docs", "query_docs"],
    terminal: true,
    terminalReason: "docs_lane",
  },
  {
    id: "chart_lane",
    condition: { allSignals: ["chartIntent"] },
    toolNames: ["load_series", "render_chart"],
  },
];

const POST_FALLBACK_RULES: readonly AssistantWorkflowToolSelectionRule<TestSignal>[] = [
  {
    id: "rag_fallback",
    condition: { allSignals: ["ragFallback"] },
    toolNames: ["query_rag"],
  },
  {
    id: "follow_up",
    condition: { minHop: 1 },
    toolNames: ["search_docs"],
  },
];

const TOOLS = [
  tool("list_docs"),
  tool("query_docs"),
  tool("search_docs"),
  tool("load_series"),
  tool("render_chart"),
  tool("query_rag"),
];

describe("selectAssistantWorkflowToolsByRules", () => {
  it("returns all tools when pruning is disabled", () => {
    expect(selectAssistantWorkflowToolsByRules({
      allTools: TOOLS,
      pruningEnabled: false,
      rules: RULES,
    })).toMatchObject({
      mode: "full",
      reason: "disabled",
      toolNames: TOOLS.map((entry) => entry.function.name),
    });
  });

  it("honors classifier suggestions before signal rules", () => {
    expect(selectAssistantWorkflowToolsByRules({
      allTools: TOOLS,
      pruningEnabled: true,
      classifierSuggestedToolNames: ["query_docs"],
      signals: { chartIntent: true },
      rules: RULES,
    })).toMatchObject({
      mode: "pruned",
      reason: "intent_pruned",
      toolNames: ["query_docs", "load_series", "render_chart"],
      appliedRuleIds: ["classifier_suggested", "chart_lane"],
    });
  });

  it("supports terminal rules for dedicated lanes", () => {
    expect(selectAssistantWorkflowToolsByRules({
      allTools: TOOLS,
      pruningEnabled: true,
      signals: { docsIntent: true, chartIntent: true },
      rules: RULES,
    })).toMatchObject({
      mode: "pruned",
      reason: "docs_lane",
      toolNames: ["list_docs", "query_docs"],
      appliedRuleIds: ["docs_lane"],
    });
  });

  it("applies fallback before post-fallback rules", () => {
    expect(selectAssistantWorkflowToolsByRules({
      allTools: TOOLS,
      pruningEnabled: true,
      hop: 1,
      signals: { ragFallback: true },
      rules: RULES,
      fallbackToolNames: ["list_docs"],
      postFallbackRules: POST_FALLBACK_RULES,
    })).toMatchObject({
      mode: "pruned",
      reason: "intent_pruned",
      toolNames: ["list_docs", "search_docs", "query_rag"],
      appliedRuleIds: ["fallback", "rag_fallback", "follow_up"],
    });
  });

  it("falls back to all tools when selected names are unavailable", () => {
    expect(selectAssistantWorkflowToolsByRules({
      allTools: TOOLS,
      pruningEnabled: true,
      classifierSuggestedToolNames: ["missing_tool"],
      rules: RULES,
    })).toMatchObject({
      mode: "full",
      reason: "empty_selection",
      toolNames: TOOLS.map((entry) => entry.function.name),
    });
  });

  it("estimates schema chars using OpenAI-style function tool shape by default", () => {
    expect(estimateAssistantWorkflowToolSchemaChars([tool("query_docs")])).toBeGreaterThan("query_docs".length);
  });
});

function tool(name: string): TestTool {
  return {
    function: {
      name,
      description: `${name} description`,
      parameters: { type: "object", properties: {} },
    },
  };
}
