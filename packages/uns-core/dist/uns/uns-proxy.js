import logger from "../logger.js";
import { UnsEventEmitter } from "./uns-event-emitter.js";
import { UnsPacket } from "./uns-packet.js";
export default class UnsProxy {
    publishInterval = null;
    event = new UnsEventEmitter();
    instanceStatusTopic;
    instanceNameWithSuffix; //was prot
    producedTopics = new Map();
    producedApiEndpoints = new Map();
    constructor() {
        // Set up interval to publish produced topics every 60 seconds.
        this.publishInterval = setInterval(() => {
            this.emitProducedTopics();
            this.emitProducedApiEndpoints();
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
                    if (topicsArray.length > 0) {
                        this.event.emit("unsProxyProducedTopics", { producedTopics: topicsArray, statusTopic: this.instanceStatusTopic + "topics" });
                    }
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
     * Registers a unique topic so that it is tracked and published only once.
     *
     * @param topicObject - The object containing topic details.
     */
    registerUniqueTopic(topicObject) {
        if (this.instanceStatusTopic !== "") {
            const fullTopic = `${topicObject.topic}${topicObject.asset}/${topicObject.objectType}/${topicObject.objectId}/${topicObject.attribute}`;
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
                    objectId: topicObject.objectId
                });
                this.emitProducedTopics();
                logger.info(`${this.instanceNameWithSuffix} - Registered new topic: ${fullTopic}`);
            }
        }
    }
    /**
     * Registers an API endpoint to handle requests for a specific topic and attribute.
     */
    registerApiEndpoint(apiObject) {
        if (this.instanceStatusTopic !== "") {
            const fullTopic = `${apiObject.topic}${apiObject.asset}/${apiObject.objectType}/${apiObject.objectId}/${apiObject.attribute}`;
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
                    objectId: apiObject.objectId
                });
                this.emitProducedApiEndpoints();
                logger.info(`${this.instanceNameWithSuffix} - Registered new api endpoint: /${fullTopic}`);
            }
        }
    }
    unregisterApiEndpoint(topic, asset, objectType, objectId, attribute) {
        const fullTopic = `${topic}/${asset}/${objectType}/${objectId}/${attribute}`;
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