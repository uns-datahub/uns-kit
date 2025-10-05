export interface ProjectAppConfig {
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
declare module "@uns-kit/core/config/app-config.js" {
    interface AppConfig extends ProjectAppConfig {
    }
}
//# sourceMappingURL=app-config.d.ts.map