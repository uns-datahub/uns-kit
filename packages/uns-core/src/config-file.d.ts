import type { AppConfig } from "./config/app-config.js";
import { type ResolvedAppConfig, type SecretResolverOptions } from "./uns-config/secret-resolver.js";
export declare class ConfigFile {
    private static rawCache?;
    private static rawPath?;
    private static resolvedCache?;
    static loadRawConfig(configPath?: string): AppConfig;
    static get(): AppConfig;
    static loadConfig(configPath?: string, options?: SecretResolverOptions): Promise<ResolvedAppConfig>;
    static loadResolvedConfig(options?: SecretResolverOptions): Promise<ResolvedAppConfig>;
    static clearCache(): void;
}
//# sourceMappingURL=config-file.d.ts.map