import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowEvalSuite,
  buildAssistantWorkflowEvalSuiteTracePayload,
  type AssistantWorkflowEvalResult,
} from "../src/index.js";

describe("assistant workflow eval suite", () => {
  it("aggregates eval results for suite reporting", () => {
    const suite = buildAssistantWorkflowEvalSuite([
      result("required-pass", true, "pass", []),
      result("required-fail", true, "fail", ["intent", "tools"]),
      result("optional-fail", false, "fail", ["signals"]),
      result("optional-skipped", false, "skipped", []),
    ]);

    expect(suite).toMatchObject({
      sourceResultCount: 4,
      resultCount: 4,
      passCount: 1,
      failCount: 2,
      skippedCount: 1,
      requiredCount: 2,
      requiredFailedCount: 1,
      optionalFailedCount: 1,
      requiredFailedCaseIds: ["required-fail"],
      optionalFailedCaseIds: ["optional-fail"],
      statusCounts: [
        { key: "fail", count: 2 },
        { key: "pass", count: 1 },
        { key: "skipped", count: 1 },
      ],
      failedCheckCounts: [
        { key: "intent", count: 1 },
        { key: "signals", count: 1 },
        { key: "tools", count: 1 },
      ],
    });
    expect(suite.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("can focus a suite on failures", () => {
    const suite = buildAssistantWorkflowEvalSuite([
      result("required-pass", true, "pass", []),
      result("required-fail", true, "fail", ["intent"]),
      result("optional-skipped", false, "skipped", []),
    ], { onlyFailures: true });

    expect(suite).toMatchObject({
      sourceResultCount: 3,
      resultCount: 1,
      passCount: 0,
      failCount: 1,
      skippedCount: 0,
      requiredCount: 1,
      requiredFailedCaseIds: ["required-fail"],
      rows: [{
        caseId: "required-fail",
        failedCheckNames: ["intent"],
      }],
    });
    expect(suite.checkCounts.every((count) => count.count === 1)).toBe(true);
  });

  it("builds a compact suite trace payload", () => {
    const suite = buildAssistantWorkflowEvalSuite([
      result("required-fail", true, "fail", ["intent"]),
    ]);

    expect(buildAssistantWorkflowEvalSuiteTracePayload(suite)).toMatchObject({
      sourceResultCount: 1,
      resultCount: 1,
      failCount: 1,
      requiredFailedCount: 1,
      requiredFailedCaseIds: ["required-fail"],
      failedCheckCounts: [{ key: "intent", count: 1 }],
    });
  });
});

function result(
  caseId: string,
  required: boolean,
  status: AssistantWorkflowEvalResult["status"],
  failedCheckNames: readonly AssistantWorkflowEvalResult["checks"][number]["name"][],
): AssistantWorkflowEvalResult {
  const failedChecks = failedCheckNames.map((name) => ({
    name,
    status: "fail" as const,
    expected: "expected",
    actual: "actual",
    detail: `failed ${name}`,
  }));
  const checks: AssistantWorkflowEvalResult["checks"] = [
    ...failedChecks,
    {
      name: "status",
      status: failedCheckNames.includes("status") ? "fail" : "pass",
      expected: "completed",
      actual: status === "pass" ? "completed" : "failed",
      detail: failedCheckNames.includes("status") ? "failed status" : null,
    },
  ];
  const failedCount = checks.filter((check) => check.status === "fail").length;
  const passedCount = checks.filter((check) => check.status === "pass").length;

  return {
    caseId,
    required,
    status,
    passedCount,
    failedCount,
    skippedCount: status === "skipped" ? 1 : 0,
    checks,
    actual: {
      workflowId: "suite-agent",
      workflowVersion: 1,
      intent: "answer_docs",
      presentation: "text",
      status: status === "pass" ? "completed" : "failed",
      outcomeKind: "final_text",
      planStepIds: [],
      activePlanningStepProfileIds: [],
      profileStepIds: [],
      tools: [],
      signalNames: [],
      qualitySignalNames: [],
    },
  };
}
