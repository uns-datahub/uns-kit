export interface ProjectAppConfig {
    uns: {
        graphql: string;
        rest: string;
        /** Email used when authenticating to graphql endpoint of the UNS instance. */
        email: string;
        /** Password or secret value paired with the UNS email. */
        password: string | ({
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
        });
        instanceMode?: "wait" | "force" | "handover";
        processName?: string | undefined;
        handover?: boolean;
        jwksWellKnownUrl?: string | undefined;
        kidWellKnownUrl?: string | undefined;
        env?: "dev" | "staging" | "test" | "prod";
    };
    input?: {
        host: string;
        username?: string | undefined;
        password?: string | undefined;
        clientId?: string | undefined;
    } | undefined;
    output?: {
        host: string;
        username?: string | undefined;
        password?: string | undefined;
        clientId?: string | undefined;
    } | undefined;
    infra: {
        host: string;
        username?: string | undefined;
        password?: string | undefined;
        clientId?: string | undefined;
    };
    devops?: {
        provider?: "azure-devops";
        organization: string;
        project?: string | undefined;
    } | undefined;
}
export interface AppConfig extends ProjectAppConfig {
}
//# sourceMappingURL=app-config.d.ts.map