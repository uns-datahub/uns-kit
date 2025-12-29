export interface IMqttParameters {
    mqttSubToTopics?: string | string[];
    username?: string;
    password?: string;
    mqttSSL?: boolean;
    clientId?: string;
    hosts?: string[];
    servers?: IMqttServerConfig[];
    port?: number;
    protocol?: MqttProtocol;
    keepalive?: number;
    clean?: boolean;
    connectTimeout?: number;
    reconnectPeriod?: number;
    reconnectOnConnackError?: boolean;
    resubscribe?: boolean;
    queueQoSZero?: boolean;
    properties?: IMqttConnectProperties;
    ca?: string;
    cert?: string;
    key?: string;
    servername?: string;
    statusTopic?: string;
    rejectUnauthorized?: boolean;
}
export type MqttProtocol = "mqtt" | "mqtts" | "ws" | "wss" | "tcp" | "ssl";
export interface IMqttServerConfig {
    host: string;
    port?: number;
    protocol?: MqttProtocol;
}
export interface IMqttConnectProperties {
    sessionExpiryInterval?: number;
    receiveMaximum?: number;
    maximumPacketSize?: number;
    topicAliasMaximum?: number;
    requestResponseInformation?: boolean;
    requestProblemInformation?: boolean;
    userProperties?: Record<string, string>;
}
export interface HandoverManagerEvents {
    handoverManager: {
        active: boolean;
    };
}
export interface IMqttWorkerData {
    publishThrottlingDelay?: number;
    subscribeThrottlingDelay?: number;
    persistToDisk?: boolean;
    mqttHost: string;
    instanceNameWithSuffix: string;
    mqttParameters?: IMqttParameters;
    publisherActive: boolean;
    subscriberActive: boolean;
}
//# sourceMappingURL=mqtt-interfaces.d.ts.map