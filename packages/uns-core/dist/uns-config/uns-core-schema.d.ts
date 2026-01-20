import { z } from "zod";
export declare const mqttChannelSchema: z.ZodEffects<z.ZodObject<{
    host: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
        provider: z.ZodLiteral<"inline">;
        value: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        provider?: "inline";
        value?: string;
    }, {
        provider?: "inline";
        value?: string;
    }>, z.ZodObject<{
        provider: z.ZodLiteral<"external">;
        key: z.ZodString;
        optional: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    }, {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    }>, z.ZodObject<{
        provider: z.ZodLiteral<"system">;
        family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
        interfaceName: z.ZodOptional<z.ZodString>;
        optional: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    }, {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    }>]>]>>;
    hosts: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
        provider: z.ZodLiteral<"inline">;
        value: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        provider?: "inline";
        value?: string;
    }, {
        provider?: "inline";
        value?: string;
    }>, z.ZodObject<{
        provider: z.ZodLiteral<"external">;
        key: z.ZodString;
        optional: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    }, {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    }>, z.ZodObject<{
        provider: z.ZodLiteral<"system">;
        family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
        interfaceName: z.ZodOptional<z.ZodString>;
        optional: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    }, {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    }>]>]>, "many">>;
    servers: z.ZodOptional<z.ZodArray<z.ZodObject<{
        host: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>;
        port: z.ZodOptional<z.ZodNumber>;
        protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
    }, "strict", z.ZodTypeAny, {
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        port?: number;
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
    }, {
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        port?: number;
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
    }>, "many">>;
    port: z.ZodOptional<z.ZodNumber>;
    protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
    username: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
        provider: z.ZodLiteral<"env">;
        key: z.ZodString;
        optional: z.ZodOptional<z.ZodBoolean>;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "env";
        key?: string;
        optional?: boolean;
        default?: string;
    }, {
        provider?: "env";
        key?: string;
        optional?: boolean;
        default?: string;
    }>, z.ZodObject<{
        provider: z.ZodLiteral<"infisical">;
        path: z.ZodString;
        key: z.ZodString;
        optional: z.ZodOptional<z.ZodBoolean>;
        environment: z.ZodOptional<z.ZodString>;
        projectId: z.ZodOptional<z.ZodString>;
        default: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "infisical";
        key?: string;
        optional?: boolean;
        default?: string;
        path?: string;
        environment?: string;
        projectId?: string;
    }, {
        provider?: "infisical";
        key?: string;
        optional?: boolean;
        default?: string;
        path?: string;
        environment?: string;
        projectId?: string;
    }>]>]>>;
    clientId: z.ZodOptional<z.ZodString>;
    clean: z.ZodOptional<z.ZodBoolean>;
    keepalive: z.ZodOptional<z.ZodNumber>;
    connectTimeout: z.ZodOptional<z.ZodNumber>;
    reconnectPeriod: z.ZodOptional<z.ZodNumber>;
    reconnectOnConnackError: z.ZodOptional<z.ZodBoolean>;
    resubscribe: z.ZodOptional<z.ZodBoolean>;
    queueQoSZero: z.ZodOptional<z.ZodBoolean>;
    rejectUnauthorized: z.ZodOptional<z.ZodBoolean>;
    properties: z.ZodOptional<z.ZodObject<{
        sessionExpiryInterval: z.ZodOptional<z.ZodNumber>;
        receiveMaximum: z.ZodOptional<z.ZodNumber>;
        maximumPacketSize: z.ZodOptional<z.ZodNumber>;
        topicAliasMaximum: z.ZodOptional<z.ZodNumber>;
        requestResponseInformation: z.ZodOptional<z.ZodBoolean>;
        requestProblemInformation: z.ZodOptional<z.ZodBoolean>;
        userProperties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        sessionExpiryInterval?: number;
        receiveMaximum?: number;
        maximumPacketSize?: number;
        topicAliasMaximum?: number;
        requestResponseInformation?: boolean;
        requestProblemInformation?: boolean;
        userProperties?: Record<string, string>;
    }, {
        sessionExpiryInterval?: number;
        receiveMaximum?: number;
        maximumPacketSize?: number;
        topicAliasMaximum?: number;
        requestResponseInformation?: boolean;
        requestProblemInformation?: boolean;
        userProperties?: Record<string, string>;
    }>>;
    ca: z.ZodOptional<z.ZodString>;
    cert: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodString>;
    servername: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    key?: string;
    hosts?: (string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    })[];
    protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
    servers?: {
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        port?: number;
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
    }[];
    port?: number;
    properties?: {
        sessionExpiryInterval?: number;
        receiveMaximum?: number;
        maximumPacketSize?: number;
        topicAliasMaximum?: number;
        requestResponseInformation?: boolean;
        requestProblemInformation?: boolean;
        userProperties?: Record<string, string>;
    };
    host?: string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    };
    username?: string;
    password?: string | {
        provider?: "env";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "infisical";
        key?: string;
        optional?: boolean;
        default?: string;
        path?: string;
        environment?: string;
        projectId?: string;
    };
    clientId?: string;
    clean?: boolean;
    keepalive?: number;
    connectTimeout?: number;
    reconnectPeriod?: number;
    reconnectOnConnackError?: boolean;
    resubscribe?: boolean;
    queueQoSZero?: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    servername?: string;
}, {
    key?: string;
    hosts?: (string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    })[];
    protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
    servers?: {
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        port?: number;
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
    }[];
    port?: number;
    properties?: {
        sessionExpiryInterval?: number;
        receiveMaximum?: number;
        maximumPacketSize?: number;
        topicAliasMaximum?: number;
        requestResponseInformation?: boolean;
        requestProblemInformation?: boolean;
        userProperties?: Record<string, string>;
    };
    host?: string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    };
    username?: string;
    password?: string | {
        provider?: "env";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "infisical";
        key?: string;
        optional?: boolean;
        default?: string;
        path?: string;
        environment?: string;
        projectId?: string;
    };
    clientId?: string;
    clean?: boolean;
    keepalive?: number;
    connectTimeout?: number;
    reconnectPeriod?: number;
    reconnectOnConnackError?: boolean;
    resubscribe?: boolean;
    queueQoSZero?: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    servername?: string;
}>, {
    key?: string;
    hosts?: (string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    })[];
    protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
    servers?: {
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        port?: number;
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
    }[];
    port?: number;
    properties?: {
        sessionExpiryInterval?: number;
        receiveMaximum?: number;
        maximumPacketSize?: number;
        topicAliasMaximum?: number;
        requestResponseInformation?: boolean;
        requestProblemInformation?: boolean;
        userProperties?: Record<string, string>;
    };
    host?: string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    };
    username?: string;
    password?: string | {
        provider?: "env";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "infisical";
        key?: string;
        optional?: boolean;
        default?: string;
        path?: string;
        environment?: string;
        projectId?: string;
    };
    clientId?: string;
    clean?: boolean;
    keepalive?: number;
    connectTimeout?: number;
    reconnectPeriod?: number;
    reconnectOnConnackError?: boolean;
    resubscribe?: boolean;
    queueQoSZero?: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    servername?: string;
}, {
    key?: string;
    hosts?: (string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    })[];
    protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
    servers?: {
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        port?: number;
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
    }[];
    port?: number;
    properties?: {
        sessionExpiryInterval?: number;
        receiveMaximum?: number;
        maximumPacketSize?: number;
        topicAliasMaximum?: number;
        requestResponseInformation?: boolean;
        requestProblemInformation?: boolean;
        userProperties?: Record<string, string>;
    };
    host?: string | {
        provider?: "inline";
        value?: string;
    } | {
        provider?: "external";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "system";
        optional?: boolean;
        default?: string;
        family?: "IPv4" | "IPv6";
        interfaceName?: string;
    };
    username?: string;
    password?: string | {
        provider?: "env";
        key?: string;
        optional?: boolean;
        default?: string;
    } | {
        provider?: "infisical";
        key?: string;
        optional?: boolean;
        default?: string;
        path?: string;
        environment?: string;
        projectId?: string;
    };
    clientId?: string;
    clean?: boolean;
    keepalive?: number;
    connectTimeout?: number;
    reconnectPeriod?: number;
    reconnectOnConnackError?: boolean;
    resubscribe?: boolean;
    queueQoSZero?: boolean;
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    servername?: string;
}>;
export declare const unsCoreSchema: z.ZodObject<{
    uns: z.ZodObject<{
        graphql: z.ZodString;
        rest: z.ZodString;
        email: z.ZodString;
        password: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"env">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"infisical">;
            path: z.ZodString;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            environment: z.ZodOptional<z.ZodString>;
            projectId: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }>]>]>;
        instanceMode: z.ZodDefault<z.ZodEnum<["wait", "force", "handover"]>>;
        processName: z.ZodString;
        handover: z.ZodDefault<z.ZodBoolean>;
        jwksWellKnownUrl: z.ZodOptional<z.ZodString>;
        kidWellKnownUrl: z.ZodOptional<z.ZodString>;
        env: z.ZodDefault<z.ZodEnum<["dev", "staging", "test", "prod"]>>;
    }, "strict", z.ZodTypeAny, {
        handover?: boolean;
        env?: "dev" | "staging" | "test" | "prod";
        processName?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        graphql?: string;
        rest?: string;
        email?: string;
        instanceMode?: "wait" | "force" | "handover";
        jwksWellKnownUrl?: string;
        kidWellKnownUrl?: string;
    }, {
        handover?: boolean;
        env?: "dev" | "staging" | "test" | "prod";
        processName?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        graphql?: string;
        rest?: string;
        email?: string;
        instanceMode?: "wait" | "force" | "handover";
        jwksWellKnownUrl?: string;
        kidWellKnownUrl?: string;
    }>;
    input: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        host: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>>;
        hosts: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>, "many">>;
        servers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            host: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
                provider: z.ZodLiteral<"inline">;
                value: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                provider?: "inline";
                value?: string;
            }, {
                provider?: "inline";
                value?: string;
            }>, z.ZodObject<{
                provider: z.ZodLiteral<"external">;
                key: z.ZodString;
                optional: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            }, {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            }>, z.ZodObject<{
                provider: z.ZodLiteral<"system">;
                family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
                interfaceName: z.ZodOptional<z.ZodString>;
                optional: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            }, {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            }>]>]>;
            port: z.ZodOptional<z.ZodNumber>;
            protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
        }, "strict", z.ZodTypeAny, {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }, {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }>, "many">>;
        port: z.ZodOptional<z.ZodNumber>;
        protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"env">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"infisical">;
            path: z.ZodString;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            environment: z.ZodOptional<z.ZodString>;
            projectId: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }>]>]>>;
        clientId: z.ZodOptional<z.ZodString>;
        clean: z.ZodOptional<z.ZodBoolean>;
        keepalive: z.ZodOptional<z.ZodNumber>;
        connectTimeout: z.ZodOptional<z.ZodNumber>;
        reconnectPeriod: z.ZodOptional<z.ZodNumber>;
        reconnectOnConnackError: z.ZodOptional<z.ZodBoolean>;
        resubscribe: z.ZodOptional<z.ZodBoolean>;
        queueQoSZero: z.ZodOptional<z.ZodBoolean>;
        rejectUnauthorized: z.ZodOptional<z.ZodBoolean>;
        properties: z.ZodOptional<z.ZodObject<{
            sessionExpiryInterval: z.ZodOptional<z.ZodNumber>;
            receiveMaximum: z.ZodOptional<z.ZodNumber>;
            maximumPacketSize: z.ZodOptional<z.ZodNumber>;
            topicAliasMaximum: z.ZodOptional<z.ZodNumber>;
            requestResponseInformation: z.ZodOptional<z.ZodBoolean>;
            requestProblemInformation: z.ZodOptional<z.ZodBoolean>;
            userProperties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        }, {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        }>>;
        ca: z.ZodOptional<z.ZodString>;
        cert: z.ZodOptional<z.ZodString>;
        key: z.ZodOptional<z.ZodString>;
        servername: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }>, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }>>;
    output: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        host: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>>;
        hosts: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>, "many">>;
        servers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            host: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
                provider: z.ZodLiteral<"inline">;
                value: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                provider?: "inline";
                value?: string;
            }, {
                provider?: "inline";
                value?: string;
            }>, z.ZodObject<{
                provider: z.ZodLiteral<"external">;
                key: z.ZodString;
                optional: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            }, {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            }>, z.ZodObject<{
                provider: z.ZodLiteral<"system">;
                family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
                interfaceName: z.ZodOptional<z.ZodString>;
                optional: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            }, {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            }>]>]>;
            port: z.ZodOptional<z.ZodNumber>;
            protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
        }, "strict", z.ZodTypeAny, {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }, {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }>, "many">>;
        port: z.ZodOptional<z.ZodNumber>;
        protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"env">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"infisical">;
            path: z.ZodString;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            environment: z.ZodOptional<z.ZodString>;
            projectId: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }>]>]>>;
        clientId: z.ZodOptional<z.ZodString>;
        clean: z.ZodOptional<z.ZodBoolean>;
        keepalive: z.ZodOptional<z.ZodNumber>;
        connectTimeout: z.ZodOptional<z.ZodNumber>;
        reconnectPeriod: z.ZodOptional<z.ZodNumber>;
        reconnectOnConnackError: z.ZodOptional<z.ZodBoolean>;
        resubscribe: z.ZodOptional<z.ZodBoolean>;
        queueQoSZero: z.ZodOptional<z.ZodBoolean>;
        rejectUnauthorized: z.ZodOptional<z.ZodBoolean>;
        properties: z.ZodOptional<z.ZodObject<{
            sessionExpiryInterval: z.ZodOptional<z.ZodNumber>;
            receiveMaximum: z.ZodOptional<z.ZodNumber>;
            maximumPacketSize: z.ZodOptional<z.ZodNumber>;
            topicAliasMaximum: z.ZodOptional<z.ZodNumber>;
            requestResponseInformation: z.ZodOptional<z.ZodBoolean>;
            requestProblemInformation: z.ZodOptional<z.ZodBoolean>;
            userProperties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        }, {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        }>>;
        ca: z.ZodOptional<z.ZodString>;
        cert: z.ZodOptional<z.ZodString>;
        key: z.ZodOptional<z.ZodString>;
        servername: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }>, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }>>;
    infra: z.ZodEffects<z.ZodObject<{
        host: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>>;
        hosts: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"inline">;
            value: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            provider?: "inline";
            value?: string;
        }, {
            provider?: "inline";
            value?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"external">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"system">;
            family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
            interfaceName: z.ZodOptional<z.ZodString>;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }, {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        }>]>]>, "many">>;
        servers: z.ZodOptional<z.ZodArray<z.ZodObject<{
            host: z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
                provider: z.ZodLiteral<"inline">;
                value: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                provider?: "inline";
                value?: string;
            }, {
                provider?: "inline";
                value?: string;
            }>, z.ZodObject<{
                provider: z.ZodLiteral<"external">;
                key: z.ZodString;
                optional: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            }, {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            }>, z.ZodObject<{
                provider: z.ZodLiteral<"system">;
                family: z.ZodDefault<z.ZodUnion<[z.ZodLiteral<"IPv4">, z.ZodLiteral<"IPv6">]>>;
                interfaceName: z.ZodOptional<z.ZodString>;
                optional: z.ZodOptional<z.ZodBoolean>;
                default: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            }, {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            }>]>]>;
            port: z.ZodOptional<z.ZodNumber>;
            protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
        }, "strict", z.ZodTypeAny, {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }, {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }>, "many">>;
        port: z.ZodOptional<z.ZodNumber>;
        protocol: z.ZodOptional<z.ZodEnum<["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"]>>;
        username: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodDiscriminatedUnion<"provider", [z.ZodObject<{
            provider: z.ZodLiteral<"env">;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }, {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        }>, z.ZodObject<{
            provider: z.ZodLiteral<"infisical">;
            path: z.ZodString;
            key: z.ZodString;
            optional: z.ZodOptional<z.ZodBoolean>;
            environment: z.ZodOptional<z.ZodString>;
            projectId: z.ZodOptional<z.ZodString>;
            default: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }, {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        }>]>]>>;
        clientId: z.ZodOptional<z.ZodString>;
        clean: z.ZodOptional<z.ZodBoolean>;
        keepalive: z.ZodOptional<z.ZodNumber>;
        connectTimeout: z.ZodOptional<z.ZodNumber>;
        reconnectPeriod: z.ZodOptional<z.ZodNumber>;
        reconnectOnConnackError: z.ZodOptional<z.ZodBoolean>;
        resubscribe: z.ZodOptional<z.ZodBoolean>;
        queueQoSZero: z.ZodOptional<z.ZodBoolean>;
        rejectUnauthorized: z.ZodOptional<z.ZodBoolean>;
        properties: z.ZodOptional<z.ZodObject<{
            sessionExpiryInterval: z.ZodOptional<z.ZodNumber>;
            receiveMaximum: z.ZodOptional<z.ZodNumber>;
            maximumPacketSize: z.ZodOptional<z.ZodNumber>;
            topicAliasMaximum: z.ZodOptional<z.ZodNumber>;
            requestResponseInformation: z.ZodOptional<z.ZodBoolean>;
            requestProblemInformation: z.ZodOptional<z.ZodBoolean>;
            userProperties: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        }, {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        }>>;
        ca: z.ZodOptional<z.ZodString>;
        cert: z.ZodOptional<z.ZodString>;
        key: z.ZodOptional<z.ZodString>;
        servername: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }>, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }, {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    }>;
    devops: z.ZodOptional<z.ZodObject<{
        provider: z.ZodDefault<z.ZodEnum<["azure-devops"]>>;
        organization: z.ZodString;
        project: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        provider?: "azure-devops";
        organization?: string;
        project?: string;
    }, {
        provider?: "azure-devops";
        organization?: string;
        project?: string;
    }>>;
}, "strict", z.ZodTypeAny, {
    uns?: {
        handover?: boolean;
        env?: "dev" | "staging" | "test" | "prod";
        processName?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        graphql?: string;
        rest?: string;
        email?: string;
        instanceMode?: "wait" | "force" | "handover";
        jwksWellKnownUrl?: string;
        kidWellKnownUrl?: string;
    };
    input?: {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    };
    output?: {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    };
    infra?: {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    };
    devops?: {
        provider?: "azure-devops";
        organization?: string;
        project?: string;
    };
}, {
    uns?: {
        handover?: boolean;
        env?: "dev" | "staging" | "test" | "prod";
        processName?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        graphql?: string;
        rest?: string;
        email?: string;
        instanceMode?: "wait" | "force" | "handover";
        jwksWellKnownUrl?: string;
        kidWellKnownUrl?: string;
    };
    input?: {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    };
    output?: {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    };
    infra?: {
        key?: string;
        hosts?: (string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        })[];
        protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
        servers?: {
            protocol?: "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
            port?: number;
            host?: string | {
                provider?: "inline";
                value?: string;
            } | {
                provider?: "external";
                key?: string;
                optional?: boolean;
                default?: string;
            } | {
                provider?: "system";
                optional?: boolean;
                default?: string;
                family?: "IPv4" | "IPv6";
                interfaceName?: string;
            };
        }[];
        port?: number;
        properties?: {
            sessionExpiryInterval?: number;
            receiveMaximum?: number;
            maximumPacketSize?: number;
            topicAliasMaximum?: number;
            requestResponseInformation?: boolean;
            requestProblemInformation?: boolean;
            userProperties?: Record<string, string>;
        };
        host?: string | {
            provider?: "inline";
            value?: string;
        } | {
            provider?: "external";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "system";
            optional?: boolean;
            default?: string;
            family?: "IPv4" | "IPv6";
            interfaceName?: string;
        };
        username?: string;
        password?: string | {
            provider?: "env";
            key?: string;
            optional?: boolean;
            default?: string;
        } | {
            provider?: "infisical";
            key?: string;
            optional?: boolean;
            default?: string;
            path?: string;
            environment?: string;
            projectId?: string;
        };
        clientId?: string;
        clean?: boolean;
        keepalive?: number;
        connectTimeout?: number;
        reconnectPeriod?: number;
        reconnectOnConnackError?: boolean;
        resubscribe?: boolean;
        queueQoSZero?: boolean;
        rejectUnauthorized?: boolean;
        ca?: string;
        cert?: string;
        servername?: string;
    };
    devops?: {
        provider?: "azure-devops";
        organization?: string;
        project?: string;
    };
}>;
export type UnsCore = z.infer<typeof unsCoreSchema>;
//# sourceMappingURL=uns-core-schema.d.ts.map