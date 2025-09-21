import os from "os";
import path from "path";
import fs from "fs";

/**
 * Abstraction over secure storage for tokens.
 *
 * Prefers OS keychain via `keytar` if available at runtime.
 * Falls back to a local file store with restricted permissions.
 */
export interface ISecureStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

/**
 * Try to lazily import keytar without making it a hard dependency.
 */
async function tryLoadKeytar(): Promise<any | null> {
  try {
    // Avoid static import to prevent type resolution errors when not installed
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;
    const mod = await dynamicImport("keytar");
    return (mod && (mod.default || mod)) ?? null;
  } catch {
    return null;
  }
}

class KeytarStore implements ISecureStore {
  private service: string;
  private keytar: any;
  constructor(service: string, keytar: any) {
    this.service = service;
    this.keytar = keytar;
  }
  async get(key: string): Promise<string | null> {
    return (await this.keytar.getPassword(this.service, key)) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    await this.keytar.setPassword(this.service, key, value);
  }
  async del(key: string): Promise<void> {
    await this.keytar.deletePassword(this.service, key);
  }
}

class FileStore implements ISecureStore {
  private filePath: string;

  constructor(namespace: string) {
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
    } catch {
      // ignore
    }
  }

  private static resolveBaseDir(): string {
    if (process.platform === "win32") {
      return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    }
    // Linux and macOS default to XDG_CONFIG_HOME or ~/.config
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  }

  private static sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  }

  private async load(): Promise<Record<string, string>> {
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf-8");
      return JSON.parse(raw || "{}");
    } catch {
      return {};
    }
  }

  private async save(data: Record<string, string>): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(this.filePath, json, { mode: 0o600 });
    try {
      fs.chmodSync(this.filePath, 0o600);
    } catch {
      // ignore
    }
  }

  async get(key: string): Promise<string | null> {
    const data = await this.load();
    return data[key] ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const data = await this.load();
    data[key] = value;
    await this.save(data);
  }

  async del(key: string): Promise<void> {
    const data = await this.load();
    delete data[key];
    await this.save(data);
  }
}

export class SecureStoreFactory {
  /**
   * Creates a secure store for a namespace. Tries keytar first; falls back to file store.
   */
  static async create(namespace: string): Promise<ISecureStore> {
    const keytar = await tryLoadKeytar();
    if (keytar) {
      return new KeytarStore(namespace, keytar);
    }
    return new FileStore(namespace);
  }
}
