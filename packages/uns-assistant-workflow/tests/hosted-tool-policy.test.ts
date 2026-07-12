import { describe, expect, it } from "vitest";
import {
  assistantWorkflowRequestHasHostedTool,
  buildAssistantWorkflowHostedToolDirectiveForRequest,
  isAssistantWorkflowExternalWebSearchClassification,
  parseAssistantWorkflowHostedToolPolicy,
  selectAssistantWorkflowHostedToolsForRequest,
} from "../src/index.js";

type TestLane = "assistant" | "review";

describe("assistant workflow hosted tool policy", () => {
  it("keeps hosted tools disabled by default even when allowlisted", () => {
    const policy = parseAssistantWorkflowHostedToolPolicy({
      enabled: false,
      allowlist: [{ type: "web_search", externalOnly: false }],
    });

    const selection = selectAssistantWorkflowHostedToolsForRequest(policy, {
      lane: "assistant",
      transport: "responses",
    });

    expect(selection.tools).toEqual([]);
    expect(selection.blocked).toEqual([{ type: "web_search", reason: "policy_disabled" }]);
  });

  it("requires Responses transport and matching lane", () => {
    const policy = parseAssistantWorkflowHostedToolPolicy<TestLane>({
      enabled: true,
      allowlist: [{ type: "tool_search", lanes: ["review"] }],
    }, {
      normalizeLane: normalizeTestLane,
      defaultLanes: ["assistant"],
    });

    expect(
      selectAssistantWorkflowHostedToolsForRequest(policy, {
        lane: "assistant",
        transport: "responses",
      }).blocked,
    ).toEqual([{ type: "tool_search", reason: "lane_not_allowed" }]);
    expect(
      selectAssistantWorkflowHostedToolsForRequest(policy, {
        lane: "review",
        transport: "chat_completions",
      }).blocked,
    ).toEqual([{ type: "tool_search", reason: "responses_transport_required" }]);
  });

  it("parses file search and MCP descriptors without secret headers", () => {
    const policy = parseAssistantWorkflowHostedToolPolicy({
      enabled: true,
      allowlist: [
        { type: "file_search", vectorStoreIds: ["vs_1", "vs_1", "vs_2"] },
        {
          type: "mcp",
          serverLabel: "docs",
          serverUrl: "https://example.com/mcp",
          allowedToolFilter: { readOnly: true, toolNames: ["search_docs"] },
          requireApproval: false,
        },
      ],
    });

    const selection = selectAssistantWorkflowHostedToolsForRequest(policy, {
      lane: "assistant",
      transport: "responses",
    });

    expect(selection.tools).toEqual([
      { type: "file_search", vector_store_ids: ["vs_1", "vs_2"] },
      {
        type: "mcp",
        server_label: "docs",
        server_url: "https://example.com/mcp",
        allowed_tools: { read_only: true, tool_names: ["search_docs"] },
        require_approval: "never",
      },
    ]);
    expect(JSON.stringify(selection.tools)).not.toContain("headers");
  });

  it("allows web search only for external requests by default", () => {
    const policy = parseAssistantWorkflowHostedToolPolicy({
      enabled: true,
      allowlist: [{ type: "web_search" }],
    });

    expect(
      selectAssistantWorkflowHostedToolsForRequest(policy, {
        lane: "assistant",
        transport: "responses",
        externalRequest: true,
      }).tools,
    ).toEqual([{ type: "web_search" }]);

    expect(
      selectAssistantWorkflowHostedToolsForRequest(policy, {
        lane: "assistant",
        transport: "responses",
        externalRequest: false,
      }).blocked,
    ).toEqual([{ type: "web_search", reason: "external_intent_required" }]);
  });

  it("deduplicates identical hosted tool definitions", () => {
    const policy = parseAssistantWorkflowHostedToolPolicy({
      enabled: true,
      allowlist: [{ type: "tool_search" }, { type: "tool_search" }],
    });

    const selection = selectAssistantWorkflowHostedToolsForRequest(policy, {
      lane: "assistant",
      transport: "responses",
    });

    expect(selection.tools).toEqual([{ type: "tool_search" }]);
    expect(selection.blocked).toEqual([{ type: "tool_search", reason: "duplicate" }]);
  });

  it("detects external web-search classifications and directive requirements", () => {
    expect(isAssistantWorkflowExternalWebSearchClassification({ intent: "external_web_search" })).toBe(true);
    expect(isAssistantWorkflowExternalWebSearchClassification({ intent: "value_lookup" })).toBe(false);
    expect(assistantWorkflowRequestHasHostedTool([{ type: "web_search" }], "web_search")).toBe(true);
    expect(
      buildAssistantWorkflowHostedToolDirectiveForRequest({
        externalWebSearchRequest: true,
        hostedTools: [{ type: "web_search" }],
      }),
    ).toEqual({
      localTools: "exclude",
      toolChoice: "required",
      reason: "external_web_search",
    });
  });
});

function normalizeTestLane(value: string): TestLane | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "assistant") return "assistant";
  if (normalized === "review") return "review";
  return null;
}
