import { IClientPublishOptions } from "mqtt";
/**
 * Abstract base class that encapsulates common functionality for managing
 * a throttled in‑memory queue with an optional disk persistence.
 */
declare abstract class ThrottledQueue<T> {
    protected queue: T[];
    protected lastProcessedItems: T[];
    protected isProcessing: boolean;
    delay: number;
    protected persistToDisk: boolean;
    protected persistenceFilePath: string;
    protected previousLoggedSize: number;
    protected instanceName: string;
    protected active: boolean;
    private inactiveLogSent;
    constructor(delay: number, persistToDisk: boolean, instanceName: string);
    /**
     * Process the queue items one at a time with a delay between each.
     */
    protected processQueue(): Promise<void>;
    /**
     * Log changes to the queue size at significant thresholds.
     */
    protected logQueueSize(): void;
    /**
     * Save the current queue to disk.
     */
    protected saveQueueToDisk(): void;
    /**
     * Load the queue from disk.
     */
    protected loadQueueFromDisk(): void;
    /**
     * Process a single queue item.
     */
    protected abstract processItem(item: T): Promise<void>;
    /**
     * Serialize a queue item for persistence.
     */
    protected abstract serializeItem(item: T): any;
    /**
     * Deserialize persisted data into a queue item.
     */
    protected abstract deserializeItem(data: any): T;
}
/**
 * Interface representing a queued publish item.
 */
interface PublisherQueueItem {
    topic: string;
    message: string;
    id: string;
    options?: IClientPublishOptions;
    resolve: () => void;
    reject: (err: any) => void;
}
/**
 * ThrottledPublisher: manages a queue of outgoing publish requests,
 * sending one message at a time using a provided publish function.
 */
export declare class ThrottledPublisher extends ThrottledQueue<PublisherQueueItem> {
    private publishFunction;
    /**
     * @param delay Delay between messages in milliseconds.
     * @param publishFunction Function to perform the actual publish.
     * @param persistToDisk Whether to persist the queue to disk.
     * @param persistenceFilePath File path for queue persistence.
     * @param instanceName Unique instance name for logging.
     */
    constructor(delay: number, publishFunction: (topic: string, message: string, id: string, options?: IClientPublishOptions) => Promise<void>, persistToDisk: boolean, persistenceFilePath: string, instanceName: string, active: boolean);
    /**
     * Enqueue a publish request.
     */
    enqueue(topic: string, message: string, id: string, options?: IClientPublishOptions): Promise<void>;
    private computeHashForBatch;
    /**
     * Switch the publisher to a passive state and return a snapshot
     */
    becomeActive(snapshot: {
        referenceHash: string;
        batchSize: number;
    }): void;
    /**
     * Switch the publisher to a passive state and return a snapshot
     */
    becomePassive(n: number): Promise<{
        referenceHash: string;
        batchSize: number;
    }>;
    getState(): boolean;
    /**
     * Process a single publish request.
     */
    protected processItem(item: PublisherQueueItem): Promise<void>;
    /**
     * Serialize a publish request for persistence.
     */
    protected serializeItem(item: PublisherQueueItem): any;
    /**
     * Deserialize persisted data into a publish request.
     */
    protected deserializeItem(data: any): PublisherQueueItem;
}
/**
 * Interface representing a queued subscribe item.
 */
interface SubscriberQueueItem {
    topic: string;
    message: string;
    timestamp: number;
}
/**
 * ThrottledSubscriber: manages a queue of incoming messages and processes
 * them one at a time using a provided message handler.
 */
export declare class ThrottledSubscriber extends ThrottledQueue<SubscriberQueueItem> {
    private messageHandler;
    /**
     * @param delay Delay between processing messages in milliseconds.
     * @param messageHandler Function to process incoming messages.
     * @param persistToDisk Whether to persist the queue to disk.
     * @param persistenceFilePath File path for queue persistence.
     * @param instanceName Unique instance name for logging.
     */
    constructor(delay: number, messageHandler: (topic: string, message: string) => Promise<void>, persistToDisk: boolean, persistenceFilePath: string, instanceName: string, active: boolean);
    /**
     * Enqueue subscribe messages for processing.
     */
    enqueue(topic: string, message: string): void;
    /**
     * Process a single subscribe message.
     */
    protected processItem(item: SubscriberQueueItem): Promise<void>;
    /**
     * Serialize a subscribe message for persistence.
     */
    protected serializeItem(item: SubscriberQueueItem): any;
    /**
     * Deserialize persisted data into a subscribe message.
     */
    protected deserializeItem(data: any): SubscriberQueueItem;
    /**
     * Get the current state of the subscriber (active or passive).
     */
    getState(): boolean;
    /**
     * Computes a SHA‑256 hash for a given batch of subscriber items.
     */
    private computeHashForBatch;
    /**
     * Switch the subscriber to a passive state and return a snapshot.
     */
    becomePassive(n: number): Promise<{
        referenceHash: string;
        batchSize: number;
    }>;
    /**
     * Switch the subscriber to an active state and resume processing.
     */
    becomeActive(snapshot: {
        referenceHash: string;
        batchSize: number;
    }): void;
}
export {};
