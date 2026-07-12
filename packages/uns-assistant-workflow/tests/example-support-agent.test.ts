import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload,
  loadAssistantWorkflowDefinitionPackage,
  runAssistantWorkflowDefinitionPackageSmokeSuite,
} from "../src/index.js";
import {
  SUPPORT_AGENT_PACKAGE,
  SUPPORT_AGENT_SMOKE_SUITE,
  SUPPORT_AGENT_WORKFLOW,
} from "../examples/support-agent.js";

describe("assistant workflow support-agent example", () => {
  it("exports a valid definition package", () => {
    expect(SUPPORT_AGENT_WORKFLOW).toMatchObject({
      id: "support-agent",
      version: 1,
    });
    expect(loadAssistantWorkflowDefinitionPackage(SUPPORT_AGENT_PACKAGE)).toMatchObject({
      loaded: true,
      status: "loaded",
      definitionPackage: {
        packageId: "support-suite",
        packageVersion: "0.1.0",
        validDefinitionCount: 1,
        invalidDefinitionCount: 0,
      },
      review: {
        status: "ready",
      },
      blockingReasons: [],
    });
  });

  it("runs the example smoke suite with fixture tools", async () => {
    const result = await runAssistantWorkflowDefinitionPackageSmokeSuite(
      SUPPORT_AGENT_PACKAGE,
      SUPPORT_AGENT_SMOKE_SUITE,
    );

    expect(result).toMatchObject({
      summary: {
        caseCount: 2,
        passCount: 2,
        failCount: 0,
        requiredFailCount: 0,
      },
    });

    expect(JSON.stringify(buildAssistantWorkflowDefinitionPackageSmokeSuiteTracePayload(result)))
      .not.toContain("install.md");
  });
});
