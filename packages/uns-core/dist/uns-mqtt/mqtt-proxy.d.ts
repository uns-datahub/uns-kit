import mqtt from "mqtt";
import { UnsEvents } from "../uns/uns-interfaces.js";
import { UnsEventEmitter } from "../uns/uns-event-emitter.js";
import { IMqttParameters } from "./mqtt-interfaces.js";
import { MqttWorker } from "./mqtt-worker.js";
export type MqttStopOptions = {
    silent?: boolean;
    reason?: "retry" | "shutdown";
};
type MqttErrorInfo = {
    code: string | number;
    message: string;
};
export default class MqttProxy {
    event: UnsEventEmitter<UnsEvents>;
    statusTopic: string;
    instanceName: string;
    private mqttHost;
    private mqttSubToTopics;
    private mqttSSL;
    private mqttClient;
    private startDate;
    private mqttParameters;
    private statusUpdateInterval;
    private transformationStatsInterval;
    private publishedMessageCount;
    private publishedMessageBytes;
    private subscribedMessageCount;
    private subscribedMessageBytes;
    private mqttWorker;
    isConnected: boolean;
    private rejectUnauthorized;
    private pendingReconnectWait;
    private hasEstablishedConnection;
    private startupSettled;
    private startupResolve;
    private startupReject;
    constructor(mqttHost: string, instanceName: string, mqttParameters: IMqttParameters, mqttWorker?: MqttWorker);
    private resolveProtocol;
    private resolveDefaultPort;
    private ensureStatusUpdateInterval;
    private ensureTransformationStatsInterval;
    private subscribeToTopics;
    private buildServers;
    start(): Promise<void>;
    publish(topic: string, message: string | Buffer, options?: mqtt.IClientPublishOptions): Promise<void>;
    subscribeAsync(topic: string | string[], options?: mqtt.IClientSubscribeOptions): Promise<mqtt.ISubscriptionGrant[]>;
    unsubscribeAsync(topic: string | string[]): Promise<mqtt.Packet | undefined>;
    stop(options?: MqttStopOptions): void;
    private handleMqttConnect;
    private emitStatusUpdates;
    private updatePublishTransformationStats;
    private updateSubscribeTransformationStats;
    private waitForReconnect;
    private emitTransformationStatistics;
}
export declare function formatMqttError(error: unknown): MqttErrorInfo;
export {};
//# sourceMappingURL=mqtt-proxy.d.ts.map