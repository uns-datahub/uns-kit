import { IApiObject, ITopicObject, UnsEvents } from "./uns-interfaces";
import logger from "../logger";
import { UnsEventEmitter } from "./uns-event-emitter";
import { UnsPacket } from "./uns-packet";

export default class UnsProxy {
  private publishInterval: NodeJS.Timeout | null = null;
  public event: UnsEventEmitter<UnsEvents> = new UnsEventEmitter<UnsEvents>();
  protected instanceStatusTopic: string;
  protected instanceNameWithSuffix: string; //was prot
  private producedTopics: Map<string, ITopicObject> = new Map();
  private producedApiEndpoints: Map<string, IApiObject> = new Map();

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
  private async emitProducedTopics(): Promise<void> {
    if (this.instanceStatusTopic !== "") {
      const topicsArray = [...this.producedTopics.values()];
      if (topicsArray.length > 0) {
        try {
          if (topicsArray.length > 0) {
            this.event.emit("unsProxyProducedTopics", { producedTopics: topicsArray, statusTopic: this.instanceStatusTopic + "topics" });
          }
        } catch (error) {
          logger.error(`${this.instanceNameWithSuffix} - Error publishing produced topics: ${error.message}`);
        }
        logger.debug(`${this.instanceNameWithSuffix} - Published produced topics.`);
      }
    }
  }

  /**
   * Publishes the list of produced API endpoints to the MQTT broker.
   */
  private async emitProducedApiEndpoints(): Promise<void> {
    if (this.instanceStatusTopic !== "") {
      const apiEndpointsArray = [...this.producedApiEndpoints.values()];
      if (apiEndpointsArray.length > 0) {
        try {
          if (apiEndpointsArray.length > 0) {
            this.event.emit("unsProxyProducedApiEndpoints", { producedApiEndpoints: apiEndpointsArray, statusTopic: this.instanceStatusTopic + "api-endpoints" });
          }
        } catch (error) {
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
  protected registerUniqueTopic(topicObject: ITopicObject): void {
    if (this.instanceStatusTopic !== "") {
      const fullTopic = `${topicObject.topic}${topicObject.attribute}`;
      if (!this.producedTopics.has(fullTopic)) {
        this.producedTopics.set(fullTopic, {
          timestamp: topicObject.timestamp,
          topic: topicObject.topic,
          attribute: topicObject.attribute,
          attributeType: topicObject.attributeType,
          description: topicObject.description,
          tags: topicObject.tags,
          attributeNeedsPersistence: topicObject.attributeNeedsPersistence ?? true,
          dataGroup: topicObject.dataGroup ?? ""
        });
        this.emitProducedTopics();
        logger.info(`${this.instanceNameWithSuffix} - Registered new topic: ${fullTopic}`);
      }
    }
  }  

  /**
   * Registers an API endpoint to handle requests for a specific topic and attribute.
   */
  protected registerApiEndpoint(apiObject: IApiObject): void {
    if (this.instanceStatusTopic !== "") {
      const fullTopic = `${apiObject.topic}${apiObject.attribute}`;
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
          apiSwaggerEndpoint: apiObject.apiSwaggerEndpoint
        });
        this.emitProducedApiEndpoints();
        logger.info(`${this.instanceNameWithSuffix} - Registered new api endpoint: /${fullTopic}`);
      }
    }
  }

  protected unregisterApiEndpoint(topic: string, attribute: string): void {
    const fullTopic = `${topic}${attribute}`;
    if (this.producedApiEndpoints.has(fullTopic)) {
      this.producedApiEndpoints.delete(fullTopic);
      this.emitProducedApiEndpoints();
      logger.info(`${this.instanceNameWithSuffix} - Unregistered API endpoint: ${fullTopic}`);
    }
  }
  public async stop() {
    // Clear the publishing interval.
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }

  }

}
