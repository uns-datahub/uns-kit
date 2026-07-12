import type {
  AssistantWorkflowEvalCase,
  AssistantWorkflowEvalCaseExpectations,
} from "./eval-case.js";
import type { AssistantWorkflowRunReportStatus } from "./run-report.js";
import type {
  AssistantWorkflowJsonValue,
  AssistantWorkflowSerializedRunReport,
} from "./run-report-json.js";
import {
  readAssistantWorkflowNestedArray as readNestedArray,
  readAssistantWorkflowNestedString as readNestedStringOrNull,
  readAssistantWorkflowString as readStringOrNull,
  readAssistantWorkflowStringArray as readStringArray,
} from "./value-readers.js";

export type AssistantWorkflowEvalActual = {
  workflowId: string | null;
  workflowVersion: number | null;
  intent: string | null;
  presentation: string | null;
  status: AssistantWorkflowRunReportStatus | null;
  outcomeKind: string | null;
  planStepIds: string[];
  activePlanningStepProfileIds: string[];
  profileStepIds: string[];
  tools: string[];
  signalNames: string[];
  qualitySignalNames: string[];
};

export type AssistantWorkflowEvalCheckName =
  | "intent"
  | "presentation"
  | "status"
  | "outcome_kind"
  | "plan_steps"
  | "planning_profiles"
  | "profile_steps"
  | "tools"
  | "signals"
  | "quality_signals";

export type AssistantWorkflowEvalCheckStatus = "pass" | "fail" | "skipped";

export type AssistantWorkflowEvalCheck = {
  name: AssistantWorkflowEvalCheckName;
  status: AssistantWorkflowEvalCheckStatus;
  expected: string | string[] | null;
  actual: string | string[] | null;
  detail: string | null;
};

export type AssistantWorkflowEvalResultStatus = "pass" | "fail" | "skipped";

export type AssistantWorkflowEvalResult = {
  caseId: string;
  required: boolean;
  status: AssistantWorkflowEvalResultStatus;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  checks: AssistantWorkflowEvalCheck[];
  actual: AssistantWorkflowEvalActual;
};

export type AssistantWorkflowEvalActualOptions = {
  qualitySignalNames?: readonly string[] | null;
};

export function buildMissingAssistantWorkflowEvalActual(): AssistantWorkflowEvalActual {
  return {
    workflowId: null,
    workflowVersion: null,
    intent: null,
    presentation: null,
    status: null,
    outcomeKind: null,
    planStepIds: [],
    activePlanningStepProfileIds: [],
    profileStepIds: [],
    tools: [],
    signalNames: [],
    qualitySignalNames: [],
  };
}

export function buildAssistantWorkflowEvalActualFromSerializedRunReport(
  report: AssistantWorkflowSerializedRunReport,
  options: AssistantWorkflowEvalActualOptions = {},
): AssistantWorkflowEvalActual {
  return {
    workflowId: report.workflowId,
    workflowVersion: report.workflowVersion,
    intent: readStringOrNull(report.evaluation["intent"]) ?? readNestedStringOrNull(report.run, ["decision", "intent"]),
    presentation: readNestedStringOrNull(report.run, ["decision", "effectivePresentation"]),
    status: report.status,
    outcomeKind: readStringOrNull(report.evaluation["outcomeKind"]) ?? readStringOrNull(report.outcome["kind"]),
    planStepIds: readPlanStepIds(report),
    activePlanningStepProfileIds: readStringArray(report.evaluation["activePlanningStepProfileIds"]),
    profileStepIds: readStringArray(report.evaluation["profileStepIds"]),
    tools: readInvocationToolNames(report),
    signalNames: readSignalNames(report),
    qualitySignalNames: uniqueNonEmptyStrings(options.qualitySignalNames ?? []),
  };
}

export function evaluateAssistantWorkflowEvalCase(
  evalCase: AssistantWorkflowEvalCase,
  actual: AssistantWorkflowEvalActual,
): AssistantWorkflowEvalResult {
  const expectations = evalCase.expectations;
  const checks: AssistantWorkflowEvalCheck[] = [
    compareScalar("intent", expectations.intent, actual.intent),
    compareScalar("presentation", expectations.presentation, actual.presentation),
    compareScalar("status", expectations.status, actual.status),
    compareScalar("outcome_kind", expectations.outcomeKind, actual.outcomeKind),
    compareStringSet("plan_steps", expectations.planStepIds, actual.planStepIds),
    compareStringSet("planning_profiles", expectations.activePlanningStepProfileIds, actual.activePlanningStepProfileIds),
    compareStringSet("profile_steps", expectations.profileStepIds, actual.profileStepIds),
    compareStringSet("tools", expectations.tools, actual.tools),
    compareStringSet("signals", expectations.signalNames, actual.signalNames),
    compareStringSet("quality_signals", expectations.qualitySignalNames, actual.qualitySignalNames),
  ];
  const passedCount = checks.filter((check) => check.status === "pass").length;
  const failedCount = checks.filter((check) => check.status === "fail").length;
  const skippedCount = checks.filter((check) => check.status === "skipped").length;

  return {
    caseId: evalCase.id,
    required: evalCase.required,
    status: failedCount > 0 ? "fail" : passedCount > 0 ? "pass" : "skipped",
    passedCount,
    failedCount,
    skippedCount,
    checks,
    actual,
  };
}

export function evaluateAssistantWorkflowEvalCaseAgainstSerializedRunReport(
  evalCase: AssistantWorkflowEvalCase,
  report: AssistantWorkflowSerializedRunReport,
  options: AssistantWorkflowEvalActualOptions = {},
): AssistantWorkflowEvalResult {
  return evaluateAssistantWorkflowEvalCase(
    evalCase,
    buildAssistantWorkflowEvalActualFromSerializedRunReport(report, options),
  );
}

export function buildAssistantWorkflowEvalResultTracePayload(
  result: AssistantWorkflowEvalResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    caseId: result.caseId,
    required: result.required,
    status: result.status,
    passedCount: result.passedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
    checks: result.checks.map((check) => ({
      name: check.name,
      status: check.status,
      expected: check.expected,
      actual: check.actual,
      detail: check.detail,
    })),
    actual: {
      workflowId: result.actual.workflowId,
      workflowVersion: result.actual.workflowVersion,
      intent: result.actual.intent,
      presentation: result.actual.presentation,
      status: result.actual.status,
      outcomeKind: result.actual.outcomeKind,
      planStepIds: result.actual.planStepIds,
      activePlanningStepProfileIds: result.actual.activePlanningStepProfileIds,
      profileStepIds: result.actual.profileStepIds,
      tools: result.actual.tools,
      signalNames: result.actual.signalNames,
      qualitySignalNames: result.actual.qualitySignalNames,
    },
  };
}

function compareScalar(
  name: AssistantWorkflowEvalCheckName,
  expected: string | null,
  actual: string | null,
): AssistantWorkflowEvalCheck {
  if (expected === null) {
    return {
      name,
      status: "skipped",
      expected: null,
      actual,
      detail: "no expectation",
    };
  }
  if (actual === expected) {
    return {
      name,
      status: "pass",
      expected,
      actual,
      detail: null,
    };
  }
  return {
    name,
    status: "fail",
    expected,
    actual,
    detail: actual === null ? "actual value is missing" : `expected ${expected}, got ${actual}`,
  };
}

function compareStringSet(
  name: AssistantWorkflowEvalCheckName,
  expected: readonly string[],
  actual: readonly string[],
): AssistantWorkflowEvalCheck {
  const normalizedExpected = uniqueNonEmptyStrings(expected);
  const normalizedActual = uniqueNonEmptyStrings(actual);
  if (!normalizedExpected.length) {
    return {
      name,
      status: "skipped",
      expected: [],
      actual: normalizedActual,
      detail: "no expectation",
    };
  }

  const actualSet = new Set(normalizedActual);
  const missing = normalizedExpected.filter((value) => !actualSet.has(value));
  if (!missing.length) {
    return {
      name,
      status: "pass",
      expected: normalizedExpected,
      actual: normalizedActual,
      detail: null,
    };
  }
  return {
    name,
    status: "fail",
    expected: normalizedExpected,
    actual: normalizedActual,
    detail: `missing: ${missing.join(", ")}`,
  };
}

function readPlanStepIds(report: AssistantWorkflowSerializedRunReport): string[] {
  const steps = readNestedArray(report.run, ["executionPlan", "steps"]);
  return uniqueNonEmptyStrings(steps.flatMap((step) => isRecord(step) ? [step["id"]] : []));
}

function readInvocationToolNames(report: AssistantWorkflowSerializedRunReport): string[] {
  const invocations = readNestedArray(report.run, ["toolInvocationQueue", "invocations"]);
  return uniqueNonEmptyStrings(invocations.flatMap((invocation) =>
    isRecord(invocation) ? [invocation["toolName"]] : []
  ));
}

function readSignalNames(report: AssistantWorkflowSerializedRunReport): string[] {
  const signals = readNestedArray(report.evaluation, ["signals"]);
  return uniqueNonEmptyStrings(signals.flatMap((signal) => isRecord(signal) ? [signal["name"]] : []));
}

function uniqueNonEmptyStrings(values: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed.length || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
