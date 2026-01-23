import { UnsAttribute } from "@uns-kit/core/uns/uns-interfaces.js";
import UnsProxy from "@uns-kit/core/uns/uns-proxy.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import { IApiProxyOptions, IGetEndpointOptions } from "@uns-kit/core/uns/uns-interfaces.js";
import { UnsAsset } from "@uns-kit/core/uns/uns-asset.js";
import { UnsObjectType, UnsObjectId } from "@uns-kit/core/uns/uns-object.js";
export default class UnsApiProxy extends UnsProxy {
    instanceName: string;
    private topicBuilder;
    private processName;
    protected processStatusTopic: string;
    private app;
    private options;
    private jwksCache?;
    private catchAllRouteRegistered;
    private startedAt;
    constructor(processName: string, instanceName: string, options: IApiProxyOptions);
    /**
     * Unregister endpoint
     * @param topic - The API topic
     * @param attribute - The attribute for the topic.
     * @param method - The HTTP method (e.g., "GET", "POST", "PUT", "DELETE").
     */
    unregister(topic: UnsTopics, asset: UnsAsset, objectType: UnsObjectType, objectId: UnsObjectId, attribute: UnsAttribute, method: "GET" | "POST" | "PUT" | "DELETE"): Promise<void>;
    /**
     * Register a GET endpoint with optional JWT path filter.
     * @param topic - The API topic
     * @param attribute - The attribute for the topic.
     * @param options.description - Optional description.
     * @param options.tags - Optional tags.
     */
    get(topic: UnsTopics, asset: UnsAsset, objectType: UnsObjectType, objectId: UnsObjectId, attribute: UnsAttribute, options?: IGetEndpointOptions): Promise<void>;
    /**
     * Register a catch-all API mapping for a topic prefix (e.g., "sij/acroni/#").
     * Does not create individual API attribute nodes; the controller treats this as a fallback.
     */
    registerCatchAll(topicPrefix: string, options?: {
        apiBase?: string;
        apiBasePath?: string;
        swaggerPath?: string;
        swaggerDoc?: Record<string, unknown>;
        apiDescription?: string;
        tags?: string[];
        queryParams?: IGetEndpointOptions["queryParams"];
    }): Promise<void>;
    post(..._args: any[]): any;
    private registerHealthEndpoint;
    private extractBearerToken;
    private getPublicKeyFromJwks;
    private fetchJwksKeys;
    private certFromX5c;
}
