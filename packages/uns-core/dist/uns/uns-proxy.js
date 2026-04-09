import logger from "../logger.js";
import { UnsEventEmitter } from "./uns-event-emitter.js";
import { UnsPacket } from "./uns-packet.js";
import { buildUnsIdentityPath } from "./uns-path.js";
export default class UnsProxy {
    publishInterval = null;
    event = new UnsEventEmitter();
    instanceStatusTopic;
    instanceNameWithSuffix; //was prot
    producedTopics = new Map();
    producedApiEndpoints = new Map();
    producedApiCatchall = new Map();
    controllerNameEnv;
    controllerHostEnv;
    controllerPortEnv;
    controllerPublicBaseEnv;
    constructor() {
        this.controllerNameEnv = process.env["UNS_CONTROLLER_NAME"];
        this.controllerHostEnv = process.env["UNS_CONTROLLER_HOST"];
        this.controllerPortEnv = process.env["UNS_CONTROLLER_PORT"];
        this.controllerPublicBaseEnv =
            process.env["UNS_CONTROLLER_PUBLIC_BASE"] ?? process.env["UNS_PUBLIC_BASE"];
        // Set up interval to publish produced topics every 60 seconds.
        this.publishInterval = setInterval(() => {
            this.emitProducedTopics();
            this.emitProducedApiEndpoints();
            this.emitProducedApiCatchall();
        }, 60000);
    }
    /**
     * Publishes the list of produced topics to the MQTT broker.
     */
    async emitProducedTopics() {
        if (this.instanceStatusTopic !== "") {
            const topicsArray = [...this.producedTopics.values()];
            if (topicsArray.length > 0) {
                try {
                    this.event.emit("unsProxyProducedTopics", { producedTopics: topicsArray, statusTopic: this.instanceStatusTopic + "topics" });
                }
                catch (error) {
                    logger.error(`${this.instanceNameWithSuffix} - Error publishing produced topics: ${error.message}`);
                }
                logger.debug(`${this.instanceNameWithSuffix} - Published produced topics.`);
            }
        }
    }
    /**
     * Publishes the list of produced API endpoints to the MQTT broker.
     */
    async emitProducedApiEndpoints() {
        if (this.instanceStatusTopic !== "") {
            const apiEndpointsArray = [...this.producedApiEndpoints.values()];
            if (apiEndpointsArray.length > 0) {
                try {
                    if (apiEndpointsArray.length > 0) {
                        this.event.emit("unsProxyProducedApiEndpoints", { producedApiEndpoints: apiEndpointsArray, statusTopic: this.instanceStatusTopic + "api-endpoints" });
                    }
                }
                catch (error) {
                    logger.error(`${this.instanceNameWithSuffix} - Error publishing produced API endpoints: ${error.message}`);
                }
                logger.debug(`${this.instanceNameWithSuffix} - Published produced API endpoints.`);
            }
        }
    }
    /**
     * Publishes the list of catch-all API mappings to the MQTT broker.
     */
    async emitProducedApiCatchall() {
        if (this.instanceStatusTopic !== "") {
            const catchallArray = [...this.producedApiCatchall.values()];
            if (catchallArray.length > 0) {
                try {
                    this.event.emit("unsProxyProducedApiCatchAll", {
                        producedCatchall: catchallArray,
                        statusTopic: this.instanceStatusTopic + "api-catchall",
                    });
                }
                catch (error) {
                    logger.error(`${this.instanceNameWithSuffix} - Error publishing catch-all API mappings: ${error.message}`);
                }
                logger.debug(`${this.instanceNameWithSuffix} - Published catch-all API mappings.`);
            }
        }
    }
    /**
     * Registers a unique topic and keeps its timestamp current.
     *
     * On first call the full entry is created and immediately emitted so the
     * controller can persist the new schema node.  On subsequent calls only the
     * timestamp is updated in-place; the 60-second heartbeat interval will carry
     * the updated value to the controller, making the timestamp reflect the time
     * of the most recent data publication rather than the one-off registration
     * moment.
     *
     * @param topicObject - The object containing topic details.
     */
    registerUniqueTopic(topicObject) {
        if (this.instanceStatusTopic !== "") {
            const fullTopic = buildUnsIdentityPath(topicObject.topic, topicObject.asset, topicObject.objectType, topicObject.objectId, topicObject.attribute);
            if (!this.producedTopics.has(fullTopic)) {
                this.producedTopics.set(fullTopic, {
                    timestamp: topicObject.timestamp,
                    topic: topicObject.topic,
                    attribute: topicObject.attribute,
                    attributeType: topicObject.attributeType,
                    description: topicObject.description,
                    tags: topicObject.tags,
                    attributeNeedsPersistence: topicObject.attributeNeedsPersistence ?? true,
                    dataGroup: topicObject.dataGroup ?? "",
                    asset: topicObject.asset,
                    assetDescription: topicObject.assetDescription,
                    objectType: topicObject.objectType,
                    objectTypeDescription: topicObject.objectTypeDescription,
                    objectId: topicObject.objectId,
                    ...(topicObject.validityMode ? { validityMode: topicObject.validityMode } : {}),
                    ...(topicObject.expectedIntervalMs ? { expectedIntervalMs: topicObject.expectedIntervalMs } : {}),
                    ...(topicObject.lifecycleEndValue ? { lifecycleEndValue: topicObject.lifecycleEndValue } : {}),
                });
                this.emitProducedTopics();
                logger.info(`${this.instanceNameWithSuffix} - Registered new topic: ${fullTopic}`);
            }
            else {
                // Already registered — refresh only the timestamp so the periodic
                // heartbeat reflects actual data flow rather than frozen startup time.
                this.producedTopics.get(fullTopic).timestamp = topicObject.timestamp;
            }
        }
    }
    /**
     * Registers an API endpoint to handle requests for a specific topic and attribute.
     */
    registerApiEndpoint(apiObject) {
        if (this.instanceStatusTopic !== "") {
            const fullTopic = buildUnsIdentityPath(apiObject.topic, apiObject.asset, apiObject.objectType, apiObject.objectId, apiObject.attribute);
            if (!this.producedApiEndpoints.has(fullTopic)) {
                const time = UnsPacket.formatToISO8601(new Date());
                this.producedApiEndpoints.set(fullTopic, {
                    timestamp: time,
                    topic: apiObject.topic,
                    attribute: apiObject.attribute,
                    apiHost: apiObject.apiHost,
                    apiEndpoint: apiObject.apiEndpoint,
                    apiMethod: apiObject.apiMethod,
                    apiQueryParams: apiObject.apiQueryParams,
                    apiDescription: apiObject.apiDescription,
                    attributeType: apiObject.attributeType,
                    apiSwaggerEndpoint: apiObject.apiSwaggerEndpoint,
                    asset: apiObject.asset,
                    objectType: apiObject.objectType,
                    objectId: apiObject.objectId,
                    ...(this.controllerNameEnv ? { controllerName: this.controllerNameEnv } : {}),
                    ...(this.controllerHostEnv ? { controllerHost: this.controllerHostEnv } : {}),
                    ...(this.controllerPortEnv ? { controllerPort: this.controllerPortEnv } : {}),
                    ...(this.controllerPublicBaseEnv ? { controllerPublicBase: this.controllerPublicBaseEnv } : {}),
                });
                this.emitProducedApiEndpoints();
                logger.info(`${this.instanceNameWithSuffix} - Registered new api endpoint: /${fullTopic}`);
            }
        }
    }
    registerApiCatchAll(mapping) {
        if (this.instanceStatusTopic !== "") {
            const key = mapping.topic.replace(/\/+$/, "");
            if (!this.producedApiCatchall.has(key)) {
                this.producedApiCatchall.set(key, mapping);
            }
            else {
                this.producedApiCatchall.set(key, { ...this.producedApiCatchall.get(key), ...mapping });
            }
            this.emitProducedApiCatchall();
            logger.info(`${this.instanceNameWithSuffix} - Registered catch-all API mapping: ${key}`);
        }
    }
    unregisterApiEndpoint(topic, asset, objectType, objectId, attribute) {
        const fullTopic = buildUnsIdentityPath(topic, asset, objectType, objectId, attribute);
        if (this.producedApiEndpoints.has(fullTopic)) {
            this.producedApiEndpoints.delete(fullTopic);
            this.emitProducedApiEndpoints();
            logger.info(`${this.instanceNameWithSuffix} - Unregistered API endpoint: ${fullTopic}`);
        }
    }
    async stop() {
        // Clear the publishing interval.
        if (this.publishInterval) {
            clearInterval(this.publishInterval);
            this.publishInterval = null;
        }
    }
}
//# sourceMappingURL=uns-proxy.js.map