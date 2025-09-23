import { ConfigFile } from "../../config-file";
import { SecureStoreFactory, ISecureStore } from "./secure-store";
import jwt from "jsonwebtoken";
import readline from "readline";

type LoginResponse = {
  accessToken: string;
};

/**
 * AuthClient handles acquiring and refreshing JWT access tokens
 * using the configured REST base URL.
 */
export class AuthClient {
  private readonly restBase: string;
  private readonly namespace: string;
  private store!: ISecureStore;

  private constructor(restBase: string) {
    this.restBase = restBase.replace(/\/$/, "");
    // namespace store by rest base to allow multiple environments
    this.namespace = `uns-auth:${this.restBase}`;
  }

  static async create(): Promise<AuthClient> {
    const cfg = await ConfigFile.loadConfig();
    const restBase: string = cfg?.uns?.rest;
    if (!restBase) throw new Error("config.uns.rest is not set");
    const client = new AuthClient(restBase);
    client.store = await SecureStoreFactory.create(client.namespace);
    return client;
  }

  async getAccessToken(): Promise<string> {
    const accessToken = await this.store.get("accessToken");
    const refreshToken = await this.store.get("refreshToken");

    if (accessToken && !AuthClient.isExpired(accessToken)) {
      return accessToken;
    }

    // Try refresh if we have refresh token
    if (refreshToken) {
      try {
        const refreshed = await this.refresh(refreshToken);
        await this.persistTokens(refreshed.accessToken, refreshed.refreshToken);
        return refreshed.accessToken;
      } catch {
        // ignore, fallback to login
      }
    }

    // Interactive login
    const { email, password } = await AuthClient.promptCredentials();
    const loggedIn = await this.login(email, password);
    await this.persistTokens(loggedIn.accessToken, loggedIn.refreshToken);
    return loggedIn.accessToken;
  }

  private static isExpired(token: string, skewSeconds = 30): boolean {
    try {
      const decoded: any = jwt.decode(token);
      if (!decoded || typeof decoded !== "object" || !decoded.exp) return true;
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp <= now + skewSeconds;
    } catch {
      return true;
    }
  }

  private static endpoint(base: string, tail: string): string {
    // base ends without trailing slash; tail must not start with slash
    const b = base.replace(/\/$/, "");
    const t = tail.replace(/^\//, "");
    return `${b}/${t}`;
  }

  private static async fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { ...init, signal: controller.signal });
      return resp;
    } finally {
      clearTimeout(id);
    }
  }

  private static extractRefreshCookie(resp: Response): string | null {
    const anyHeaders: any = resp.headers as any;
    const getSetCookie = typeof anyHeaders.getSetCookie === "function" ? anyHeaders.getSetCookie.bind(anyHeaders) : null;
    const candidates: string[] = getSetCookie ? getSetCookie() : (resp.headers.get("set-cookie") ? [resp.headers.get("set-cookie") as string] : []);
    for (const header of candidates) {
      const match = header.match(/(?:^|;\s*)RefreshToken=([^;]+)/i);
      if (match) return match[1];
    }
    return null;
  }

  private async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; }> {
    const url = AuthClient.endpoint(this.restBase, "auth/login");
    const resp = await AuthClient.fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }, 12_000);

    if (!resp.ok) {
      throw new Error(`Login failed: ${resp.status} ${resp.statusText}`);
    }
    const data = (await resp.json()) as LoginResponse;
    const refreshToken = AuthClient.extractRefreshCookie(resp);
    if (!data?.accessToken || !refreshToken) {
      throw new Error("Login response missing tokens");
    }
    return { accessToken: data.accessToken, refreshToken };
  }

  private async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; }> {
    const url = AuthClient.endpoint(this.restBase, "auth/refresh");
    const resp = await AuthClient.fetchWithTimeout(url, {
      method: "POST",
      headers: {
        // server expects cookie RefreshToken
        "Cookie": `RefreshToken=${refreshToken}`,
      },
    }, 8_000);

    if (!resp.ok) {
      throw new Error(`Refresh failed: ${resp.status} ${resp.statusText}`);
    }
    const data = (await resp.json()) as LoginResponse;
    const newRefreshToken = AuthClient.extractRefreshCookie(resp) || refreshToken;
    if (!data?.accessToken) throw new Error("Refresh response missing accessToken");
    return { accessToken: data.accessToken, refreshToken: newRefreshToken };
  }

  private async persistTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.store.set("accessToken", accessToken);
    await this.store.set("refreshToken", refreshToken);
  }

  static async promptCredentials(): Promise<{ email: string; password: string }> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, (ans) => resolve(ans.trim())));

    const askMasked = (q: string) => new Promise<string>((resolve) => {
      const anyRl = rl as any;
      const out: any = anyRl.output || process.stdout;
      const origWrite = (anyRl._writeToOutput as ((str: string) => void))?.bind(rl) || ((s: string) => out.write(s));
      anyRl.stdoutMuted = true;
      anyRl._writeToOutput = function (stringToWrite: string) {
        // Keep prompt text intact; mask user input
        if (anyRl.stdoutMuted) {
          if (stringToWrite.startsWith(q)) {
            out.write(stringToWrite);
          } else if (stringToWrite.endsWith("\n")) {
            out.write("\n");
          } else {
            out.write("*");
          }
        } else {
          origWrite(stringToWrite);
        }
      };
      rl.question(q, (value) => {
        anyRl.stdoutMuted = false;
        anyRl._writeToOutput = origWrite;
        out.write("\n");
        resolve(value.trim());
      });
    });

    try {
      const email = await ask("Email: ");
      const password = await askMasked("Password: ");
      rl.close();
      return { email, password };
    } catch (e) {
      rl.close();
      throw e;
    }
  }
}
