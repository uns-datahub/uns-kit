import type { AssistantWorkflowToolInvocation } from "./tool-invocations.js";

export type AssistantWorkflowToolInvocationHandoffArgs = Readonly<Record<string, unknown>>;

/**
 * Controller or host-provided arguments for one exact invocation in a rebuilt
 * workflow plan. The runtime must never derive a handoff from model text.
 */
export type AssistantWorkflowToolInvocationHandoff = {
  invocationId: string;
  toolName: string;
  args: AssistantWorkflowToolInvocationHandoffArgs;
};

/**
 * Application-owned validation for a reviewed, explicitly handed-off tool.
 * Keeping this as a function lets each application enforce its own precise
 * argument contract without the workflow package owning tool schemas.
 */
export type AssistantWorkflowToolInvocationHandoffPolicy = {
  toolName: string;
  normalizeArgs: (
    args: AssistantWorkflowToolInvocationHandoffArgs,
  ) => AssistantWorkflowToolInvocationHandoffArgs | null;
};

export type AssistantWorkflowApprovedToolInvocation<
  TPolicy extends AssistantWorkflowToolInvocationHandoffPolicy = AssistantWorkflowToolInvocationHandoffPolicy,
> = {
  policy: TPolicy;
  invocation: AssistantWorkflowToolInvocation;
  args: AssistantWorkflowToolInvocationHandoffArgs;
};

export type SelectAssistantWorkflowApprovedToolInvocationInput<
  TPolicy extends AssistantWorkflowToolInvocationHandoffPolicy = AssistantWorkflowToolInvocationHandoffPolicy,
> = {
  invocations: readonly AssistantWorkflowToolInvocation[];
  handoffs: readonly AssistantWorkflowToolInvocationHandoff[];
  policies: readonly TPolicy[];
  allowedToolNames: readonly string[];
};

/**
 * Selects one exact, allowlisted invocation from a rebuilt workflow plan.
 *
 * This intentionally accepts exactly one controller/host handoff. Multiple
 * records are rejected rather than silently ignoring broader authorization.
 * Argument validation remains application-owned through the supplied policy.
 */
export function selectAssistantWorkflowApprovedToolInvocation<
  TPolicy extends AssistantWorkflowToolInvocationHandoffPolicy,
>(
  input: SelectAssistantWorkflowApprovedToolInvocationInput<TPolicy>,
): AssistantWorkflowApprovedToolInvocation<TPolicy> | null {
  if (input.handoffs.length !== 1) return null;

  const allowedToolNames = new Set(input.allowedToolNames);
  const approved: AssistantWorkflowApprovedToolInvocation<TPolicy>[] = [];
  for (const policy of input.policies) {
    if (!allowedToolNames.has(policy.toolName)) continue;
    for (const invocation of input.invocations) {
      if (invocation.toolName !== policy.toolName) continue;
      const handoff = findExactHandoff(input.handoffs, invocation);
      if (!handoff) continue;
      const args = policy.normalizeArgs(handoff.args);
      if (args) approved.push({ policy, invocation, args });
    }
  }
  return approved.length === 1 ? approved[0] ?? null : null;
}

function findExactHandoff(
  handoffs: readonly AssistantWorkflowToolInvocationHandoff[],
  invocation: AssistantWorkflowToolInvocation,
): AssistantWorkflowToolInvocationHandoff | null {
  const matches = handoffs.filter(
    (handoff) => handoff.invocationId === invocation.id && handoff.toolName === invocation.toolName,
  );
  return matches.length === 1 ? matches[0] ?? null : null;
}
