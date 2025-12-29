export interface ProjectAppConfig {
    uns: {
        graphql: string;
        rest: string;
        /** Email used when authenticating to graphql endpoint of the UNS instance. */
        email: string;
        /** Password or secret value paired with the UNS email. */
        password: string;
        instanceMode?: "wait" | "force" | "handover";
        processName?: string | undefined;
        handover?: boolean;
        jwksWellKnownUrl?: string | undefined;
        kidWellKnownUrl?: string | undefined;
        env?: "dev" | "staging" | "test" | "prod";
    };
    input?: {
        host?: string | undefined;
        hosts?: string[] | undefined;
        servers?: {
            host: string;
            port?: number | undefined;
            protocol?: ("mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl") | undefined;
        }[] | undefined;
        port?: number | undefined;
        protocol?: ("mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl") | undefined;
        username?: string | undefined;
        password?: string | undefined;
        clientId?: string | undefined;
        clean?: boolean | undefined;
        keepalive?: number | undefined;
        connectTimeout?: number | undefined;
        reconnectPeriod?: number | undefined;
        reconnectOnConnackError?: boolean | undefined;
        resubscribe?: boolean | undefined;
        queueQoSZero?: boolean | undefined;
        rejectUnauthorized?: boolean | undefined;
        properties?: {
            sessionExpiryInterval?: number | undefined;
            receiveMaximum?: number | undefined;
            maximumPacketSize?: number | undefined;
            topicAliasMaximum?: number | undefined;
            requestResponseInformation?: boolean | undefined;
            requestProblemInformation?: boolean | undefined;
            userProperties?: {
                [x: string]: string;
            } | undefined;
        } | undefined;
        ca?: string | undefined;
        cert?: string | undefined;
        key?: string | undefined;
        servername?: string | undefined;
    } | undefined;
    output?: {
        host?: string | undefined;
        hosts?: string[] | undefined;
        servers?: {
            host: string;
            port?: number | undefined;
            protocol?: ("mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl") | undefined;
        }[] | undefined;
        port?: number | undefined;
        protocol?: ("mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl") | undefined;
        username?: string | undefined;
        password?: string | undefined;
        clientId?: string | undefined;
        clean?: boolean | undefined;
        keepalive?: number | undefined;
        connectTimeout?: number | undefined;
        reconnectPeriod?: number | undefined;
        reconnectOnConnackError?: boolean | undefined;
        resubscribe?: boolean | undefined;
        queueQoSZero?: boolean | undefined;
        rejectUnauthorized?: boolean | undefined;
        properties?: {
            sessionExpiryInterval?: number | undefined;
            receiveMaximum?: number | undefined;
            maximumPacketSize?: number | undefined;
            topicAliasMaximum?: number | undefined;
            requestResponseInformation?: boolean | undefined;
            requestProblemInformation?: boolean | undefined;
            userProperties?: {
                [x: string]: string;
            } | undefined;
        } | undefined;
        ca?: string | undefined;
        cert?: string | undefined;
        key?: string | undefined;
        servername?: string | undefined;
    } | undefined;
    infra: {
        host?: string | undefined;
        hosts?: string[] | undefined;
        servers?: {
            host: string;
            port?: number | undefined;
            protocol?: ("mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl") | undefined;
        }[] | undefined;
        port?: number | undefined;
        protocol?: ("mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl") | undefined;
        username?: string | undefined;
        password?: string | undefined;
        clientId?: string | undefined;
        clean?: boolean | undefined;
        keepalive?: number | undefined;
        connectTimeout?: number | undefined;
        reconnectPeriod?: number | undefined;
        reconnectOnConnackError?: boolean | undefined;
        resubscribe?: boolean | undefined;
        queueQoSZero?: boolean | undefined;
        rejectUnauthorized?: boolean | undefined;
        properties?: {
            sessionExpiryInterval?: number | undefined;
            receiveMaximum?: number | undefined;
            maximumPacketSize?: number | undefined;
            topicAliasMaximum?: number | undefined;
            requestResponseInformation?: boolean | undefined;
            requestProblemInformation?: boolean | undefined;
            userProperties?: {
                [x: string]: string;
            } | undefined;
        } | undefined;
        ca?: string | undefined;
        cert?: string | undefined;
        key?: string | undefined;
        servername?: string | undefined;
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