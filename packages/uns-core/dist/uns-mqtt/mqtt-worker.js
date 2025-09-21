import { join } from "path";
import { parentPort } from "worker_threads";
import { basePath } from "../base-path.js";
import logger from "../logger.js";
import MqttProxy from "./mqtt-proxy.js";
import { ThrottledPublisher, ThrottledSubscriber } from "./throttled-queue.js";
export class MqttWorker {
    mqttProxy;
    publisher;
    subscriber;
    constructor(workerData) {
        const publishThrottlingDelay = workerData.publishThrottlingDelay || 1;
        const subscribeThrottlingDelay = workerData.subscribeThrottlingDelay || 1;
        const persistToDisk = workerData.persistToDisk || false;
        const mqttHost = workerData.mqttHost;
        const instanceName = workerData.instanceNameWithSuffix;
        const mqttParameters = workerData.mqttParameters;
        const publisherActive = workerData.publisherActive;
        const subscriberActive = workerData.subscriberActive;
        // Initialize and start the MQTT proxy.
        this.mqttProxy = new MqttProxy(mqttHost, instanceName, mqttParameters, this);
        this.mqttProxy.start();
        // Set up the event listener for incoming messages from the MQTT proxy.
        this.mqttProxy.event.on("input", (event) => {
            this.subscriber.enqueue(event.topic, event.message.toString());
        });
        // Set up the event listener for status messages from the MQTT proxy.
        this.mqttProxy.event.on("mqttProxyStatus", (event) => {
            parentPort?.postMessage({
                command: "mqttProxyStatus",
                event: event.event,
                value: event.value,
                statusTopic: event.statusTopic,
                uom: event.uom,
            });
        });
        // Define the publish function to be used by the ThrottledPublisher.
        const publishFunction = async (topic, message, id, options) => {
            this.mqttProxy.publish(topic, message, options).then(() => {
                parentPort?.postMessage({
                    command: "enqueueResult",
                    id,
                    status: "success",
                    topic,
                    message,
                    options,
                });
            }, (reason) => {
                logger.error(`${instanceName} - Error publishing message to topic ${topic}: ${reason.message}`);
            });
        };
        // Create an instance of ThrottledPublisher.
        this.publisher = new ThrottledPublisher(publishThrottlingDelay, publishFunction, persistToDisk, join(basePath, "/workerQueue/", "throttled-publisher-queue.json"), instanceName, publisherActive);
        // Define the message handler for incoming messages.
        const messageHandler = async (topic, message) => {
            parentPort?.postMessage({
                command: "input",
                topic: topic,
                message: message,
            });
        };
        // Create an instance of ThrottledSubscriber.
        this.subscriber = new ThrottledSubscriber(subscribeThrottlingDelay, messageHandler, persistToDisk, join(basePath, "/workerQueue/", "throttled-subscriber-queue.json"), instanceName, subscriberActive);
        // Set up the message listener for commands from the main thread.
        this.initializeMessageListener();
    }
    /**
     * Listen for incoming messages from the main thread and process them.
     */
    initializeMessageListener() {
        parentPort?.on("message", async (msg) => {
            if (msg && msg.command === "enqueue" && msg.id && msg.topic && msg.message !== undefined) {
                try {
                    await this.publisher.enqueue(msg.topic, msg.message, msg.id, msg.options);
                }
                catch (error) {
                    // Error
                }
            }
            else if (msg && msg.command === "subscribeAsync" && msg.topics) {
                this.mqttProxy.subscribeAsync(msg.topics);
            }
            else if (msg && msg.command === "unsubscribeAsync" && msg.topics) {
                this.mqttProxy.unsubscribeAsync(msg.topics);
            }
            else if (msg && msg.command === "setPublisherActive") {
                this.publisher.becomeActive({ batchSize: msg?.batchSize, referenceHash: msg?.referenceHash });
            }
            else if (msg && msg.command === "setPublisherPassive") {
                const snapshot = await this.publisher.becomePassive(3);
                parentPort?.postMessage({
                    command: "handover_publisher",
                    ...snapshot
                });
            }
            else if (msg && msg.command === "setSubscriberActive") {
                this.subscriber.becomeActive({ batchSize: msg?.batchSize, referenceHash: msg?.referenceHash });
            }
            else if (msg && msg.command === "setSubscriberPassive") {
                const snapshot = await this.subscriber.becomePassive(3);
                parentPort?.postMessage({
                    command: "handover_subscriber",
                    ...snapshot
                });
            }
        });
    }
    /**
     * Get the state of the publisher.
     */
    getPublisherState() {
        return this.publisher.getState();
    }
    /**
     * Get the state of the subscriber.
     */
    getSubscriberState() {
        return this.subscriber.getState();
    }
}
