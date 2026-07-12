export type AssistantWorkflowStringReadOptions = {
  trim?: boolean;
  allowEmpty?: boolean;
};

export type AssistantWorkflowStringArrayReadOptions = AssistantWorkflowStringReadOptions & {
  unique?: boolean;
  requireAllStrings?: boolean;
};

export function readAssistantWorkflowRecord<T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown,
): T | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as T
    : null;
}

export function readAssistantWorkflowString(
  value: unknown,
  options: AssistantWorkflowStringReadOptions = {},
): string | null {
  if (typeof value !== "string") return null;
  const normalized = options.trim === false ? value : value.trim();
  if (options.allowEmpty === true) return normalized;
  return value.trim().length ? normalized : null;
}

export function readAssistantWorkflowStringOrDefault(
  value: unknown,
  fallback: string,
  options: AssistantWorkflowStringReadOptions = {},
): string {
  return readAssistantWorkflowString(value, options) ?? fallback;
}

export function readAssistantWorkflowStringArray(
  value: unknown,
  options: AssistantWorkflowStringArrayReadOptions = {},
): string[] {
  if (!Array.isArray(value)) return [];
  if (options.requireAllStrings === true && !value.every((entry) => typeof entry === "string")) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const normalized = readAssistantWorkflowString(entry, options);
    if (normalized === null) continue;
    if (options.unique === false) {
      out.push(normalized);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function readAssistantWorkflowNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readAssistantWorkflowNumberOrDefault(value: unknown, fallback: number): number {
  return readAssistantWorkflowNumber(value) ?? fallback;
}

export function readAssistantWorkflowBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function readAssistantWorkflowBooleanOrDefault(value: unknown, fallback: boolean): boolean {
  return readAssistantWorkflowBoolean(value) ?? fallback;
}

export function readAssistantWorkflowBooleanRecord(value: unknown): Record<string, boolean> {
  const record = readAssistantWorkflowRecord(value);
  if (!record) return {};
  const out: Record<string, boolean> = {};
  for (const [key, rawValue] of Object.entries(record)) {
    if (typeof rawValue === "boolean") out[key] = rawValue;
  }
  return out;
}

export function readAssistantWorkflowNestedArray(value: unknown, path: readonly string[]): unknown[] {
  let current = value;
  for (const key of path) {
    const record = readAssistantWorkflowRecord(current);
    if (!record) return [];
    current = record[key];
  }
  return Array.isArray(current) ? current : [];
}

export function readAssistantWorkflowNestedString(
  value: unknown,
  path: readonly string[],
  options: AssistantWorkflowStringReadOptions = {},
): string | null {
  let current = value;
  for (const key of path) {
    const record = readAssistantWorkflowRecord(current);
    if (!record) return null;
    current = record[key];
  }
  return readAssistantWorkflowString(current, options);
}
