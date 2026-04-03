import fs from "node:fs";
import path from "node:path";
import { clearSecretResolverCaches, resolveConfigSecrets, } from "./uns-config/secret-resolver.js";
const hasOptions = (options) => !!options && Object.values(options).some(value => value !== undefined);
export class ConfigFile {
    static rawCache;
    static rawPath;
    static resolvedCache;
    static loadRawConfig(configPath) {
        const p = configPath ?? path.resolve(process.cwd(), "config.json");
        if (!this.rawCache || this.rawPath !== p) {
            const raw = fs.readFileSync(p, "utf8");
            this.rawCache = JSON.parse(raw); // no runtime validation
            this.rawPath = p;
            this.resolvedCache = undefined;
        }
        return this.rawCache;
    }
    static get() {
        if (!this.rawCache) {
            throw new Error("Config not loaded. Call ConfigFile.loadConfig() first.");
        }
        return this.rawCache;
    }
    static async loadConfig(configPath, options) {
        const raw = this.loadRawConfig(configPath);
        if (!this.resolvedCache) {
            this.resolvedCache = await resolveConfigSecrets(raw, options);
        }
        return this.resolvedCache;
    }
    static async loadResolvedConfig(options) {
        return this.loadConfig(undefined, options);
    }
    static clearCache() {
        this.rawCache = undefined;
        this.resolvedCache = undefined;
        this.rawPath = undefined;
        clearSecretResolverCaches();
    }
}
//# sourceMappingURL=config-file.js.map