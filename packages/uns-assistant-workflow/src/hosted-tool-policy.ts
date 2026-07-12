export type AssistantWorkflowHostedToolType = "web_search" | "file_search" | "mcp" | "tool_search";

export type AssistantWorkflowHostedToolDefinition =
  | { type: "web_search" }
  | { type: "file_search"; vector_store_ids: string[] }
  | {
      type: "mcp";
      server_label: string;
      server_url?: string;
      connector_id?: string;
      server_description?: string;
      allowed_tools?: string[] | { read_only?: boolean; tool_names?: string[] };
      require_approval?: "always" | "never";
    }
  | { type: "tool_search" };

export type AssistantWorkflowHostedToolAllowlistEntry<TLane extends string = string> = {
  type: AssistantWorkflowHostedToolType;
  enabled: boolean;
  lanes: TLane[];
  externalOnly: boolean;
  definition: AssistantWorkflowHostedToolDefinition;
};

export type AssistantWorkflowHostedToolPolicy<TLane extends string = string> = {
  enabled: boolean;
  allowlist: AssistantWorkflowHostedToolAllowlistEntry<TLane>[];
};

export type AssistantWorkflowHostedToolBlockedReason =
  | "policy_disabled"
  | "entry_disabled"
  | "responses_transport_required"
  | "lane_not_allowed"
  | "external_intent_required"
  | "duplicate";

export type AssistantWorkflowHostedToolBlockedEntry = {
  type: AssistantWorkflowHostedToolType;
  reason: AssistantWorkflowHostedToolBlockedReason;
};

export type AssistantWorkflowHostedToolSelection = {
  enabled: boolean;
  configuredCount: number;
  tools: AssistantWorkflowHostedToolDefinition[];
  allowedTypes: AssistantWorkflowHostedToolType[];
  blocked: AssistantWorkflowHostedToolBlockedEntry[];
};

export type AssistantWorkflowHostedToolDirective = {
  localTools: "include" | "exclude";
  toolChoice: "auto" | "required";
  reason: string;
};

export type AssistantWorkflowHostedToolIntentClassification = {
  intent?: string | null;
} | null | undefined;

export type AssistantWorkflowHostedToolPolicyParseOptions<TLane extends string = string> = {
  normalizeLane?: (value: string) => TLane | null;
  defaultLanes?: readonly TLane[];
};

const DEFAULT_ASSISTANT_WORKFLOW_HOSTED_TOOL_POLICY: AssistantWorkflowHostedToolPolicy<string> = {
  enabled: false,
  allowlist: [],
};

export function parseAssistantWorkflowHostedToolPolicy<TLane extends string = string>(
  value: unknown,
  options: AssistantWorkflowHostedToolPolicyParseOptions<TLane> = {},
): AssistantWorkflowHostedToolPolicy<TLane> {
  if (!isRecord(value)) {
    return {
      enabled: DEFAULT_ASSISTANT_WORKFLOW_HOSTED_TOOL_POLICY.enabled,
      allowlist: [],
    };
  }
  const rawAllowlist = Array.isArray(value["allowlist"])
    ? value["allowlist"]
    : Array.isArray(value["allowedTools"])
      ? value["allowedTools"]
      : [];
  const allowlist = rawAllowlist
    .map((entry) => parseHostedToolAllowlistEntry(entry, options))
    .filter((entry): entry is AssistantWorkflowHostedToolAllowlistEntry<TLane> => entry !== null);
  return {
    enabled: value["enabled"] === true,
    allowlist,
  };
}

export function selectAssistantWorkflowHostedToolsForRequest<TLane extends string = string>(
  policy: AssistantWorkflowHostedToolPolicy<TLane>,
  input: {
    lane: TLane;
    transport: string | null | undefined;
    externalRequest?: boolean | null;
  },
): AssistantWorkflowHostedToolSelection {
  const transport = normalizeHostedToolTransport(input.transport);
  const externalRequest = input.externalRequest === true;
  const tools: AssistantWorkflowHostedToolDefinition[] = [];
  const allowedTypes: AssistantWorkflowHostedToolType[] = [];
  const blocked: AssistantWorkflowHostedToolBlockedEntry[] = [];
  const seen = new Set<string>();

  for (const entry of policy.allowlist) {
    if (!policy.enabled) {
      blocked.push({ type: entry.type, reason: "policy_disabled" });
      continue;
    }
    if (!entry.enabled) {
      blocked.push({ type: entry.type, reason: "entry_disabled" });
      continue;
    }
    if (transport !== "responses") {
      blocked.push({ type: entry.type, reason: "responses_transport_required" });
      continue;
    }
    if (!entry.lanes.includes(input.lane)) {
      blocked.push({ type: entry.type, reason: "lane_not_allowed" });
      continue;
    }
    if (entry.externalOnly && !externalRequest) {
      blocked.push({ type: entry.type, reason: "external_intent_required" });
      continue;
    }
    const signature = JSON.stringify(entry.definition);
    if (seen.has(signature)) {
      blocked.push({ type: entry.type, reason: "duplicate" });
      continue;
    }
    seen.add(signature);
    tools.push(entry.definition);
    allowedTypes.push(entry.type);
  }

  return {
    enabled: policy.enabled,
    configuredCount: policy.allowlist.length,
    tools,
    allowedTypes,
    blocked,
  };
}

export function isAssistantWorkflowExternalWebSearchClassification(
  classification: AssistantWorkflowHostedToolIntentClassification,
): boolean {
  return classification?.intent === "external_web_search";
}

export function assistantWorkflowRequestHasHostedTool(
  tools: readonly AssistantWorkflowHostedToolDefinition[] | null | undefined,
  type: AssistantWorkflowHostedToolType,
): boolean {
  return (tools ?? []).some((tool) => tool.type === type);
}

export function buildAssistantWorkflowHostedToolDirectiveForRequest(input: {
  externalWebSearchRequest: boolean;
  hostedTools: readonly AssistantWorkflowHostedToolDefinition[] | null | undefined;
}): AssistantWorkflowHostedToolDirective | null {
  if (
    !input.externalWebSearchRequest ||
    !assistantWorkflowRequestHasHostedTool(input.hostedTools, "web_search")
  ) {
    return null;
  }
  return {
    localTools: "exclude",
    toolChoice: "required",
    reason: "external_web_search",
  };
}

export function normalizeAssistantWorkflowHostedToolType(
  value: unknown,
): AssistantWorkflowHostedToolType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "web_search" || normalized === "web_search_preview") return "web_search";
  if (normalized === "file_search") return "file_search";
  if (normalized === "mcp" || normalized === "remote_mcp") return "mcp";
  if (normalized === "tool_search") return "tool_search";
  return null;
}

export function normalizeAssistantWorkflowHostedToolLane(value: string): string | null {
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  return normalized.length ? normalized : null;
}

function parseHostedToolAllowlistEntry<TLane extends string>(
  value: unknown,
  options: AssistantWorkflowHostedToolPolicyParseOptions<TLane>,
): AssistantWorkflowHostedToolAllowlistEntry<TLane> | null {
  const raw = typeof value === "string" ? { type: value } : value;
  if (!isRecord(raw)) return null;
  const type = normalizeAssistantWorkflowHostedToolType(raw["type"]);
  if (!type) return null;
  const definition = buildHostedToolDefinition(type, raw);
  if (!definition) return null;
  return {
    type,
    enabled: raw["enabled"] !== false,
    lanes: parseHostedToolLanes(raw["lanes"], options),
    externalOnly: typeof raw["externalOnly"] === "boolean" ? raw["externalOnly"] : type === "web_search",
    definition,
  };
}

function buildHostedToolDefinition(
  type: AssistantWorkflowHostedToolType,
  raw: Record<string, unknown>,
): AssistantWorkflowHostedToolDefinition | null {
  if (type === "web_search" || type === "tool_search") {
    return { type };
  }
  if (type === "file_search") {
    const vectorStoreIds = toStringArray(raw["vectorStoreIds"] ?? raw["vector_store_ids"]);
    if (!vectorStoreIds.length) return null;
    return {
      type,
      vector_store_ids: vectorStoreIds,
    };
  }
  const serverLabel = toTrimmedString(raw["serverLabel"] ?? raw["server_label"]);
  const serverUrl = toTrimmedString(raw["serverUrl"] ?? raw["server_url"]);
  const connectorId = toTrimmedString(raw["connectorId"] ?? raw["connector_id"]);
  if (!serverLabel || (!serverUrl && !connectorId)) return null;
  const serverDescription = toTrimmedString(raw["serverDescription"] ?? raw["server_description"]);
  const allowedTools = parseMcpAllowedTools(raw);
  const requireApproval = normalizeMcpApproval(raw["requireApproval"] ?? raw["require_approval"]);
  return {
    type: "mcp",
    server_label: serverLabel,
    ...(serverUrl ? { server_url: serverUrl } : {}),
    ...(connectorId ? { connector_id: connectorId } : {}),
    ...(serverDescription ? { server_description: serverDescription } : {}),
    ...(allowedTools ? { allowed_tools: allowedTools } : {}),
    ...(requireApproval ? { require_approval: requireApproval } : {}),
  };
}

function parseHostedToolLanes<TLane extends string>(
  value: unknown,
  options: AssistantWorkflowHostedToolPolicyParseOptions<TLane>,
): TLane[] {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const lanes = new Set<TLane>();
  const normalizeLane = options.normalizeLane ?? ((raw: string) => normalizeAssistantWorkflowHostedToolLane(raw) as TLane | null);
  for (const raw of rawValues) {
    if (typeof raw !== "string") continue;
    const lane = normalizeLane(raw);
    if (lane) lanes.add(lane);
  }
  return lanes.size ? [...lanes] : [...(options.defaultLanes ?? (["assistant"] as TLane[]))];
}

function normalizeHostedToolTransport(value: unknown): "chat_completions" | "responses" {
  if (typeof value !== "string") return "chat_completions";
  const normalized = value.trim().toLowerCase().replace(/[.-]/g, "_");
  if (normalized === "responses" || normalized === "response") return "responses";
  return "chat_completions";
}

function parseMcpAllowedTools(raw: Record<string, unknown>): string[] | { read_only?: boolean; tool_names?: string[] } | null {
  const arrayValue = toStringArray(raw["allowedTools"] ?? raw["allowed_tools"]);
  if (arrayValue.length) return arrayValue;
  const filter = raw["allowedToolFilter"] ?? raw["allowed_tool_filter"];
  if (!isRecord(filter)) return null;
  const readOnly = typeof filter["readOnly"] === "boolean"
    ? filter["readOnly"]
    : typeof filter["read_only"] === "boolean"
      ? filter["read_only"]
      : undefined;
  const toolNames = toStringArray(filter["toolNames"] ?? filter["tool_names"]);
  if (readOnly === undefined && !toolNames.length) return null;
  return {
    ...(readOnly !== undefined ? { read_only: readOnly } : {}),
    ...(toolNames.length ? { tool_names: toolNames } : {}),
  };
}

function normalizeMcpApproval(value: unknown): "always" | "never" | null {
  if (value === true) return "always";
  if (value === false) return "never";
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "always" || normalized === "never") return normalized;
  return null;
}

function toStringArray(value: unknown): string[] {
  const rawValues = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawValues) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
