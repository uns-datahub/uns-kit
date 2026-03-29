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
    rejectUnauthorized;
    pendingReconnectWait = null;
    hasEstablishedConnection = false;
    startupSettled = false;
    startupResolve = null;
    startupReject = null;
    constructor(mqttHost, instanceName, mqttParameters, mqttWorker) {
        this.mqttSSL = mqttParameters?.mqttSSL ?? false;
        this.rejectUnauthorized = mqttParameters.rejectUnauthorized ?? false;
        this.mqttSubToTopics = mqttParameters?.mqttSubToTopics ?? [];
        this.mqttHost = mqttHost;
        this.startDate = new Date();
        this.instanceName = instanceName ?? "process";
        this.statusTopic = `${mqttParameters?.statusTopic}`;
        this.mqttParameters = mqttParameters ?? {};
        this.mqttWorker = mqttWorker;
    }
    resolveProtocol() {
        return this.mqttParameters.protocol ?? (this.mqttSSL ? "mqtts" : "mqtt");
    }
    resolveDefaultPort(protocol) {
        switch (protocol) {
            case "mqtts":
            case "ssl":
                return 8883;
            case "wss":
                return 443;
            case "ws":
                return 80;
            case "tcp":
            case "mqtt":
            default:
                return 1883;
        }
    }
    ensureStatusUpdateInterval() {
        if (this.statusTopic && !this.statusUpdateInterval) {
            this.statusUpdateInterval = setInterval(() => this.emitStatusUpdates(), 10000);
        }
    }
    ensureTransformationStatsInterval() {
        if (!this.transformationStatsInterval) {
            this.transformationStatsInterval = setInterval(() => {
                this.emitTransformationStatistics();
            }, 60000);
        }
    }
    subscribeToTopics() {
        if (this.mqttSubToTopics && this.mqttSubToTopics.length > 0) {
            logger.debug(`${this.instanceName} - Subscribed to ${this.mqttSubToTopics.length} topics.`);
            this.mqttClient.subscribe(this.mqttSubToTopics, { qos: 0 });
        }
    }
    buildServers(defaultProtocol) {
        const servers = [];
        const { port } = this.mqttParameters;
        const protocol = this.mqttParameters.protocol ?? defaultProtocol;
        if (Array.isArray(this.mqttParameters.servers) && this.mqttParameters.servers.length > 0) {
            for (const server of this.mqttParameters.servers) {
                if (!server?.host)
                    continue;
                const resolvedProtocol = server.protocol ?? protocol;
                const resolvedPort = typeof server.port === "number"
                    ? server.port
                    : typeof port === "number"
                        ? port
                        : this.resolveDefaultPort(resolvedProtocol);
                const entry = {
                    host: server.host,
                    port: resolvedPort,
                };
                if (resolvedProtocol) {
                    entry.protocol = resolvedProtocol;
                }
                servers.push(entry);
            }
        }
        else if (Array.isArray(this.mqttParameters.hosts) && this.mqttParameters.hosts.length > 0) {
            for (const host of this.mqttParameters.hosts) {
                if (!host)
                    continue;
                const resolvedPort = typeof port === "number" ? port : this.resolveDefaultPort(protocol);
                const entry = {
                    host,
                    port: resolvedPort,
                };
                if (protocol) {
                    entry.protocol = protocol;
                }
                servers.push(entry);
            }
        }
        return servers.length > 0 ? servers : undefined;
    }
    async start() {
        logger.debug(`${this.instanceName} - Connecting to MQTT broker...`);
        this.startupSettled = false;
        return new Promise((resolve, reject) => {
            this.startupResolve = resolve;
            this.startupReject = reject;
            try {
                const username = this.mqttParameters.username;
                const password = this.mqttParameters.password;
                const clientId = this.mqttParameters.clientId ?? this.instanceName;
                const protocol = this.resolveProtocol();
                const options = {
                    username,
                    password,
                    protocolVersion: 5,
                    rejectUnauthorized: this.rejectUnauthorized,
                    keepalive: this.mqttParameters.keepalive,
                    clean: this.mqttParameters.clean ?? true,
                    connectTimeout: this.mqttParameters.connectTimeout,
                    reconnectPeriod: this.mqttParameters.reconnectPeriod,
                    reconnectOnConnackError: this.mqttParameters.reconnectOnConnackError,
                    resubscribe: this.mqttParameters.resubscribe,
                    queueQoSZero: this.mqttParameters.queueQoSZero,
                    properties: this.mqttParameters.properties,
                    ca: this.mqttParameters.ca,
                    cert: this.mqttParameters.cert,
                    key: this.mqttParameters.key,
                    servername: this.mqttParameters.servername,
                    will: {
                        topic: `${this.statusTopic}alive`,
                        payload: Buffer.from(""),
                        qos: 0,
                        retain: true,
                        properties: { messageExpiryInterval: 3600 },
                    },
                    clientId,
                };
                const servers = this.buildServers(protocol);
                if (servers) {
                    options.servers = servers;
                    options.protocol = protocol;
                    this.mqttClient = mqtt.connect(options);
                }
                else {
                    options.host = this.mqttHost;
                    options.port = this.mqttParameters.port;
                    options.protocol = protocol;
                    this.mqttClient = mqtt.connect(options);
                }
                const onConnect = () => this.handleMqttConnect();
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
                    const errorInfo = formatMqttError(error);
                    logger.error(`${this.instanceName} - MQTT client error: ${errorInfo.message}`);
                    this.isConnected = false;
                    this.event.emit("error", {
                        code: typeof errorInfo.code === "number" ? errorInfo.code : 0,
                        message: errorInfo.message,
                    });
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
                logger.error(`${this.instanceName} - Error starting MQTT proxy: ${formatMqttError(error).message}`);
                this.isConnected = false;
                reject(error);
            }
        });
    }
    async publish(topic, message, options) {
        this.updatePublishTransformationStats(JSON.stringify(message).length);
        const client = this.mqttClient;
        if (!client) {
            logger.warn(`${this.instanceName} - MQTT client missing; dropping publish to ${topic}`);
            return;
        }
        if (!client.connected) {
            // Wait briefly for reconnection before giving up.
            await this.waitForReconnect(client, 5000);
        }
        if (!client.connected) {
            logger.warn(`${this.instanceName} - MQTT client still disconnected; dropping publish to ${topic}`);
            return;
        }
        return new Promise((resolve, reject) => {
            client.publish(topic, message, options || {}, (err) => {
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
        const topics = Array.isArray(topic) ? topic.filter((t) => typeof t === "string" && t.length > 0) : [topic].filter((t) => typeof t === "string" && t.length > 0);
        if (topics.length === 0) {
            logger.warn(`${this.instanceName} - unsubscribeAsync called with empty topic list; skipping.`);
            return Promise.resolve(undefined);
        }
        return this.mqttClient.unsubscribeAsync(topics);
    }
    stop(options = {}) {
        const silent = options.silent === true || options.reason === "retry";
        const shouldLogDisconnect = !silent && this.hasEstablishedConnection;
        if (shouldLogDisconnect) {
            logger.debug(`${this.instanceName} - Disconnecting from MQTT broker...`);
        }
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
                    this.pendingReconnectWait = null;
                    this.startupSettled = false;
                    this.hasEstablishedConnection = false;
                    this.startupResolve = null;
                    this.startupReject = null;
                    if (shouldLogDisconnect) {
                        logger.debug(`${this.instanceName} - Disconnected from MQTT broker.`);
                    }
                });
            }
            else {
                this.isConnected = false;
                this.pendingReconnectWait = null;
                this.startupSettled = false;
                this.hasEstablishedConnection = false;
                this.startupResolve = null;
                this.startupReject = null;
            }
        }
        catch (error) {
            if (!silent) {
                logger.error(`${this.instanceName} - Error during stop: ${formatMqttError(error).message}`);
            }
            this.isConnected = false;
            this.pendingReconnectWait = null;
            this.startupSettled = false;
            this.hasEstablishedConnection = false;
            this.startupResolve = null;
            this.startupReject = null;
        }
    }
    handleMqttConnect() {
        const resolve = this.startupResolve;
        const reject = this.startupReject;
        if (!resolve || !reject) {
            return;
        }
        try {
            this.mqttClient.stream.setMaxListeners(0);
            const isFirstConnect = !this.startupSettled;
            this.startupSettled = true;
            this.hasEstablishedConnection = true;
            this.isConnected = true;
            if (isFirstConnect) {
                logger.info(`${this.instanceName} - Connected to MQTT broker at ${this.mqttHost}`);
                this.subscribeToTopics();
                this.ensureStatusUpdateInterval();
                this.ensureTransformationStatsInterval();
                resolve();
                return;
            }
            logger.info(`${this.instanceName} - Reconnected to MQTT broker at ${this.mqttHost}`);
            if (this.mqttParameters.resubscribe === false) {
                this.subscribeToTopics();
            }
            this.ensureStatusUpdateInterval();
            this.ensureTransformationStatsInterval();
        }
        catch (error) {
            logger.error(`${this.instanceName} - Error in MQTT connect handler: ${formatMqttError(error).message}`);
            this.isConnected = false;
            reject(error);
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
    waitForReconnect(client, timeoutMs) {
        if (client.connected) {
            return Promise.resolve();
        }
        if (this.pendingReconnectWait) {
            return this.pendingReconnectWait;
        }
        this.pendingReconnectWait = new Promise((resolve) => {
            if (client.connected)
                return resolve();
            const onConnect = () => {
                cleanup();
                resolve();
            };
            const onClose = () => {
                // stay waiting; close is expected during reconnect attempts
            };
            const cleanup = () => {
                client.off("connect", onConnect);
                client.off("close", onClose);
            };
            client.on("connect", onConnect);
            client.on("close", onClose);
            setTimeout(() => {
                cleanup();
                resolve();
            }, timeoutMs).unref?.();
        }).finally(() => {
            this.pendingReconnectWait = null;
        });
        return this.pendingReconnectWait;
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
export function formatMqttError(error) {
    const parts = [];
    const codes = [];
    collectMqttErrorParts(error, parts, codes);
    const uniqueParts = Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean)));
    const message = uniqueParts.join("; ") || "Unknown MQTT error";
    return {
        code: codes[0] ?? 0,
        message,
    };
}
function collectMqttErrorParts(error, parts, codes) {
    if (error instanceof AggregateError) {
        if (typeof error.message === "string" && error.message.trim()) {
            parts.push(error.message.trim());
        }
        for (const nested of error.errors) {
            collectMqttErrorParts(nested, parts, codes);
        }
        return;
    }
    if (typeof error === "string") {
        if (error.trim()) {
            parts.push(error.trim());
        }
        return;
    }
    if (!error || typeof error !== "object") {
        return;
    }
    const record = error;
    const code = typeof record.code === "string" || typeof record.code === "number"
        ? record.code
        : undefined;
    if (code !== undefined) {
        codes.push(code);
    }
    const message = typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : undefined;
    const address = typeof record.address === "string" && record.address.trim()
        ? record.address.trim()
        : undefined;
    const port = typeof record.port === "number" ? record.port : undefined;
    const endpoint = address || port !== undefined
        ? `${address ?? ""}${address && port !== undefined ? ":" : ""}${port ?? ""}`.trim()
        : undefined;
    const detailParts = [
        code !== undefined && !message?.includes(String(code)) ? String(code) : undefined,
        message,
        endpoint && !message?.includes(endpoint) ? endpoint : undefined,
    ].filter((part) => typeof part === "string" && part.length > 0);
    if (detailParts.length > 0) {
        parts.push(detailParts.join(" "));
    }
    else if (typeof record.name === "string" && record.name.trim()) {
        parts.push(record.name.trim());
    }
    if (record.cause !== undefined) {
        collectMqttErrorParts(record.cause, parts, codes);
    }
}
//# sourceMappingURL=mqtt-proxy.js.map