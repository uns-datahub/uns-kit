import { ConfigFile } from "../../config-file";
import { SecureStoreFactory } from "./secure-store";
import jwt from "jsonwebtoken";
import readline from "readline";
/**
 * AuthClient handles acquiring and refreshing JWT access tokens
 * using the configured REST base URL.
 */
export class AuthClient {
    restBase;
    namespace;
    store;
    constructor(restBase) {
        this.restBase = restBase.replace(/\/$/, "");
        // namespace store by rest base to allow multiple environments
        this.namespace = `uns-auth:${this.restBase}`;
    }
    static async create() {
        const cfg = await ConfigFile.loadConfig();
        const restBase = cfg?.uns?.rest;
        if (!restBase)
            throw new Error("config.uns.rest is not set");
        const client = new AuthClient(restBase);
        client.store = await SecureStoreFactory.create(client.namespace);
        return client;
    }
    async getAccessToken() {
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
            }
            catch {
                // ignore, fallback to login
            }
        }
        // Interactive login
        const { email, password } = await AuthClient.promptCredentials();
        const loggedIn = await this.login(email, password);
        await this.persistTokens(loggedIn.accessToken, loggedIn.refreshToken);
        return loggedIn.accessToken;
    }
    static isExpired(token, skewSeconds = 30) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || typeof decoded !== "object" || !decoded.exp)
                return true;
            const now = Math.floor(Date.now() / 1000);
            return decoded.exp <= now + skewSeconds;
        }
        catch {
            return true;
        }
    }
    static endpoint(base, tail) {
        // base ends without trailing slash; tail must not start with slash
        const b = base.replace(/\/$/, "");
        const t = tail.replace(/^\//, "");
        return `${b}/${t}`;
    }
    static async fetchWithTimeout(url, init = {}, timeoutMs = 10_000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const resp = await fetch(url, { ...init, signal: controller.signal });
            return resp;
        }
        finally {
            clearTimeout(id);
        }
    }
    static extractRefreshCookie(resp) {
        const anyHeaders = resp.headers;
        const getSetCookie = typeof anyHeaders.getSetCookie === "function" ? anyHeaders.getSetCookie.bind(anyHeaders) : null;
        const candidates = getSetCookie ? getSetCookie() : (resp.headers.get("set-cookie") ? [resp.headers.get("set-cookie")] : []);
        for (const header of candidates) {
            const match = header.match(/(?:^|;\s*)RefreshToken=([^;]+)/i);
            if (match)
                return match[1];
        }
        return null;
    }
    async login(email, password) {
        const url = AuthClient.endpoint(this.restBase, "auth/login");
        const resp = await AuthClient.fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        }, 12_000);
        if (!resp.ok) {
            throw new Error(`Login failed: ${resp.status} ${resp.statusText}`);
        }
        const data = (await resp.json());
        const refreshToken = AuthClient.extractRefreshCookie(resp);
        if (!data?.accessToken || !refreshToken) {
            throw new Error("Login response missing tokens");
        }
        return { accessToken: data.accessToken, refreshToken };
    }
    async refresh(refreshToken) {
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
        const data = (await resp.json());
        const newRefreshToken = AuthClient.extractRefreshCookie(resp) || refreshToken;
        if (!data?.accessToken)
            throw new Error("Refresh response missing accessToken");
        return { accessToken: data.accessToken, refreshToken: newRefreshToken };
    }
    async persistTokens(accessToken, refreshToken) {
        await this.store.set("accessToken", accessToken);
        await this.store.set("refreshToken", refreshToken);
    }
    static async promptCredentials() {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        const ask = (q) => new Promise((resolve) => rl.question(q, (ans) => resolve(ans.trim())));
        const askMasked = (q) => new Promise((resolve) => {
            const anyRl = rl;
            const out = anyRl.output || process.stdout;
            const origWrite = anyRl._writeToOutput?.bind(rl) || ((s) => out.write(s));
            anyRl.stdoutMuted = true;
            anyRl._writeToOutput = function (stringToWrite) {
                // Keep prompt text intact; mask user input
                if (anyRl.stdoutMuted) {
                    if (stringToWrite.startsWith(q)) {
                        out.write(stringToWrite);
                    }
                    else if (stringToWrite.endsWith("\n")) {
                        out.write("\n");
                    }
                    else {
                        out.write("*");
                    }
                }
                else {
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
        }
        catch (e) {
            rl.close();
            throw e;
        }
    }
}
