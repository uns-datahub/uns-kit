import mqtt from "mqtt";
import logger from "../logger.js";
import { UnsEventEmitter } from "../uns/uns-event-emitter.js";
import { DataSizeMeasurements, PhysicalMeasurements } from "../uns/uns-measurements.js";
export default class MqttProxy {
    event = new UnsEventEmitter();
    statusTopic;
    instanceName;
    mqttHost;
    mqttSubToTopics;
    mqttSSL;
    mqttClient;
    startDate;
    mqttParameters;
    statusUpdateInterval;
    transformationStatsInterval = null;
    publishedMessageCount = 0;
    publishedMessageBytes = 0;
    subscribedMessageCount = 0;
    subscribedMessageBytes = 0;
    mqttWorker;
    isConnected = false;
    constructor(mqttHost, instanceName, mqttParameters, mqttWorker) {
        this.mqttSSL = mqttParameters?.mqttSSL ?? false;
        this.mqttSubToTopics = mqttParameters?.mqttSubToTopics ?? [];
        this.mqttHost = mqttHost;
        this.startDate = new Date();
        this.instanceName = instanceName ?? "process";
        this.statusTopic = `${mqttParameters?.statusTopic}`;
        this.mqttParameters = mqttParameters ?? {};
        this.mqttWorker = mqttWorker;
    }
    async start() {
        logger.info(`${this.instanceName} - Connecting to MQTT broker...`);
        return new Promise((resolve, reject) => {
            try {
                const username = this.mqttParameters.username;
                const password = this.mqttParameters.password;
                const options = {
                    username,
                    password,
                    protocolVersion: 5,
                    rejectUnauthorized: this.mqttSSL,
                    will: {
                        topic: `${this.statusTopic}alive`,
                        payload: Buffer.from(""),
                        qos: 0,
                        retain: true,
                        properties: { messageExpiryInterval: 3600 },
                    },
                    clientId: this.instanceName,
                    clean: true,
                };
                const protocol = this.mqttSSL ? "mqtts" : "mqtt";
                this.mqttClient = mqtt.connect(`${protocol}://${this.mqttHost}`, options);
                const onConnect = () => {
                    try {
                        this.mqttClient.stream.setMaxListeners(0);
                        logger.info(`${this.instanceName} - Connected to MQTT broker at ${this.mqttHost}`);
                        if (this.mqttSubToTopics && this.mqttSubToTopics.length > 0) {
                            logger.info(`${this.instanceName} - Subscribed to ${this.mqttSubToTopics.length} topics.`);
                            this.mqttClient.subscribe(this.mqttSubToTopics, { qos: 0 });
                        }
                        if (this.statusTopic) {
                            this.statusUpdateInterval = setInterval(() => this.emitStatusUpdates(), 10000);
                        }
                        this.transformationStatsInterval = setInterval(() => {
                            this.emitTransformationStatistics();
                        }, 60000);
                        this.mqttClient.off("connect", onConnect);
                        this.isConnected = true;
                        resolve();
                    }
                    catch (error) {
                        logger.error(`${this.instanceName} - Error in MQTT connect handler: ${error.message}`);
                        this.isConnected = false;
                        reject(error);
                    }
                };
                this.mqttClient.on("connect", onConnect);
                this.mqttClient.on("message", (topic, message, packet) => {
                    try {
                        logger.debug(`${this.instanceName} - Message received on topic ${topic}`);
                        this.event.emit("input", {
                            message: message.toString(),
                            topic: topic,
                            packet: packet,
                        });
                        this.updateSubscribeTransformationStats(message.length);
                    }
                    catch (error) {
                        logger.error(`${this.instanceName} - Error in MQTT message handler: ${error.message}`);
                    }
                });
                this.mqttClient.on("error", (error) => {
                    logger.error(`${this.instanceName} - MQTT client error: ${error.message}`);
                    this.isConnected = false;
                    if ("code" in error) {
                        this.event.emit("error", { code: error.code, message: error.message });
                    }
                    else {
                        this.event.emit("error", { message: error.message, code: 0 });
                    }
                    reject(error);
                });
                this.mqttClient.on("reconnect", () => {
                    logger.debug(`${this.instanceName} - Attempting to reconnect to MQTT broker...`);
                });
                this.mqttClient.on("close", () => {
                    logger.debug(`${this.instanceName} - MQTT connection closed.`);
                    this.isConnected = false;
                });
                this.mqttClient.on("offline", () => {
                    logger.debug(`${this.instanceName} - MQTT client is offline.`);
                    this.isConnected = false;
                });
                this.mqttClient.on("end", () => {
                    logger.debug(`${this.instanceName} - MQTT client connection ended.`);
                    this.isConnected = false;
                });
                this.mqttClient.on("disconnect", (packet) => {
                    logger.debug(`${this.instanceName} - MQTT client disconnected. Reason: ${packet?.reasonCode}`);
                    this.isConnected = false;
                });
            }
            catch (error) {
                logger.error(`${this.instanceName} - Error starting MQTT proxy: ${error.message}`);
                this.isConnected = false;
                reject(error);
            }
        });
    }
    async publish(topic, message, options) {
        this.updatePublishTransformationStats(JSON.stringify(message).length);
        return new Promise((resolve, reject) => {
            if (!this.mqttClient || !this.mqttClient.connected) {
                const error = new Error(`${this.instanceName} - MQTT client is not connected.`);
                logger.error(error.message);
                return reject(error);
            }
            this.mqttClient.publish(topic, message, options || {}, (err) => {
                if (err) {
                    logger.error(`${this.instanceName} - Error publishing to topic ${topic}: ${err.message}`);
                    return reject(err);
                }
                logger.debug(`${this.instanceName} - Published message to topic ${topic}`);
                resolve();
            });
        });
    }
    async subscribeAsync(topic, options) {
        return this.mqttClient.subscribeAsync(topic, options);
    }
    async unsubscribeAsync(topic) {
        return this.mqttClient.unsubscribeAsync(topic);
    }
    stop() {
        logger.info(`${this.instanceName} - Disconnecting from MQTT broker...`);
        try {
            if (this.statusUpdateInterval) {
                clearInterval(this.statusUpdateInterval);
                this.statusUpdateInterval = null;
            }
            if (this.transformationStatsInterval) {
                clearInterval(this.transformationStatsInterval);
                this.transformationStatsInterval = null;
            }
            if (this.mqttClient) {
                this.mqttClient.end(false, () => {
                    this.isConnected = false;
                    logger.info(`${this.instanceName} - Disconnected from MQTT broker.`);
                });
            }
        }
        catch (error) {
            logger.error(`${this.instanceName} - Error during stop: ${error.message}`);
            this.isConnected = false;
        }
    }
    emitStatusUpdates() {
        try {
            const uptime = Math.round((new Date().getTime() - this.startDate.getTime()) / 60000);
            this.event.emit("mqttProxyStatus", { event: "uptime", value: uptime, uom: PhysicalMeasurements.Minute, statusTopic: this.statusTopic + "uptime" });
            this.event.emit("mqttProxyStatus", { event: "alive", value: 1, uom: DataSizeMeasurements.Bit, statusTopic: this.statusTopic + "alive" });
            if (this.mqttWorker !== undefined) {
                const tpValue = this.mqttWorker.getPublisherState() ? 1 : 0;
                this.event.emit("mqttProxyStatus", { event: "t-publisher-active", value: tpValue, uom: DataSizeMeasurements.Bit, statusTopic: this.statusTopic + "t-publisher-active" });
                const tsValue = this.mqttWorker.getSubscriberState() ? 1 : 0;
                this.event.emit("mqttProxyStatus", { event: "t-subscriber-active", value: tsValue, uom: DataSizeMeasurements.Bit, statusTopic: this.statusTopic + "t-subscriber-active" });
            }
        }
        catch (error) {
            logger.error(`${this.instanceName} - Error publishing MQTT status: ${error.message}`);
        }
    }
    updatePublishTransformationStats(messageSizeOut) {
        this.publishedMessageCount += 1;
        this.publishedMessageBytes += messageSizeOut;
    }
    updateSubscribeTransformationStats(messageSizeIn) {
        this.subscribedMessageCount += 1;
        this.subscribedMessageBytes += messageSizeIn;
    }
    async emitTransformationStatistics() {
        if (this.statusTopic !== "") {
            try {
                this.event.emit("mqttProxyStatus", {
                    event: "published-message-count",
                    value: this.publishedMessageCount,
                    uom: "",
                    statusTopic: this.statusTopic + "published-message-count",
                });
                this.event.emit("mqttProxyStatus", {
                    event: "published-message-bytes",
                    value: Math.round(this.publishedMessageBytes / 1024),
                    uom: DataSizeMeasurements.KiloByte,
                    statusTopic: this.statusTopic + "published-message-bytes",
                });
                this.event.emit("mqttProxyStatus", {
                    event: "subscribed-message-count",
                    value: this.subscribedMessageCount,
                    uom: "",
                    statusTopic: this.statusTopic + "subscribed-message-count",
                });
                this.event.emit("mqttProxyStatus", {
                    event: "subscribed-message-bytes",
                    value: Math.round(this.subscribedMessageBytes / 1024),
                    uom: DataSizeMeasurements.KiloByte,
                    statusTopic: this.statusTopic + "subscribed-message-bytes",
                });
                this.publishedMessageCount = 0;
                this.publishedMessageBytes = 0;
                this.subscribedMessageCount = 0;
                this.subscribedMessageBytes = 0;
            }
            catch (error) {
                this.publishedMessageCount = 0;
                this.publishedMessageBytes = 0;
                this.subscribedMessageCount = 0;
                this.subscribedMessageBytes = 0;
                logger.error(`${this.instanceName} - Error emitting transformation statistics: ${error.message}`);
            }
        }
    }
}
