export interface IMqttParameters {
    mqttSubToTopics?: string | string[];
    username?: string;
    password?: string;
    mqttSSL?: boolean;
    clientId?: string;
    statusTopic?: string;
    rejectUnauthorized?: boolean;
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
    mqttParameters?: any;
    publisherActive: boolean;
    subscriberActive: boolean;
}
//# sourceMappingURL=mqtt-interfaces.d.ts.map