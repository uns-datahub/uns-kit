export type AssistantWorkflowToolResultCacheStats = {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  size: number;
};

export type AssistantWorkflowToolResultCacheOptions = {
  maxEntries?: number;
  cacheableToolNames?: ReadonlySet<string> | readonly string[] | null;
  isCacheableTool?: (toolName: string) => boolean;
  sortArrayArgKeys?: readonly string[];
  chooseTtlMs?: (args: Record<string, unknown>, nowMs: number) => number;
  shouldCacheValue?: (value: string) => boolean;
};

type CacheEntry = {
  value: string;
  expiresAt: number;
  key: string;
};

const TTL_LIVE_MS = 30_000;
const TTL_RECENT_MS = 5 * 60_000;
const TTL_DAY_MS = 30 * 60_000;
const TTL_HISTORICAL_MS = 2 * 60 * 60_000;
const TTL_NO_RANGE_MS = 15 * 60_000;

export function chooseAssistantWorkflowToolResultCacheTtlMs(
  args: Record<string, unknown>,
  nowMs: number,
): number {
  const toMs = parseIsoMs(args["to"]);
  if (toMs === null) return TTL_NO_RANGE_MS;
  const ageMs = nowMs - toMs;
  if (ageMs < 5 * 60_000) return TTL_LIVE_MS;
  if (ageMs < 60 * 60_000) return TTL_RECENT_MS;
  if (ageMs < 24 * 60 * 60_000) return TTL_DAY_MS;
  return TTL_HISTORICAL_MS;
}

export function buildAssistantWorkflowToolResultCacheKey(
  scopeId: string,
  toolName: string,
  args: Record<string, unknown>,
  options: Pick<AssistantWorkflowToolResultCacheOptions, "sortArrayArgKeys"> = {},
): string {
  const sortArrayArgKeys = new Set(options.sortArrayArgKeys ?? []);
  const normalizedArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (sortArrayArgKeys.has(key) && Array.isArray(value)) {
      normalizedArgs[key] = [...value]
        .filter((entry): entry is string => typeof entry === "string")
        .sort();
    } else {
      normalizedArgs[key] = value;
    }
  }
  return JSON.stringify({
    t: scopeId,
    n: toolName,
    a: normalizeToolResultCacheValue(normalizedArgs),
  });
}

export function normalizeToolResultCacheValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && /\d{4}-\d{2}-\d{2}T/.test(value)) {
      return { __ts: parsed };
    }
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map(normalizeToolResultCacheValue);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(record).sort();
    for (const key of keys) {
      const normalized = normalizeToolResultCacheValue(record[key]);
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return String(value);
}

export class AssistantWorkflowToolResultCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly cacheableToolNames: ReadonlySet<string> | null;
  private readonly isCacheableToolFn: ((toolName: string) => boolean) | null;
  private readonly sortArrayArgKeys: readonly string[];
  private readonly chooseTtlMsFn: (args: Record<string, unknown>, nowMs: number) => number;
  private readonly shouldCacheValueFn: (value: string) => boolean;
  private stats: AssistantWorkflowToolResultCacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
    size: 0,
  };

  constructor(options: AssistantWorkflowToolResultCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? 500);
    this.cacheableToolNames = options.cacheableToolNames
      ? new Set(options.cacheableToolNames)
      : null;
    this.isCacheableToolFn = options.isCacheableTool ?? null;
    this.sortArrayArgKeys = [...(options.sortArrayArgKeys ?? [])];
    this.chooseTtlMsFn = options.chooseTtlMs ?? chooseAssistantWorkflowToolResultCacheTtlMs;
    this.shouldCacheValueFn = options.shouldCacheValue ?? defaultShouldCacheToolResultValue;
  }

  isCacheableTool(toolName: string): boolean {
    if (this.isCacheableToolFn) return this.isCacheableToolFn(toolName);
    if (!this.cacheableToolNames) return true;
    return this.cacheableToolNames.has(toolName);
  }

  get(
    scopeId: string,
    toolName: string,
    args: Record<string, unknown>,
    nowMs: number,
  ): string | null {
    if (!this.isCacheableTool(toolName)) return null;
    const key = this.buildKey(scopeId, toolName, args);
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses += 1;
      return null;
    }
    if (entry.expiresAt <= nowMs) {
      this.cache.delete(key);
      this.stats.expirations += 1;
      this.stats.misses += 1;
      this.stats.size = this.cache.size;
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.stats.hits += 1;
    return entry.value;
  }

  set(
    scopeId: string,
    toolName: string,
    args: Record<string, unknown>,
    value: string,
    nowMs: number,
  ): void {
    if (!this.isCacheableTool(toolName)) return;
    if (!this.shouldCacheValueFn(value)) return;
    const key = this.buildKey(scopeId, toolName, args);
    const ttlMs = this.chooseTtlMsFn(args, nowMs);
    const expiresAt = nowMs + ttlMs;
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (typeof oldestKey === "string") {
        this.cache.delete(oldestKey);
        this.stats.evictions += 1;
      }
    }
    this.cache.set(key, { value, expiresAt, key });
    this.stats.size = this.cache.size;
  }

  clearScope(scopeId: string): void {
    const prefix = JSON.stringify({ t: scopeId }).slice(0, -1);
    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    this.stats.size = this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  getStats(): AssistantWorkflowToolResultCacheStats {
    return { ...this.stats };
  }

  private buildKey(
    scopeId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): string {
    return buildAssistantWorkflowToolResultCacheKey(scopeId, toolName, args, {
      sortArrayArgKeys: this.sortArrayArgKeys,
    });
  }
}

function defaultShouldCacheToolResultValue(value: string): boolean {
  return typeof value === "string" && value.length > 0 && !value.startsWith("Error:");
}

function parseIsoMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
