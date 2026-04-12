import { AuthClient } from "../auth/auth-client.js";

export type LastValuePayload = {
  topic: string;
  value: unknown;
  values?: Record<string, unknown> | null;
  uom?: string | null;
  timestamp?: string | null;
  dataGroup?: string | null;
  ageMs?: number | null;
  source: string;
};

export class LastValueResult {
  readonly topic: string;
  readonly value: unknown;
  readonly values?: Record<string, unknown> | null;
  readonly uom?: string | null;
  readonly timestamp?: string | null;
  readonly dataGroup?: string | null;
  readonly ageMs?: number | null;
  readonly source: string;

  constructor(payload: LastValuePayload) {
    this.topic = payload.topic;
    this.value = payload.value;
    this.values = payload.values ?? null;
    this.uom = payload.uom ?? null;
    this.timestamp = payload.timestamp ?? null;
    this.dataGroup = payload.dataGroup ?? null;
    this.ageMs = payload.ageMs ?? null;
    this.source = payload.source;
  }

  static fromMapping(value: Record<string, unknown>): LastValueResult {
    const rawValues = value.values;
    return new LastValueResult({
      topic: typeof value.topic === "string" ? value.topic : "",
      value: value.value,
      values: rawValues && typeof rawValues === "object" && !Array.isArray(rawValues) ? (rawValues as Record<string, unknown>) : null,
      uom: typeof value.uom === "string" ? value.uom : null,
      timestamp: typeof value.timestamp === "string" ? value.timestamp : null,
      dataGroup: typeof value.dataGroup === "string" ? value.dataGroup : null,
      ageMs: typeof value.ageMs === "number" ? value.ageMs : null,
      source: typeof value.source === "string" ? value.source : "miss",
    });
  }

  get hit(): boolean {
    return this.source === "cache";
  }

  toObject(): LastValuePayload {
    return {
      topic: this.topic,
      value: this.value,
      values: this.values ?? null,
      uom: this.uom ?? null,
      timestamp: this.timestamp ?? null,
      dataGroup: this.dataGroup ?? null,
      ageMs: this.ageMs ?? null,
      source: this.source,
    };
  }
}

export class LastValueClientError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type UnsClientOptions = {
  apiBasePath?: string;
  token?: string;
  timeoutMs?: number;
  authClient?: AuthClient;
};

export class UnsClient {
  private readonly apiBasePath: string;
  private readonly baseUrl: string;
  private readonly apiUrl: string;
  private readonly timeoutMs: number;
  private readonly authClient?: AuthClient;
  private accessToken?: string;

  constructor(baseUrl: string, options: UnsClientOptions = {}) {
    const apiBasePath = UnsClient.normalizeBasePath(options.apiBasePath ?? "/api");
    const strippedBase = baseUrl.replace(/\/$/, "");
    if (apiBasePath && strippedBase.endsWith(apiBasePath)) {
      this.apiUrl = strippedBase;
      this.baseUrl = strippedBase.slice(0, -apiBasePath.length).replace(/\/$/, "");
    } else {
      this.baseUrl = strippedBase;
      this.apiUrl = `${strippedBase}${apiBasePath}`;
    }
    this.apiBasePath = apiBasePath;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.authClient = options.authClient;
    this.accessToken = options.token;
  }

  setToken(token?: string): void {
    this.accessToken = token;
  }

  async ensureToken(): Promise<string | undefined> {
    if (this.accessToken) return this.accessToken;
    if (!this.authClient) return undefined;
    const token = await this.authClient.getAccessToken();
    this.accessToken = token;
    return token;
  }

  async get(endpoint: string, params?: Record<string, string | number | boolean>, options: { baseUrl?: string; authorize?: boolean } = {}): Promise<Record<string, unknown>> {
    const authorize = options.authorize ?? true;
    const token = authorize ? await this.ensureToken() : undefined;
    const search = params ? `?${new URLSearchParams(this.stringifyQueryParams(params))}` : "";
    return this.requestJson("GET", `${this.buildUrl(endpoint, options.baseUrl)}${search}`, undefined, token);
  }

  async post(endpoint: string, body?: Record<string, unknown>, options: { baseUrl?: string; authorize?: boolean } = {}): Promise<Record<string, unknown>> {
    const authorize = options.authorize ?? true;
    const token = authorize ? await this.ensureToken() : undefined;
    return this.requestJson("POST", this.buildUrl(endpoint, options.baseUrl), body ?? {}, token);
  }

  async lastValue(topics: string | string[], options: { token?: string } = {}): Promise<Record<string, LastValuePayload> | null> {
    const topicList = Array.isArray(topics) ? topics : [topics];
    if (!topicList.length) {
      throw new Error("topics must contain at least one topic.");
    }
    if (topicList.length > 500) {
      throw new Error("Maximum 500 topics per request.");
    }
    const token = options.token ?? (await this.ensureToken());
    try {
      const payload = await this.requestJson("POST", this.buildUrl("/batch/last"), { topics: topicList }, token);
      const rawResults = payload.results;
      if (!Array.isArray(rawResults)) {
        throw new LastValueClientError("Last-value response did not include a results array.");
      }
      const results = rawResults
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
        .map((item) => LastValueResult.fromMapping(item));
      return Object.fromEntries(results.map((result) => [result.topic, result.toObject()]));
    } catch (error) {
      if (error instanceof LastValueClientError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private async requestJson(
    method: "GET" | "POST",
    url: string,
    body?: Record<string, unknown>,
    token?: string,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method,
        headers: {
          "Accept": "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      const text = await resp.text();
      if (!resp.ok) {
        throw new LastValueClientError(
          `UNS request failed with HTTP ${resp.status}: ${text || resp.statusText}`,
          resp.status,
        );
      }
      if (!text) return {};
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new LastValueClientError("UNS response must be a JSON object.");
      }
      return parsed as Record<string, unknown>;
    } catch (error: any) {
      if (error instanceof LastValueClientError) {
        throw error;
      }
      if (error?.name === "AbortError") {
        throw new LastValueClientError("UNS request timed out.");
      }
      throw new LastValueClientError(`UNS request failed: ${error?.message ?? String(error)}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(endpoint: string, baseUrl?: string): string {
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
      return endpoint;
    }
    const root = (baseUrl ?? this.apiUrl).replace(/\/$/, "");
    let path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    if (!baseUrl && this.apiBasePath && (path === this.apiBasePath || path.startsWith(`${this.apiBasePath}/`))) {
      path = path.slice(this.apiBasePath.length) || "/";
    }
    return `${root}${path}`;
  }

  private stringifyQueryParams(params: Record<string, string | number | boolean>): Record<string, string> {
    return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
  }

  private static normalizeBasePath(value: string): string {
    const stripped = value.trim();
    if (!stripped) return "";
    return stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
}
