import { IApiObject, ITopicObject, UnsEvents } from "./uns-interfaces.js";
import { UnsEventEmitter } from "./uns-event-emitter.js";
export default class UnsProxy {
    private publishInterval;
    event: UnsEventEmitter<UnsEvents>;
    protected instanceStatusTopic: string;
    protected instanceNameWithSuffix: string;
    private producedTopics;
    private producedApiEndpoints;
    constructor();
    /**
     * Publishes the list of produced topics to the MQTT broker.
     */
    private emitProducedTopics;
    /**
     * Publishes the list of produced API endpoints to the MQTT broker.
     */
    private emitProducedApiEndpoints;
    /**
     * Registers a unique topic so that it is tracked and published only once.
     *
     * @param topicObject - The object containing topic details.
     */
    protected registerUniqueTopic(topicObject: ITopicObject): void;
    /**
     * Registers an API endpoint to handle requests for a specific topic and attribute.
     */
    protected registerApiEndpoint(apiObject: IApiObject): void;
    protected unregisterApiEndpoint(topic: string, attribute: string): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=uns-proxy.d.ts.map