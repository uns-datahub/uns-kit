import { IMqttMessage, IUnsPacket, IUnsParameters, UnsEvents } from "../uns/uns-interfaces.js";
import UnsProxy from "../uns/uns-proxy.js";
export declare enum MessageMode {
    Raw = "raw",// Send only the original message
    Delta = "delta",// Send only the delta message
    Both = "both"
}
export default class UnsMqttProxy extends UnsProxy {
    private lastValues;
    private worker;
    private pendingEnqueues;
    private unsParameters;
    protected processStatusTopic: string;
    instanceName: string;
    private currentSequenceId;
    private topicBuilder;
    constructor(mqttHost: string, processName: string, instanceName: string, unsParameters?: IUnsParameters, publisherActive?: boolean, subscriberActive?: boolean);
    /**
     * Resolve object identity from explicit fields or the tail of the topic path.
     * Falls back to parsing when not provided for backward compatibility.
     */
    private resolveObjectIdentity;
    /**
     * Ensure the topic ends with a trailing slash for attribute concatenation.
     */
    private normalizeTopicWithObject;
    /**
     * Starts a worker thread to process the throttled publish queue.
     */
    private startQueueWorker;
    /**
     * Enqueues a message to the worker queue.
     *
     * @param topic - The topic to which the message belongs.
     * @param message - The message to be enqueued.
     * @param options - Optional publish options.
     * @returns A promise that resolves when the message is successfully enqueued.
     */
    private enqueueMessageToWorkerQueue;
    /**
     * Sets the publisher active state.
     *
     * @param batchSize - Optional batch size.
     * @param referenceHash - Optional reference hash.
     */
    setPublisherActive(batchSize?: number, referenceHash?: string): void;
    /**
     * Sets the publisher to passive mode.
     * @returns A promise that resolves when the publisher is set to passive.
     */
    setPublisherPassive(): Promise<UnsEvents["mqttWorker"]>;
    /**
     * Sets the subscriber active state.
     *
     * @param batchSize - Optional batch size.
     * @param referenceHash - Optional reference hash.
     */
    setSubscriberActive(batchSize?: number, referenceHash?: string): void;
    /**
     * Sets the subscriber to passive mode.
     * @returns A promise that resolves when the subscriber is set to passive.
     */
    setSubscriberPassive(): Promise<UnsEvents["mqttWorker"]>;
    /**
     * Sets the subscriber to passive mode and allows the publisher to run
     * until the queue is empty (all messages are processed).
     */
    setSubscriberPassiveAndDrainQueue(): Promise<UnsEvents["mqttWorker"]>;
    /**
     * Processes and publishes MQTT messages based on the selected message mode.
     *
     * @param mqttMessage - The MQTT message object.
     * @param mode - The message mode (Raw, Delta, or Both).
     */
    publishMqttMessage(mqttMessage: IMqttMessage | null, mode?: MessageMode): void;
    /**
     * Publishes a message to a specified topic.
     *
     * @param topic - The MQTT topic.
     * @param message - The message to publish.
     * @returns A promise that resolves when enqueued.
     */
    publishMessage(topic: string, message: string): Promise<void>;
    /**
     * Parses an MQTT packet from a JSON string.
     *
     * @param mqttPacket - The MQTT packet string.
     * @returns A parsed IUnsPacket object or null.
     */
    parseMqttPacket(mqttPacket: string): IUnsPacket | null;
    /**
     * Subscribes asynchronously to one or more topics.
     *
     * @param topics - A topic or list of topics.
     */
    subscribeAsync(topics: string | string[]): void;
    /**
     * Unsubscribes asynchronously from the given topics.
     *
     * @param topics - A list of topics.
     */
    unsubscribeAsync(topics: string[]): void;
    /**
     * Processes and enqueues a message to the worker queue, including handling
     * sequencing, value differences, and tracking of unique topics.
     *
     * @param msg - The MQTT message to process.
     * @param time - The timestamp.
     * @param valueIsCumulative - Whether the value is cumulative.
     */
    private processAndEnqueueMessage;
    /**
     * Stops the UnsProxy instance and cleans up resources.
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=uns-mqtt-proxy.d.ts.map