import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config/app-config.js";
import {
  clearSecretResolverCaches,
  resolveConfigSecrets,
  type ResolvedAppConfig,
  type SecretResolverOptions,
} from "./uns-config/secret-resolver.js";

const hasOptions = (options?: SecretResolverOptions): boolean =>
  !!options && Object.values(options).some(value => value !== undefined);

export class ConfigFile {
  private static rawCache?: AppConfig;
  private static rawPath?: string;
  private static resolvedCache?: ResolvedAppConfig;

  static loadRawConfig(configPath?: string): AppConfig {
    const p = configPath ?? path.resolve(process.cwd(), "config.json");
    if (!this.rawCache || this.rawPath !== p) {
      const raw = fs.readFileSync(p, "utf8");
      this.rawCache = JSON.parse(raw) as AppConfig; // no runtime validation
      this.rawPath = p;
      this.resolvedCache = undefined;
    }
    return this.rawCache;
  }

  static get(): AppConfig {
    if (!this.rawCache) {
      throw new Error("Config not loaded. Call ConfigFile.loadConfig() first.");
    }
    return this.rawCache;
  }

  static async loadConfig(
    configPath?: string,
    options?: SecretResolverOptions
  ): Promise<ResolvedAppConfig> {
    const raw = this.loadRawConfig(configPath);

    if (!this.resolvedCache) {
      this.resolvedCache = await resolveConfigSecrets(raw, options);
    }

    return this.resolvedCache;
  }

  static async loadResolvedConfig(
    options?: SecretResolverOptions
  ): Promise<ResolvedAppConfig> {
    return this.loadConfig(undefined, options);
  }

  static clearCache(): void {
    this.rawCache = undefined;
    this.resolvedCache = undefined;
    this.rawPath = undefined;
    clearSecretResolverCaches();
  }
}
