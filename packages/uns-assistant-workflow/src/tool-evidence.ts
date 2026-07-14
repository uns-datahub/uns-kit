/**
 * Provider- and transport-neutral envelope for a tool result that may be used
 * as controlled evidence by a later response-synthesis step. Applications own
 * the format string and validate their domain-specific `data` payload.
 */
export type AssistantWorkflowToolEvidenceEnvelope<TData = unknown> = {
  format: string;
  formatVersion: number;
  invocationId: string;
  toolName: string;
  callId: string;
  issuedAt: string;
  expiresAt: string;
  data: TData;
};

export type AssistantWorkflowToolEvidenceContract = {
  format: string;
  formatVersion: number;
  toolNames: readonly string[];
};

export type AssistantWorkflowToolEvidenceBinding = {
  invocationId: string;
  toolName: string;
  callId: string;
  expiresAt: string;
};

export type ParseAssistantWorkflowToolEvidenceOptions<TData> = {
  format: string;
  formatVersion: number;
  parseData: (value: unknown) => TData | null;
};

/**
 * Parses the generic envelope and delegates data validation to the application.
 * The package deliberately does not infer or normalize application result data.
 */
export function parseAssistantWorkflowToolEvidence<TData>(
  value: unknown,
  options: ParseAssistantWorkflowToolEvidenceOptions<TData>,
): AssistantWorkflowToolEvidenceEnvelope<TData> | null {
  if (!isRecord(value)) return null;
  const format = normalizeFormat(value["format"]);
  const formatVersion = value["formatVersion"];
  const invocationId = normalizeIdentifier(value["invocationId"]);
  const toolName = normalizeToolName(value["toolName"]);
  const callId = normalizeIdentifier(value["callId"]);
  const issuedAt = normalizeTimestamp(value["issuedAt"]);
  const expiresAt = normalizeTimestamp(value["expiresAt"]);
  if (
    format !== options.format ||
    formatVersion !== options.formatVersion ||
    !invocationId ||
    !toolName ||
    !callId ||
    !issuedAt ||
    !expiresAt ||
    Date.parse(issuedAt) > Date.parse(expiresAt)
  ) {
    return null;
  }
  const data = options.parseData(value["data"]);
  return data === null
    ? null
    : { format, formatVersion, invocationId, toolName, callId, issuedAt, expiresAt, data };
}

/**
 * Checks that the evidence came from the exact invocation/call delegated by the
 * host. Domain-specific argument-to-data checks remain application-owned.
 */
export function matchesAssistantWorkflowToolEvidenceBinding(
  evidence: AssistantWorkflowToolEvidenceEnvelope,
  binding: AssistantWorkflowToolEvidenceBinding,
  nowMs = Date.now(),
): boolean {
  return evidence.invocationId === binding.invocationId &&
    evidence.toolName === binding.toolName &&
    evidence.callId === binding.callId &&
    evidence.expiresAt === binding.expiresAt &&
    Date.parse(evidence.expiresAt) > nowMs;
}

export function supportsAssistantWorkflowToolEvidence(
  contract: AssistantWorkflowToolEvidenceContract | null | undefined,
  toolName: string,
): boolean {
  const normalizedToolName = normalizeToolName(toolName);
  return Boolean(
    contract &&
    normalizeFormat(contract.format) === contract.format &&
    Number.isInteger(contract.formatVersion) &&
    contract.formatVersion >= 1 &&
    normalizedToolName &&
    Array.isArray(contract.toolNames) &&
    contract.toolNames.some((candidate) => normalizeToolName(candidate) === normalizedToolName),
  );
}

function normalizeFormat(value: unknown): string | null {
  const format = typeof value === "string" ? value.trim() : "";
  return format && format.length <= 160 ? format : null;
}

function normalizeIdentifier(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{1,200}$/.test(value) ? value : null;
}

function normalizeToolName(value: unknown): string | null {
  return typeof value === "string" && /^[a-zA-Z0-9_:-]{1,160}$/.test(value) ? value : null;
}

function normalizeTimestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
