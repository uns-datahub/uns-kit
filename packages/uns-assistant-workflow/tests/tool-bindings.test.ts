import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowToolBindingCoverage,
  defineAssistantWorkflow,
  resolveAssistantWorkflowTools,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool bindings", () => {
  it("rejects tool bindings that reference unknown capabilities", () => {
    expect(() =>
      defineAssistantWorkflow({
        ...baseWorkflow(),
        toolBindings: [{
          name: "missing_tool",
          provider: "http",
          path: "/missing",
        }],
      }),
    ).toThrow("Assistant workflow tool binding references unknown tool capability: missing_tool");
  });

  it("rejects provider mismatches between capabilities and bindings", () => {
    expect(() =>
      defineAssistantWorkflow({
        ...baseWorkflow(),
        toolBindings: [{
          name: "query_docs",
          provider: "http",
          path: "/docs/query",
        }],
      }),
    ).toThrow(
      "Assistant workflow tool binding query_docs provider http does not match capability provider mcp.",
    );
  });

  it("rejects provider bindings without required target fields", () => {
    expect(() =>
      defineAssistantWorkflow({
        ...baseWorkflow(),
        toolBindings: [{
          name: "query_docs",
          provider: "mcp",
          serverId: "docs",
          toolName: " ",
        }],
      }),
    ).toThrow("Assistant workflow tool binding query_docs toolName is required.");

    expect(() =>
      defineAssistantWorkflow({
        ...baseWorkflow(),
        tools: [{
          name: "inspect_data",
          provider: "repl",
          effect: "compute",
          sideEffectRisk: "medium",
          cacheability: "not-cacheable",
          retryClass: "never",
          outputKinds: ["table"],
        }],
        intents: [{
          id: "inspect",
          description: "Inspect data.",
          toolHints: ["inspect_data"],
        }],
        toolBindings: [{
          name: "inspect_data",
          provider: "repl",
          runtimeId: "python",
        }],
      }),
    ).toThrow("Assistant workflow tool binding inspect_data must define functionName or commandTemplate.");
  });

  it("can report binding coverage without requiring complete coverage", () => {
    const workflow = defineAssistantWorkflow(baseWorkflow());

    expect(buildAssistantWorkflowToolBindingCoverage(workflow)).toEqual({
      boundToolNames: [],
      unboundToolNames: ["query_docs"],
      bindingWithoutCapabilityNames: [],
      providerMismatches: [],
    });
    expect(resolveAssistantWorkflowTools(workflow, ["query_docs"])).toMatchObject({
      readyToolNames: [],
      missingBindingNames: ["query_docs"],
      providerMismatchNames: [],
    });
  });
});

function baseWorkflow(): AssistantWorkflowDefinition {
  return {
    id: "binding-test-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer from docs.",
      toolHints: ["query_docs"],
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
  };
}
