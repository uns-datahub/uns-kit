import type { NetworkInterfaceInfo } from "node:os";
import type { AppConfig } from "../config/app-config.js";
import { type SecretPlaceholder } from "./secret-placeholders.js";
import { type HostPlaceholder } from "./host-placeholders.js";
export type SecretValueResolved = string | undefined;
export type HostValueResolved = string | undefined;
type SecretPlaceholderCandidate = {
    provider: "env";
    key: string;
} | {
    provider: "infisical";
    key: string;
    path: string;
};
type HostPlaceholderCandidate = HostPlaceholder;
export type ResolvedConfig<T> = T extends SecretPlaceholderCandidate ? SecretValueResolved : T extends HostPlaceholderCandidate ? HostValueResolved : T extends (infer U)[] ? ResolvedConfig<U>[] : T extends Record<string, unknown> ? {
    [K in keyof T]: ResolvedConfig<T[K]>;
} : T;
export type ResolvedAppConfig = ResolvedConfig<AppConfig>;
export interface InfisicalFetchRequest {
    path: string;
    key: string;
    environment?: string;
    projectId?: string;
    type?: "shared" | "personal";
}
export type InfisicalFetcher = (request: InfisicalFetchRequest) => Promise<string | undefined>;
export interface InfisicalResolverOptions {
    /**
     * Provide a custom fetcher. If omitted, the resolver tries to lazily instantiate
     * an Infisical client using @infisical/sdk based on the supplied token/siteUrl/options.
     */
    fetchSecret?: InfisicalFetcher;
    /**
     * Machine token or personal token used when creating the default Infisical client.
     * Falls back to the INFISICAL_TOKEN or INFISICAL_PERSONAL_TOKEN environment variables.
     */
    token?: string;
    /** Optional Infisical site URL override. Defaults to INFISICAL_SITE_URL when present. */
    siteUrl?: string;
    /** Default environment used when a placeholder does not specify one explicitly. */
    environment?: string;
    /** Default project id used when a placeholder does not provide one. */
    projectId?: string;
    /** Default secret type. Shared secrets are used by default. */
    type?: "shared" | "personal";
    /** Disable in-memory caching when set to false. Enabled by default. */
    cache?: boolean;
}
export interface SecretResolverOptions {
    /** Environment map used for `env` placeholders. Defaults to process.env. */
    env?: NodeJS.ProcessEnv;
    /** Configuration for resolving Infisical placeholders. */
    infisical?: InfisicalResolverOptions;
    /** Callback invoked before throwing when a required secret cannot be resolved. */
    onMissingSecret?: (placeholder: SecretPlaceholder, source: "env" | "infisical") => void;
    /** Configuration for resolving host placeholders. */
    hosts?: HostResolverOptions;
}
export interface HostResolverOptions {
    /** Optional environment map used when falling back to process.env lookups. */
    env?: NodeJS.ProcessEnv;
    /** Static mapping of external host keys to concrete host strings. */
    externalHosts?: Record<string, string | undefined>;
    /**
     * Custom resolver invoked when an external host needs to be resolved.
     * It can return synchronously or asynchronously.
     */
    resolveExternal?: (key: string) => string | undefined | Promise<string | undefined>;
    /** Override for os.networkInterfaces (handy for tests). */
    networkInterfaces?: () => Record<string, NetworkInterfaceInfo[] | undefined>;
    /** Callback invoked before throwing when a required host cannot be resolved. */
    onMissingHost?: (placeholder: HostPlaceholder) => void;
}
export declare function resolveConfigSecrets(config: AppConfig, options?: SecretResolverOptions): Promise<ResolvedAppConfig>;
export declare function clearSecretResolverCaches(): void;
export declare function resolveInfisicalConfig(options?: InfisicalResolverOptions): Promise<{
    token: string | undefined;
    projectId: string | undefined;
    siteUrl: string | undefined;
}>;
export {};
//# sourceMappingURL=secret-resolver.d.ts.map