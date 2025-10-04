/* Auto-generated. Do not edit by hand. */
export type AppConfig = {
    uns: {
        graphql: string;
        rest: string;
        instanceMode?: "wait" | "force" | "handover";
        processName?: string | undefined;
        handover?: boolean;
        jwksWellKnownUrl?: string | undefined;
        kidWellKnownUrl?: string | undefined;
        env?: "dev" | "staging" | "test" | "prod";
    };
    input?: {
        host: string | ({
            /** Use the supplied host or IP address. */
            provider: "inline";
            /** Host or IP address that should be used directly. */
            value: string;
        } | {
            /** Resolve the host from an external mapping. */
            provider: "external";
            /** Identifier used when resolving the host from HostResolverOptions. */
            key: string;
            /** Allow the external host to be missing without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback host when optional is true and the external entry is missing. */
            default?: string | undefined;
        } | {
            /** Resolve the host from local network interfaces. */
            provider: "system";
            /** Address family to return when scanning interfaces. */
            family?: "IPv4" | "IPv6";
            /** Specific interface to read (falls back to the first match when omitted). */
            interfaceName?: string | undefined;
            /** Allow the interface lookup to fail without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback host/IP when optional is true and no interface matches. */
            default?: string | undefined;
        });
        username?: string | undefined;
        password?: (string | ({
            /** Load the secret from an environment variable. */
            provider: "env";
            /** Name of the environment variable to read. */
            key: string;
            /** Allow the variable to be absent without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback value when optional is true and the variable is missing. */
            default?: string | undefined;
        } | {
            /** Load the secret from Infisical. */
            provider: "infisical";
            /** Secret folder path in Infisical, e.g. '/app/database'. */
            path: string;
            /** Secret key/name inside the given path. */
            key: string;
            /** Allow the secret to be absent without throwing during resolution. */
            optional?: boolean | undefined;
            /** Infisical environment override (defaults to current mode if omitted). */
            environment?: string | undefined;
            /** Optional Infisical project identifier when not using the default. */
            projectId?: string | undefined;
            /** Fallback value when the secret is missing and optional resolution is allowed. */
            default?: string | undefined;
        })) | undefined;
        clientId?: string | undefined;
    } | undefined;
    output?: {
        host: string | ({
            /** Use the supplied host or IP address. */
            provider: "inline";
            /** Host or IP address that should be used directly. */
            value: string;
        } | {
            /** Resolve the host from an external mapping. */
            provider: "external";
            /** Identifier used when resolving the host from HostResolverOptions. */
            key: string;
            /** Allow the external host to be missing without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback host when optional is true and the external entry is missing. */
            default?: string | undefined;
        } | {
            /** Resolve the host from local network interfaces. */
            provider: "system";
            /** Address family to return when scanning interfaces. */
            family?: "IPv4" | "IPv6";
            /** Specific interface to read (falls back to the first match when omitted). */
            interfaceName?: string | undefined;
            /** Allow the interface lookup to fail without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback host/IP when optional is true and no interface matches. */
            default?: string | undefined;
        });
        username?: string | undefined;
        password?: (string | ({
            /** Load the secret from an environment variable. */
            provider: "env";
            /** Name of the environment variable to read. */
            key: string;
            /** Allow the variable to be absent without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback value when optional is true and the variable is missing. */
            default?: string | undefined;
        } | {
            /** Load the secret from Infisical. */
            provider: "infisical";
            /** Secret folder path in Infisical, e.g. '/app/database'. */
            path: string;
            /** Secret key/name inside the given path. */
            key: string;
            /** Allow the secret to be absent without throwing during resolution. */
            optional?: boolean | undefined;
            /** Infisical environment override (defaults to current mode if omitted). */
            environment?: string | undefined;
            /** Optional Infisical project identifier when not using the default. */
            projectId?: string | undefined;
            /** Fallback value when the secret is missing and optional resolution is allowed. */
            default?: string | undefined;
        })) | undefined;
        clientId?: string | undefined;
    } | undefined;
    infra: {
        host: string | ({
            /** Use the supplied host or IP address. */
            provider: "inline";
            /** Host or IP address that should be used directly. */
            value: string;
        } | {
            /** Resolve the host from an external mapping. */
            provider: "external";
            /** Identifier used when resolving the host from HostResolverOptions. */
            key: string;
            /** Allow the external host to be missing without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback host when optional is true and the external entry is missing. */
            default?: string | undefined;
        } | {
            /** Resolve the host from local network interfaces. */
            provider: "system";
            /** Address family to return when scanning interfaces. */
            family?: "IPv4" | "IPv6";
            /** Specific interface to read (falls back to the first match when omitted). */
            interfaceName?: string | undefined;
            /** Allow the interface lookup to fail without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback host/IP when optional is true and no interface matches. */
            default?: string | undefined;
        });
        username?: string | undefined;
        password?: (string | ({
            /** Load the secret from an environment variable. */
            provider: "env";
            /** Name of the environment variable to read. */
            key: string;
            /** Allow the variable to be absent without throwing during resolution. */
            optional?: boolean | undefined;
            /** Fallback value when optional is true and the variable is missing. */
            default?: string | undefined;
        } | {
            /** Load the secret from Infisical. */
            provider: "infisical";
            /** Secret folder path in Infisical, e.g. '/app/database'. */
            path: string;
            /** Secret key/name inside the given path. */
            key: string;
            /** Allow the secret to be absent without throwing during resolution. */
            optional?: boolean | undefined;
            /** Infisical environment override (defaults to current mode if omitted). */
            environment?: string | undefined;
            /** Optional Infisical project identifier when not using the default. */
            projectId?: string | undefined;
            /** Fallback value when the secret is missing and optional resolution is allowed. */
            default?: string | undefined;
        })) | undefined;
        clientId?: string | undefined;
    };
    devops?: {
        provider?: string | undefined;
        organization: string;
        project?: string | undefined;
    } | undefined;
}
