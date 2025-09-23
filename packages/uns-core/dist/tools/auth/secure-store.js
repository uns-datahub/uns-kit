import os from "os";
import path from "path";
import fs from "fs";
/**
 * Try to lazily import keytar without making it a hard dependency.
 */
async function tryLoadKeytar() {
    try {
        // Avoid static import to prevent type resolution errors when not installed
        const dynamicImport = new Function("m", "return import(m)");
        const mod = await dynamicImport("keytar");
        return (mod && (mod.default || mod)) ?? null;
    }
    catch {
        return null;
    }
}
class KeytarStore {
    service;
    keytar;
    constructor(service, keytar) {
        this.service = service;
        this.keytar = keytar;
    }
    async get(key) {
        return (await this.keytar.getPassword(this.service, key)) ?? null;
    }
    async set(key, value) {
        await this.keytar.setPassword(this.service, key, value);
    }
    async del(key) {
        await this.keytar.deletePassword(this.service, key);
    }
}
class FileStore {
    filePath;
    constructor(namespace) {
        const baseDir = FileStore.resolveBaseDir();
        const folder = path.join(baseDir, "uns-auth");
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
        }
        this.filePath = path.join(folder, `${FileStore.sanitize(namespace)}.json`);
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, "{}", { mode: 0o600 });
        }
        try {
            // tighten permissions if possible (no-op on Windows)
            fs.chmodSync(this.filePath, 0o600);
        }
        catch {
            // ignore
        }
    }
    static resolveBaseDir() {
        if (process.platform === "win32") {
            return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
        }
        // Linux and macOS default to XDG_CONFIG_HOME or ~/.config
        return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    }
    static sanitize(name) {
        return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    }
    async load() {
        try {
            const raw = await fs.promises.readFile(this.filePath, "utf-8");
            return JSON.parse(raw || "{}");
        }
        catch {
            return {};
        }
    }
    async save(data) {
        const json = JSON.stringify(data, null, 2);
        await fs.promises.writeFile(this.filePath, json, { mode: 0o600 });
        try {
            fs.chmodSync(this.filePath, 0o600);
        }
        catch {
            // ignore
        }
    }
    async get(key) {
        const data = await this.load();
        return data[key] ?? null;
    }
    async set(key, value) {
        const data = await this.load();
        data[key] = value;
        await this.save(data);
    }
    async del(key) {
        const data = await this.load();
        delete data[key];
        await this.save(data);
    }
}
export class SecureStoreFactory {
    /**
     * Creates a secure store for a namespace. Tries keytar first; falls back to file store.
     */
    static async create(namespace) {
        const keytar = await tryLoadKeytar();
        if (keytar) {
            return new KeytarStore(namespace, keytar);
        }
        return new FileStore(namespace);
    }
}
//# sourceMappingURL=secure-store.js.map