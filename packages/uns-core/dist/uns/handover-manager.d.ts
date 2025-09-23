import { UnsEvents } from "./uns-interfaces.js";
import { HandoverManagerEventEmitter } from "./handover-manager-event-emitter.js";
import { HandoverManagerEvents } from "../uns-mqtt/mqtt-interfaces.js";
import MqttProxy from "../uns-mqtt/mqtt-proxy.js";
import UnsMqttProxy from "../uns-mqtt/uns-mqtt-proxy.js";
/**
 * HandoverManager is responsible for all handover-related logic,
 * including handling incoming MQTT messages, issuing handover requests,
 * and processing handover responses.
 */
export declare class HandoverManager {
    event: HandoverManagerEventEmitter<HandoverManagerEvents>;
    private processName;
    private mqttProxy;
    private unsMqttProxies;
    private requestingHandover;
    private handoverInProgress;
    private topicBuilder;
    private activeTimeout;
    private active;
    handoverRequestEnabled: boolean;
    handoverEnabled: boolean;
    forceStartEnabled: boolean;
    constructor(processName: string, mqttProxy: MqttProxy, unsMqttProxies: UnsMqttProxy[], handoverRequestEnabled: boolean, handoverEnabled: boolean, forceStartEnabled: boolean);
    /**
     * Main entry point for handling incoming MQTT messages.
     * It checks the topic and delegates to the corresponding handler.
     */
    handleMqttMessage(event: UnsEvents["input"]): Promise<void>;
    /**
     * Handles handovers.
     */
    private handleHandover;
}
