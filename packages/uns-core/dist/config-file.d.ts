import type { AppConfig } from "./app-config";
import { type ResolvedAppConfig, type SecretResolverOptions } from "./uns-config/secret-resolver";
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
