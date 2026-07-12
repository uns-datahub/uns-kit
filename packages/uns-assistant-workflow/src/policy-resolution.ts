export type AssistantWorkflowPolicyValueSource = "default" | "config" | "db_override";

export type AssistantWorkflowPolicyValuePresence<TPolicy> = (value: TPolicy | null | undefined) => boolean;

export function normalizeAssistantWorkflowPolicyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizeAssistantWorkflowPolicyBaseUrl(value: unknown): string | null {
  const trimmed = normalizeAssistantWorkflowPolicyString(value);
  return trimmed === null ? null : trimmed.replace(/\/+$/, "");
}

export function hasAssistantWorkflowBooleanPolicyValue(value: unknown): boolean {
  return typeof value === "boolean";
}

export function hasAssistantWorkflowStringPolicyValue(value: unknown): boolean {
  return normalizeAssistantWorkflowPolicyString(value) !== null;
}

export function getAssistantWorkflowPolicyValueSource<TPolicy>(
  configOverride: TPolicy | null | undefined,
  runtimeOverride: TPolicy | null | undefined,
  hasValue: AssistantWorkflowPolicyValuePresence<TPolicy>,
): AssistantWorkflowPolicyValueSource {
  if (hasValue(runtimeOverride)) return "db_override";
  if (hasValue(configOverride)) return "config";
  return "default";
}

export function hasAssistantWorkflowPolicyOverride<TPolicy>(
  override: TPolicy | null | undefined,
  hasValueChecks: readonly AssistantWorkflowPolicyValuePresence<TPolicy>[],
): boolean {
  return Boolean(override && hasValueChecks.some((hasValue) => hasValue(override)));
}

export function resolveAssistantWorkflowPolicyValue<TPolicy, TValue>(
  defaults: TPolicy,
  override: TPolicy | null | undefined,
  readValue: (value: TPolicy) => TValue,
  hasValue: AssistantWorkflowPolicyValuePresence<TPolicy>,
): TValue {
  return hasValue(override) ? readValue(override as TPolicy) : readValue(defaults);
}
