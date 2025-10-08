import logger from "../logger.js";
import { HandoverManagerEventEmitter } from "./handover-manager-event-emitter.js";
import { MqttTopicBuilder } from "../uns-mqtt/mqtt-topic-builder.js";
import { ACTIVE_TIMEOUT, PACKAGE_INFO } from "./process-config.js";
/**
 * HandoverManager is responsible for all handover-related logic,
 * including handling incoming MQTT messages, issuing handover requests,
 * and processing handover responses.
 */
export class HandoverManager {
    event = new HandoverManagerEventEmitter();
    processName;
    mqttProxy;
    unsMqttProxies;
    requestingHandover = false;
    handoverInProgress = false;
    topicBuilder;
    activeTimeout;
    active = false;
    handoverRequestEnabled = false;
    handoverEnabled = true;
    forceStartEnabled = false;
    constructor(processName, mqttProxy, unsMqttProxies, handoverRequestEnabled, handoverEnabled, forceStartEnabled) {
        this.processName = processName;
        this.mqttProxy = mqttProxy;
        this.unsMqttProxies = unsMqttProxies;
        this.handoverRequestEnabled = handoverRequestEnabled;
        this.handoverEnabled = handoverEnabled;
        this.forceStartEnabled = forceStartEnabled;
        // Instantiate the topic builder.
        const packageName = PACKAGE_INFO.name;
        const version = PACKAGE_INFO.version;
        this.topicBuilder = new MqttTopicBuilder(`uns-infra/${MqttTopicBuilder.sanitizeTopicPart(packageName)}/${MqttTopicBuilder.sanitizeTopicPart(version)}/${MqttTopicBuilder.sanitizeTopicPart(this.processName)}/`);
        // Set status as active after a timeout if no other active process are detected.
        this.activeTimeout = setTimeout(() => {
            logger.info(`${this.processName} - No active message received within timeout. Assuming no other process is running.`);
            this.active = true;
            this.event.emit("handoverManager", { active: this.active });
            // Activate all UNS proxy instance publishers and subscribers.
            this.unsMqttProxies.forEach((unsProxy) => {
                unsProxy.setPublisherActive();
                unsProxy.setSubscriberActive();
            });
        }, ACTIVE_TIMEOUT);
    }
    /**
     * Main entry point for handling incoming MQTT messages.
     * It checks the topic and delegates to the corresponding handler.
     */
    async handleMqttMessage(event) {
        try {
            // Check if the packet is active messages from other processes and this process is not active.
            if (this.requestingHandover === false &&
                this.topicBuilder.getActiveTopic() !== event.topic &&
                this.active === false &&
                this.handoverInProgress === false) {
                logger.info(`${this.processName} - Another process is active on ${event.topic}.`);
                if (this.handoverRequestEnabled) {
                    // Requester process
                    // Publish a handover request message after 10 seconds to the handover topic.
                    clearTimeout(this.activeTimeout); // Clear the active timeout if it exists - prevent this process from becoming active after a timeout.
                    this.activeTimeout = undefined;
                    this.event.emit("handoverManager", { active: this.active });
                    this.requestingHandover = true;
                    logger.info(`${this.processName} - Requesting handover in 10 seconds.`);
                    setTimeout(async () => {
                        const eventHandoverTopic = new MqttTopicBuilder(MqttTopicBuilder.extractBaseTopic(event.topic)).getHandoverTopic();
                        logger.info(`${this.processName} - Requesting handover ${eventHandoverTopic}.`);
                        this.handoverInProgress = true;
                        await this.mqttProxy.publish(eventHandoverTopic, JSON.stringify({ type: "handover_request" }), {
                            retain: false,
                            properties: {
                                responseTopic: this.topicBuilder.getHandoverTopic(),
                                userProperties: {
                                    processName: this.processName,
                                },
                            },
                        });
                    }, 10000);
                }
                else {
                    if (this.forceStartEnabled) {
                        // Force start the process even if another process is active.
                        logger.info(`${this.processName} - Force starting the process.`);
                        logger.warn(`${this.processName} - Warning: Source and destination being the same may lead to duplicate messages.`);
                        clearTimeout(this.activeTimeout); // Clear the active timeout if it exists - prevent this process from becoming active after a timeout.
                        this.activeTimeout = undefined;
                        this.active = true;
                        this.event.emit("handoverManager", { active: this.active });
                        // Activate all UNS proxy instance publishers and subscribers.
                        this.unsMqttProxies.forEach((unsProxy) => {
                            unsProxy.setPublisherActive();
                            unsProxy.setSubscriberActive();
                        });
                    }
                    else {
                        logger.info(`${this.processName} - Waiting for the other process on topic ${event.topic} to become passive.`);
                        this.activeTimeout.refresh();
                    }
                }
            }
            // Check if the packet is an handover message, sent to a handover topic.
            if (event.topic === this.topicBuilder.getHandoverTopic() && this.handoverEnabled) {
                if (event.packet?.properties?.userProperties?.processName && event.packet.properties.userProperties.processName !== this.processName) {
                    await this.handleHandover(event);
                }
            }
        }
        catch (error) {
            logger.error(`${this.processName} - Error processing MQTT message: ${error.message}`);
            return;
        }
    }
    /**
     * Handles handovers.
     */
    async handleHandover(event) {
        try {
            const response = JSON.parse(event.message.toString());
            // Responder process
            // Check if the message is a handover request and publish MULTIPLE handover_subscriber messages
            if (response.type === "handover_request") {
                logger.info(`${this.processName} - Received handover request from ${event.packet?.properties?.userProperties?.processName}. Accepting handover.`);
                // Set all UNS proxy instance subscribers to passive and drain the queue.
                const mqttWorkerData = [];
                for (let i = 0; i < this.unsMqttProxies.length; i++) {
                    const unsProxy = this.unsMqttProxies[i];
                    const workerData = await unsProxy.setSubscriberPassiveAndDrainQueue();
                    mqttWorkerData.push(workerData);
                }
                logger.info(`${this.processName} - Handover request accepted. Sending handover_subscriber messages.`);
                // Publish handover_subscriber messages for each instance that has processed some data.
                for (let i = 0; i < mqttWorkerData.length; i++) {
                    const workerData = mqttWorkerData[i];
                    if (workerData.batchSize > 0) {
                        await this.mqttProxy.publish(event.packet.properties?.responseTopic ?? "", JSON.stringify({
                            type: "handover_subscriber",
                            batchSize: workerData.batchSize,
                            referenceHash: workerData.referenceHash,
                            instanceName: workerData.instanceName,
                        }), {
                            retain: false,
                            properties: {
                                responseTopic: this.topicBuilder.getHandoverTopic(),
                                userProperties: {
                                    processName: this.processName,
                                },
                            },
                        });
                    }
                }
                logger.info(`${this.processName} - Handover subscriber messages sent.`);
                // Publish a single handover acknowledgment only when all
                // handover_subscriber messages have been sent
                this.active = false;
                this.event.emit("handoverManager", { active: this.active });
                await this.mqttProxy.publish(event.packet.properties?.responseTopic ?? "", JSON.stringify({
                    type: "handover_fin",
                }), {
                    retain: false,
                    properties: {
                        responseTopic: this.topicBuilder.getHandoverTopic(),
                        userProperties: {
                            processName: this.processName,
                        },
                    },
                });
                logger.info(`${this.processName} - Handover fin message sent.`);
                this.handoverInProgress = false;
                this.requestingHandover = false;
                this.unsMqttProxies.forEach((unsProxy) => {
                    unsProxy.stop();
                });
            }
            // Requestor process
            // Check if the message is one of the handover_subscriber message in response to handover_request
            // and publish a handover_ack message
            if (response.type === "handover_subscriber") {
                // Find correct unsProxy instance for handover_subscriber and set it active
                this.unsMqttProxies.forEach((unsProxy) => {
                    if (unsProxy.instanceName === response.instanceName) {
                        unsProxy.setSubscriberActive(response.batchSize, response.referenceHash);
                    }
                });
            }
            // Requestor process
            // Check if the message is a handover_fin at the end of handover_subscriber messages
            if (response.type === "handover_fin") {
                logger.info(`${this.processName} - Received handover fin from ${event.packet?.properties?.userProperties?.processName}.`);
                // Maybe we should count the number of requests that were allrady made TODO
                // this.handoverInProgress = false;
                // this.requestingHandover = false;
                this.active = true;
                this.event.emit("handoverManager", { active: this.active });
                logger.info(`${this.processName} - Handover completed.`);
                // Activate all UNS proxy instance publishers and subscribers.
                this.unsMqttProxies.forEach((unsProxy) => {
                    unsProxy.setPublisherActive();
                    unsProxy.setSubscriberActive();
                });
                // Maybe we should reply with handover_ack.
                await this.mqttProxy.publish(event.packet.properties?.responseTopic ?? "", JSON.stringify({
                    type: "handover_ack",
                }), {
                    retain: false,
                    properties: {
                        responseTopic: this.topicBuilder.getHandoverTopic(),
                        userProperties: {
                            processName: this.processName,
                        },
                    },
                });
                logger.info(`${this.processName} - Handover ack message sent.`);
            }
            // Responder process
            // Check if the message is a handover_ack at the end of handover_fin messages
            if (response.type === "handover_ack") {
                logger.info(`${this.processName} - Received handover ack from ${event.packet?.properties?.userProperties?.processName}.`);
                this.handoverInProgress = false;
                this.requestingHandover = false;
                logger.info(`${this.processName} - Handover completed. Exiting process.`);
                process.exit(0);
            }
        }
        catch (error) {
            logger.error(`${this.processName} - Error processing handover response: ${error.message}`);
        }
    }
}
//# sourceMappingURL=handover-manager.js.map