import { IApiObject, ITopicObject, UnsEvents } from "./uns-interfaces.js";
import { UnsEventEmitter } from "./uns-event-emitter.js";
import { UnsAsset } from "./uns-asset.js";
import { UnsObjectId, UnsObjectType } from "./uns-object.js";
import { IApiCatchallMapping } from "./uns-interfaces.js";
export default class UnsProxy {
    private publishInterval;
    event: UnsEventEmitter<UnsEvents>;
    protected instanceStatusTopic: string;
    protected instanceNameWithSuffix: string;
    private producedTopics;
    private producedApiEndpoints;
    private producedApiCatchall;
    private readonly controllerNameEnv;
    private readonly controllerHostEnv;
    private readonly controllerPortEnv;
    private readonly controllerPublicBaseEnv;
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
     * Publishes the list of catch-all API mappings to the MQTT broker.
     */
    private emitProducedApiCatchall;
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
    protected registerUniqueTopic(topicObject: ITopicObject): void;
    /**
     * Registers an API endpoint to handle requests for a specific topic and attribute.
     */
    protected registerApiEndpoint(apiObject: IApiObject): void;
    protected registerApiCatchAll(mapping: IApiCatchallMapping): void;
    protected unregisterApiEndpoint(topic: string, asset: UnsAsset, objectType: UnsObjectType, objectId: UnsObjectId, attribute: string): void;
    stop(): Promise<void>;
}
//# sourceMappingURL=uns-proxy.d.ts.map