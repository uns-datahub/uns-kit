export type AssistantWorkflowExecutionFailureMode =
  | "fail-fast"
  | "continue-independent";

export type AssistantWorkflowExecutionPolicy = {
  failureMode: AssistantWorkflowExecutionFailureMode;
  maxAttemptsPerTool: 1 | 2 | 3;
};

export const DEFAULT_ASSISTANT_WORKFLOW_EXECUTION_POLICY: AssistantWorkflowExecutionPolicy =
  Object.freeze({
    failureMode: "fail-fast",
    maxAttemptsPerTool: 1,
  });

export function assertAssistantWorkflowExecutionPolicy(
  policy: AssistantWorkflowExecutionPolicy,
): void {
  if (policy.failureMode !== "fail-fast" && policy.failureMode !== "continue-independent") {
    throw new Error("Assistant workflow execution policy failureMode is invalid.");
  }
  if (
    policy.maxAttemptsPerTool !== 1 &&
    policy.maxAttemptsPerTool !== 2 &&
    policy.maxAttemptsPerTool !== 3
  ) {
    throw new Error("Assistant workflow execution policy maxAttemptsPerTool must be 1, 2, or 3.");
  }
}

export function resolveAssistantWorkflowExecutionPolicy(
  policy?: AssistantWorkflowExecutionPolicy | null,
): AssistantWorkflowExecutionPolicy {
  if (!policy) return { ...DEFAULT_ASSISTANT_WORKFLOW_EXECUTION_POLICY };
  assertAssistantWorkflowExecutionPolicy(policy);
  return { ...policy };
}
