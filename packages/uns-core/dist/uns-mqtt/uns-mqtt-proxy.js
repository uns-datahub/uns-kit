import { readFileSync } from "fs";
import * as path from "path";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import { basePath } from "../base-path.js";
import logger from "../logger.js";
import { getObjectTypeDescription } from "../uns/uns-object.js";
import { UnsPacket } from "../uns/uns-packet.js";
import { MqttTopicBuilder } from "./mqtt-topic-builder.js";
import UnsProxy from "../uns/uns-proxy.js";
import { UnsAttributeType } from "../graphql/schema.js";
import { getAttributeDescription } from "../uns/uns-attributes.js";
const packageJsonPath = path.join(basePath, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(moduleDirectory, "..", "..");
const workerScriptPath = path.join(packageRoot, "dist/uns-mqtt/mqtt-worker-init.js");
export var MessageMode;
(function (MessageMode) {
    MessageMode["Raw"] = "raw";
    MessageMode["Delta"] = "delta";
    MessageMode["Both"] = "both"; // Send both the original and delta messages
})(MessageMode || (MessageMode = {}));
export default class UnsMqttProxy extends UnsProxy {
    lastValues = new Map();
    worker;
    pendingEnqueues = new Map();
    unsParameters;
    processStatusTopic;
    instanceName;
    currentSequenceId = new Map();
    topicBuilder;
    constructor(mqttHost, processName, instanceName, unsParameters, publisherActive = false, subscriberActive = false) {
        super();
        this.instanceName = instanceName;
        // Create the topic builder using packageJson values and the processName.
        this.topicBuilder = new MqttTopicBuilder(`uns-infra/${MqttTopicBuilder.sanitizeTopicPart(packageJson.name)}/${MqttTopicBuilder.sanitizeTopicPart(packageJson.version)}/${MqttTopicBuilder.sanitizeTopicPart(processName)}/`);
        // Generate the processStatusTopic using the builder.
        this.processStatusTopic = this.topicBuilder.getProcessStatusTopic();
        // Derive the instanceStatusTopic by appending the instance name.
        this.instanceStatusTopic = this.processStatusTopic + instanceName + "/";
        // Concatenate processName with instanceName for the worker identification.
        this.instanceNameWithSuffix = `${processName}-${instanceName}`;
        const mqttParameters = {
            mqttSubToTopics: unsParameters?.mqttSubToTopics ?? [],
            username: unsParameters?.username ?? "",
            password: unsParameters?.password ?? "",
            mqttSSL: unsParameters?.mqttSSL ?? false,
            statusTopic: this.instanceStatusTopic,
            rejectUnauthorized: unsParameters?.rejectUnauthorized ?? false,
        };
        this.unsParameters = unsParameters ?? {};
        this.startQueueWorker(mqttHost, this.instanceNameWithSuffix, mqttParameters, publisherActive, subscriberActive);
    }
    /**
     * Resolve object identity from explicit fields or the tail of the topic path.
     * Falls back to parsing when not provided for backward compatibility.
     */
    resolveObjectIdentity(msg) {
        const providedType = msg.objectType;
        const providedId = msg.objectId;
        const providedAsset = msg.asset;
        const topicParts = msg.topic.split("/").filter((part) => part.length > 0);
        const hasObjectTail = topicParts.length >= 2;
        const parsedType = hasObjectTail ? topicParts[topicParts.length - 2] : undefined;
        const parsedId = hasObjectTail ? topicParts[topicParts.length - 1] : undefined;
        const parsedAsset = hasObjectTail
            ? (topicParts.length >= 3 ? topicParts[topicParts.length - 3] : undefined)
            : (topicParts.length >= 1 ? topicParts[topicParts.length - 1] : undefined);
        const objectType = providedType ?? parsedType;
        const objectId = providedId ?? parsedId ?? "main";
        const asset = providedAsset ?? parsedAsset;
        // If values are provided, trust them; otherwise derive from topic.
        if (!providedType || !providedId) {
            if (parsedType && parsedId) {
                logger.warn(`${this.instanceNameWithSuffix} - objectType/objectId missing; derived from topic tail ${parsedType}/${parsedId}`);
            }
            else {
                logger.warn(`${this.instanceNameWithSuffix} - objectType/objectId missing; defaulting objectId to 'main' for topic '${msg.topic}'. Expected topic to end with '<objectType>/<objectId>/'`);
            }
        }
        // Asset is optional; no warning on mismatch to avoid noisy logs when base topics don't carry it.
        msg.objectType = objectType;
        msg.objectId = objectId;
        msg.asset = asset;
        return { objectType, objectId, asset };
    }
    /**
     * Ensure the topic ends with a trailing slash for attribute concatenation.
     */
    normalizeTopicWithObject(topic) {
        return topic.endsWith("/") ? topic : `${topic}/`;
    }
    /**
     * Starts a worker thread to process the throttled publish queue.
     */
    startQueueWorker(mqttHost, instanceNameWithSuffix, mqttParameters, publisherActive, subscriberActive) {
        const workerData = {
            publishThrottlingDelay: this.unsParameters.publishThrottlingDelay ?? 1,
            subscribeThrottlingDelay: this.unsParameters.subscribeThrottlingDelay ?? 1,
            persistToDisk: false,
            mqttHost: mqttHost,
            instanceNameWithSuffix: instanceNameWithSuffix,
            mqttParameters: mqttParameters,
            publisherActive,
            subscriberActive
        };
        this.worker = new Worker(workerScriptPath, { workerData });
        this.worker.on("message", (msg) => {
            if (msg && msg.command === "enqueueResult" && msg.id) {
                const pending = this.pendingEnqueues.get(msg.id);
                if (pending) {
                    if (msg.status === "success" && msg.topic && msg.message) {
                        pending.resolve();
                    }
                    else {
                        pending.reject(new Error(msg.error));
                    }
                    this.pendingEnqueues.delete(msg.id);
                }
            }
            else if (msg && msg.command === "input") {
                this.event.emit("input", { topic: msg.topic, message: msg.message.toString(), packet: msg.packet });
            }
            else if (msg && (msg.command === "handover_subscriber" || msg.command === "handover_publisher")) {
                this.event.emit("mqttWorker", { command: msg.command, batchSize: msg.batchSize, referenceHash: msg.referenceHash, instanceName: this.instanceName });
            }
            else if (msg && msg.command === "mqttProxyStatus") {
                this.event.emit("mqttProxyStatus", { event: msg.event, value: msg.value, uom: msg.uom, statusTopic: msg.statusTopic });
            }
        });
        this.worker.on("error", (err) => {
            logger.error("Error in worker:", err);
        });
        this.worker.on("exit", (code) => {
            if (code !== 0) {
                logger.error(`Worker exited with code ${code}`);
            }
        });
    }
    /**
     * Enqueues a message to the worker queue.
     *
     * @param topic - The topic to which the message belongs.
     * @param message - The message to be enqueued.
     * @param options - Optional publish options.
     * @returns A promise that resolves when the message is successfully enqueued.
     */
    async enqueueMessageToWorkerQueue(topic, message, options) {
        return new Promise((resolve, reject) => {
            // const id: string = String(this.currentSequenceId.get(topic) ?? 0);
            const id = `${Date.now()}-${Math.random()}`;
            this.pendingEnqueues.set(id, { resolve, reject });
            this.worker.postMessage({ command: "enqueue", id, topic, message, options });
        });
    }
    /**
     * Sets the publisher active state.
     *
     * @param batchSize - Optional batch size.
     * @param referenceHash - Optional reference hash.
     */
    setPublisherActive(batchSize, referenceHash) {
        this.worker.postMessage({ command: "setPublisherActive", batchSize, referenceHash });
    }
    /**
     * Sets the publisher to passive mode.
     * @returns A promise that resolves when the publisher is set to passive.
     */
    setPublisherPassive() {
        this.worker.postMessage({ command: "setPublisherPassive" });
        return new Promise((resolve) => {
            this.event.on("mqttWorker", (msg) => {
                if (msg.command === "handover_publisher") {
                    logger.info(`${this.instanceNameWithSuffix} - Publisher set to passive.`);
                    resolve(msg);
                }
            });
        });
    }
    /**
     * Sets the subscriber active state.
     *
     * @param batchSize - Optional batch size.
     * @param referenceHash - Optional reference hash.
     */
    setSubscriberActive(batchSize, referenceHash) {
        this.worker.postMessage({ command: "setSubscriberActive", batchSize, referenceHash });
    }
    /**
     * Sets the subscriber to passive mode.
     * @returns A promise that resolves when the subscriber is set to passive.
     */
    setSubscriberPassive() {
        this.worker.postMessage({ command: "setSubscriberPassive" });
        return new Promise((resolve) => {
            this.event.on("mqttWorker", (msg) => {
                if (msg.command === "handover_subscriber") {
                    logger.info(`${this.instanceNameWithSuffix} - Publisher set to passive.`);
                    resolve(msg);
                }
            });
        });
    }
    /**
     * Sets the subscriber to passive mode and allows the publisher to run
     * until the queue is empty (all messages are processed).
     */
    async setSubscriberPassiveAndDrainQueue() {
        return new Promise(async (resolve) => {
            const mqttWorkerData = await this.setSubscriberPassive();
            while (this.pendingEnqueues.size > 0) {
                await new Promise((resolve) => setTimeout(resolve, 100)); // Poll every 100ms
            }
            logger.info(`${this.instanceNameWithSuffix} - Subscriber set to passive and queue drained.`);
            resolve(mqttWorkerData);
        });
    }
    /**
     * Processes and publishes MQTT messages based on the selected message mode.
     *
     * @param mqttMessage - The MQTT message object.
     * @param mode - The message mode (Raw, Delta, or Both).
     */
    async publishMqttMessage(mqttMessage, mode = MessageMode.Raw) {
        if (!mqttMessage) {
            logger.error(`${this.instanceNameWithSuffix} - Error publishing mqtt message: mqttMessage must be defined.`);
            return;
        }
        // Multi-attribute payload
        if ("attributes" in mqttMessage) {
            const { topic, asset, assetDescription, objectType, objectTypeDescription, objectId } = mqttMessage;
            for (const attrEntry of mqttMessage.attributes) {
                const message = "message" in attrEntry && attrEntry.message
                    ? attrEntry.message
                    : "data" in attrEntry && attrEntry.data
                        ? { data: attrEntry.data, createdAt: attrEntry.createdAt, expiresAt: attrEntry.expiresAt }
                        : "table" in attrEntry && attrEntry.table
                            ? { table: attrEntry.table, createdAt: attrEntry.createdAt, expiresAt: attrEntry.expiresAt }
                            : (() => { throw new Error("Attribute entry must include exactly one of data/table/message"); })();
                const packet = await UnsPacket.unsPacketFromUnsMessage(message);
                const singleMsg = {
                    topic,
                    asset,
                    assetDescription,
                    objectType,
                    objectTypeDescription,
                    objectId,
                    attribute: attrEntry.attribute,
                    description: attrEntry.description,
                    tags: attrEntry.tags,
                    attributeNeedsPersistence: attrEntry.attributeNeedsPersistence,
                    packet,
                };
                await this.publishMqttMessage(singleMsg, mode);
            }
            return;
        }
        if (!mqttMessage.packet) {
            logger.error(`${this.instanceNameWithSuffix} - Error publishing mqtt message: mqttMessage.packet must be defined.`);
            return;
        }
        const time = UnsPacket.formatToISO8601(new Date());
        switch (mode) {
            case MessageMode.Raw: {
                this.processAndEnqueueMessage(mqttMessage, time, false);
                break;
            }
            case MessageMode.Delta: {
                const deltaMessage = { ...mqttMessage };
                deltaMessage.attribute = `${mqttMessage.attribute}-delta`;
                deltaMessage.description = `${mqttMessage.description} (delta)`;
                this.processAndEnqueueMessage(deltaMessage, time, true);
                break;
            }
            case MessageMode.Both: {
                this.processAndEnqueueMessage(mqttMessage, time, false);
                const deltaMessageBoth = { ...mqttMessage };
                deltaMessageBoth.attribute = `${mqttMessage.attribute}-delta`;
                deltaMessageBoth.description = `${mqttMessage.description} (delta)`;
                this.processAndEnqueueMessage(deltaMessageBoth, time, true);
                break;
            }
        }
    }
    /**
     * Publishes a message to a specified topic.
     *
     * @param topic - The MQTT topic.
     * @param message - The message to publish.
     * @returns A promise that resolves when enqueued.
     */
    publishMessage(topic, message) {
        return this.enqueueMessageToWorkerQueue(topic, message);
    }
    /**
     * Parses an MQTT packet from a JSON string.
     *
     * @param mqttPacket - The MQTT packet string.
     * @returns A parsed IUnsPacket object or null.
     */
    parseMqttPacket(mqttPacket) {
        return UnsPacket.parseMqttPacket(mqttPacket, this.instanceNameWithSuffix);
    }
    /**
     * Subscribes asynchronously to one or more topics.
     *
     * @param topics - A topic or list of topics.
     */
    subscribeAsync(topics) {
        this.worker.postMessage({ command: "subscribeAsync", topics });
    }
    /**
     * Unsubscribes asynchronously from the given topics.
     *
     * @param topics - A list of topics.
     */
    unsubscribeAsync(topics) {
        this.worker.postMessage({ command: "unsubscribeAsync", topics });
    }
    /**
     * Processes and enqueues a message to the worker queue, including handling
     * sequencing, value differences, and tracking of unique topics.
     *
     * @param msg - The MQTT message to process.
     * @param time - The timestamp.
     * @param valueIsCumulative - Whether the value is cumulative.
     */
    async processAndEnqueueMessage(msg, time, valueIsCumulative = false) {
        try {
            const attributeType = msg.packet.message.data ? UnsAttributeType.Data :
                msg.packet.message.table ? UnsAttributeType.Table : null;
            let dataGroup = "";
            if (attributeType == UnsAttributeType.Data)
                dataGroup = msg.packet.message.data.dataGroup ?? "";
            if (attributeType == UnsAttributeType.Table)
                dataGroup = msg.packet.message.table.dataGroup ?? "";
            const { objectType, objectId, asset } = this.resolveObjectIdentity(msg);
            const normalizedTopic = this.normalizeTopicWithObject(msg.topic);
            msg.topic = normalizedTopic;
            const description = msg.description ?? getAttributeDescription(msg.attribute) ?? "";
            const objectTypeDescription = msg.objectTypeDescription ?? (objectType ? getObjectTypeDescription(objectType) : undefined);
            this.registerUniqueTopic({
                timestamp: time,
                topic: msg.topic,
                attribute: msg.attribute,
                attributeType: attributeType,
                description,
                tags: msg.tags,
                attributeNeedsPersistence: msg.attributeNeedsPersistence,
                dataGroup,
                asset,
                assetDescription: msg.assetDescription,
                objectType,
                objectTypeDescription,
                objectId
            });
            const publishTopic = `${msg.topic}${asset ? `${asset}/` : ""}${objectType ? `${objectType}/` : ""}${objectId ? `${objectId}/` : ""}${msg.attribute}`;
            const sequenceId = this.currentSequenceId.get(msg.topic) ?? 0;
            this.currentSequenceId.set(msg.topic, sequenceId + 1);
            msg.packet.sequenceId = sequenceId;
            if (msg.packet.message.data) {
                const newValue = msg.packet.message.data.value;
                const newUom = msg.packet.message.data.uom;
                const lastValueEntry = this.lastValues.get(publishTopic);
                const currentTime = new Date(msg.packet.message.data.time);
                if (lastValueEntry) {
                    const intervalBetweenMessages = currentTime.getTime() - lastValueEntry.timestamp.getTime();
                    const lastValue = lastValueEntry.value;
                    this.lastValues.set(publishTopic, { value: newValue, uom: newUom, timestamp: currentTime });
                    // Compute the delta and manage cumulative resets
                    if (valueIsCumulative == true && typeof newValue === "number" && typeof lastValue === "number") {
                        // Skip if newValue is 0 (likely a glitch)
                        if (newValue === 0) {
                            return; // Don't process or enqueue
                        }
                        const delta = newValue - lastValue;
                        msg.packet.message.data.value = delta < 0 ? newValue : delta;
                    }
                    msg.packet.interval = intervalBetweenMessages;
                    await this.enqueueMessageToWorkerQueue(publishTopic, JSON.stringify(msg.packet));
                }
                else {
                    this.lastValues.set(publishTopic, { value: newValue, uom: newUom, timestamp: currentTime });
                    logger.debug(`${this.instanceNameWithSuffix} - Need one more packet to calculate interval on topic ${publishTopic}`);
                    if (valueIsCumulative === false) {
                        await this.enqueueMessageToWorkerQueue(publishTopic, JSON.stringify(msg.packet));
                    }
                    else {
                        logger.debug(`${this.instanceNameWithSuffix} - Need one more packet to calculate difference on value in data for topic ${publishTopic}`);
                    }
                }
            }
            else if (msg.packet.message.table) {
                await this.enqueueMessageToWorkerQueue(publishTopic, JSON.stringify(msg.packet));
            }
            else {
                logger.error(`${this.instanceNameWithSuffix} - Error publishing message to topic ${publishTopic}: packet.message must include data or table`);
            }
        }
        catch (error) {
            logger.error(`${this.instanceNameWithSuffix} - Error publishing message to topic ${msg.topic}${msg.attribute}: ${error.message}`);
        }
    }
    /**
     * Stops the UnsProxy instance and cleans up resources.
     */
    async stop() {
        super.stop();
        // Terminate the worker thread if it exists.
        if (this.worker) {
            try {
                const exitCode = await this.worker.terminate();
                logger.info(`${this.instanceNameWithSuffix} - Worker terminated with exit code ${exitCode}`);
            }
            catch (error) {
                logger.error(`${this.instanceNameWithSuffix} - Error terminating worker: ${error.message}`);
            }
        }
        // Optionally, handle any pending enqueues.
        for (const [id, pending] of this.pendingEnqueues) {
            pending.reject(new Error("UnsProxy has been stopped"));
            this.pendingEnqueues.delete(id);
        }
    }
}
//# sourceMappingURL=uns-mqtt-proxy.js.map