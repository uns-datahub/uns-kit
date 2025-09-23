import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { basePath } from "../base-path";
import logger from "../logger";
/**
 * Abstract base class that encapsulates common functionality for managing
 * a throttled in‑memory queue with an optional disk persistence.
 */
class ThrottledQueue {
    queue = [];
    lastProcessedItems = [];
    isProcessing = false;
    delay;
    persistToDisk;
    persistenceFilePath;
    previousLoggedSize = 0;
    instanceName;
    active = true;
    inactiveLogSent = false;
    constructor(delay, persistToDisk, instanceName) {
        this.delay = delay;
        this.persistToDisk = persistToDisk;
        this.instanceName = instanceName;
        if (this.persistToDisk) {
            this.loadQueueFromDisk();
        }
    }
    /**
     * Process the queue items one at a time with a delay between each.
     */
    async processQueue() {
        if (this.isProcessing)
            return;
        this.isProcessing = true;
        if (!this.active) {
            if (!this.inactiveLogSent) {
                logger.info(`${this.instanceName} - Queue is not active. Exiting processQueue.`);
                this.inactiveLogSent = true;
            }
            this.isProcessing = false;
            return;
        }
        // Reset the flag when processing actually starts.
        this.inactiveLogSent = false;
        while (this.queue.length > 0) {
            // Check if the queue is active
            if (!this.active) {
                logger.info(`${this.instanceName} - Queue processing paused.`);
                this.isProcessing = false;
                return; // Exit the loop and stop processing
            }
            const item = this.queue.shift();
            if (item) {
                try {
                    await this.processItem(item);
                    // Only store 10 last processed items
                    if (this.lastProcessedItems.length >= 10) {
                        this.lastProcessedItems.shift();
                    }
                    // Store the last processed item
                    this.lastProcessedItems.push(item);
                }
                catch (error) {
                    // Specific error handling can be done in the subclass if needed.
                    logger.error(`${this.instanceName} - Error processing item: ${error.message}`);
                }
                if (this.persistToDisk) {
                    this.saveQueueToDisk();
                }
                if (this.delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, this.delay));
                }
                this.logQueueSize();
            }
        }
        this.isProcessing = false;
    }
    /**
     * Log changes to the queue size at significant thresholds.
     */
    logQueueSize() {
        const className = `${this.constructor.name.includes("Publisher") ? "Publisher" : this.constructor.name.includes("Subscriber") ? "Subscriber" : "Unknown"}`;
        if (this.queue.length > 1
            && this.queue.length > this.previousLoggedSize
            && Math.floor(this.queue.length / 100) > Math.floor(this.previousLoggedSize / 100)) {
            logger.info(`${this.instanceName} - ${className} queue size length is ${this.queue.length}.`);
            this.previousLoggedSize = this.queue.length;
        }
        else if (this.queue.length === 0 && this.previousLoggedSize > 0) {
            logger.info(`${this.instanceName} - ${className} queue is empty.`);
            this.previousLoggedSize = 0;
        }
    }
    /**
     * Save the current queue to disk.
     */
    saveQueueToDisk() {
        try {
            const queueData = this.queue.map((item) => this.serializeItem(item));
            const dir = join(this.persistenceFilePath, "..");
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            writeFileSync(this.persistenceFilePath, JSON.stringify(queueData, null, 2));
            logger.debug(`${this.instanceName} - Queue saved to disk.`);
        }
        catch (error) {
            logger.error(`${this.instanceName} - Error saving queue to disk: ${error.message}`);
        }
    }
    /**
     * Load the queue from disk.
     */
    loadQueueFromDisk() {
        try {
            if (existsSync(this.persistenceFilePath)) {
                const queueData = JSON.parse(readFileSync(this.persistenceFilePath, "utf8"));
                this.queue = queueData.map((data) => this.deserializeItem(data));
                logger.info(`${this.instanceName} - Queue loaded from disk.`);
            }
        }
        catch (error) {
            logger.error(`${this.instanceName} - Error loading queue from disk: ${error.message}`);
        }
    }
}
/**
 * ThrottledPublisher: manages a queue of outgoing publish requests,
 * sending one message at a time using a provided publish function.
 */
export class ThrottledPublisher extends ThrottledQueue {
    publishFunction;
    /**
     * @param delay Delay between messages in milliseconds.
     * @param publishFunction Function to perform the actual publish.
     * @param persistToDisk Whether to persist the queue to disk.
     * @param persistenceFilePath File path for queue persistence.
     * @param instanceName Unique instance name for logging.
     */
    constructor(delay, publishFunction, persistToDisk = false, persistenceFilePath = join(basePath, "/publisherQueue/", "throttled-publisher-queue.json"), instanceName, active) {
        super(delay, persistToDisk, instanceName);
        this.persistenceFilePath = persistenceFilePath;
        this.publishFunction = publishFunction;
        this.active = active;
        if (active) {
            logger.info(`${this.instanceName} - Publisher is active.`);
        }
        else {
            logger.info(`${this.instanceName} - Publisher is passive.`);
        }
    }
    /**
     * Enqueue a publish request.
     */
    enqueue(topic, message, id, options) {
        return new Promise((resolve, reject) => {
            this.queue.push({ topic, message, id, options, resolve, reject });
            // Trigger logging after a new message is added.
            this.logQueueSize();
            if (this.persistToDisk) {
                this.saveQueueToDisk();
            }
            if (this.active) {
                this.processQueue();
            }
        });
    }
    computeHashForBatch(messages) {
        const data = JSON.stringify(messages);
        return createHash("sha256").update(data).digest("hex");
    }
    /**
     * Switch the publisher to a passive state and return a snapshot
     */
    becomeActive(snapshot) {
        // If snapshot is empty (batchSize is zero), start processing from the beginning.
        if (snapshot.batchSize === 0 || snapshot.batchSize === undefined || snapshot.referenceHash === undefined) {
            this.active = true;
            logger.info(`${this.instanceName} - Publisher became active.`);
            this.processQueue();
            return;
        }
        const { referenceHash, batchSize } = snapshot;
        let resumeIndex = -1;
        // Use batchSize as the window length.
        for (let i = 0; i <= this.queue.length - batchSize; i++) {
            const currentBatch = this.queue.slice(i, i + batchSize);
            const currentHash = this.computeHashForBatch(currentBatch);
            if (currentHash === referenceHash) {
                resumeIndex = i + batchSize; // resume immediately after the matched batch
                break;
            }
        }
        if (resumeIndex !== -1) {
            // Adjust the queue so that processing resumes after the matching batch.
            this.queue = this.queue.slice(resumeIndex);
            logger.info(`${this.instanceName} - Publisher resumed from the matched snapshot position.`);
        }
        else if (this.queue.length > 0) {
            // Log info message and process the entire queue if no match is found.
            logger.info(`${this.instanceName} - No matching batch found during resume; processing the entire publisher's queue.`);
        }
        this.active = true;
        logger.info(`${this.instanceName} - Publisher became active.`);
        this.processQueue();
    }
    /**
     * Switch the publisher to a passive state and return a snapshot
     */
    async becomePassive(n) {
        this.active = false;
        logger.info(`${this.instanceName} - Publisher became passive.`);
        const batch = this.queue.slice(-n);
        const batchSize = batch.length;
        const referenceHash = this.computeHashForBatch(batch);
        if (batchSize > 0) {
            logger.info(`${this.instanceName} - Publisher batch reference hash: ${referenceHash}, size: ${batchSize}`);
        }
        return { referenceHash, batchSize };
    }
    getState() {
        return this.active;
    }
    /**
     * Process a single publish request.
     */
    async processItem(item) {
        try {
            await this.publishFunction(item.topic, item.message, item.id, item.options);
            item.resolve();
        }
        catch (error) {
            item.reject(error);
        }
    }
    /**
     * Serialize a publish request for persistence.
     */
    serializeItem(item) {
        return {
            topic: item.topic,
            message: item.message,
            id: item.id,
            options: item.options,
        };
    }
    /**
     * Deserialize persisted data into a publish request.
     */
    deserializeItem(data) {
        return {
            topic: data.topic,
            message: data.message,
            id: data.id,
            options: data.options,
            resolve: () => { },
            reject: (err) => logger.error(`${this.instanceName} - Error processing queued publish item: ${err.message}`),
        };
    }
}
/**
 * ThrottledSubscriber: manages a queue of incoming messages and processes
 * them one at a time using a provided message handler.
 */
export class ThrottledSubscriber extends ThrottledQueue {
    messageHandler;
    /**
     * @param delay Delay between processing messages in milliseconds.
     * @param messageHandler Function to process incoming messages.
     * @param persistToDisk Whether to persist the queue to disk.
     * @param persistenceFilePath File path for queue persistence.
     * @param instanceName Unique instance name for logging.
     */
    constructor(delay, messageHandler, persistToDisk = false, persistenceFilePath = join(basePath, "/subscriberQueue/", "throttled-subscriber-queue.json"), instanceName, active) {
        super(delay, persistToDisk, instanceName);
        this.persistenceFilePath = persistenceFilePath;
        this.messageHandler = messageHandler;
        this.active = active;
        if (active) {
            logger.info(`${this.instanceName} - Subscriber is active.`);
        }
        else {
            logger.info(`${this.instanceName} - Subscriber is passive.`);
        }
    }
    /**
     * Enqueue subscribe messages for processing.
     */
    enqueue(topic, message) {
        this.queue.push({ topic, message, timestamp: Date.now() });
        // Trigger logging after a new message is added.
        this.logQueueSize();
        if (this.persistToDisk) {
            this.saveQueueToDisk();
        }
        if (this.active) {
            this.processQueue();
        }
    }
    /**
     * Process a single subscribe message.
     */
    async processItem(item) {
        await this.messageHandler(item.topic, item.message);
    }
    /**
     * Serialize a subscribe message for persistence.
     */
    serializeItem(item) {
        return {
            message: item.message,
        };
    }
    /**
     * Deserialize persisted data into a subscribe message.
     */
    deserializeItem(data) {
        return {
            topic: data.topic,
            message: data.message,
            timestamp: data.timestamp,
        };
    }
    /**
     * Get the current state of the subscriber (active or passive).
     */
    getState() {
        return this.active;
    }
    /**
     * Computes a SHA‑256 hash for a given batch of subscriber items.
     */
    computeHashForBatch(messages) {
        const data = JSON.stringify(messages.map((item) => this.serializeItem(item)));
        return createHash("sha256").update(data).digest("hex");
    }
    /**
     * Switch the subscriber to a passive state and return a snapshot.
     */
    async becomePassive(n) {
        this.active = false;
        logger.info(`${this.instanceName} - Subscriber is passive.`);
        const batch = this.lastProcessedItems.slice(-n);
        const batchSize = batch.length;
        const referenceHash = this.computeHashForBatch(batch);
        if (batchSize > 0) {
            logger.info(`${this.instanceName} - Subscriber batch reference hash: ${referenceHash}, size: ${batchSize}`);
        }
        return { referenceHash, batchSize };
    }
    /**
     * Switch the subscriber to an active state and resume processing.
     */
    becomeActive(snapshot) {
        // If snapshot is empty (batchSize is zero), start processing from the beginning.
        if (snapshot.batchSize === 0 || snapshot.batchSize === undefined || snapshot.referenceHash === undefined) {
            this.active = true;
            logger.info(`${this.instanceName} - Subscriber became active.`);
            this.processQueue();
            return;
        }
        const { referenceHash, batchSize } = snapshot;
        let resumeIndex = -1;
        // Use batchSize as the window length.
        for (let i = 0; i <= this.queue.length - batchSize; i++) {
            const currentBatch = this.queue.slice(i, i + batchSize);
            const currentHash = this.computeHashForBatch(currentBatch);
            if (currentHash === referenceHash) {
                resumeIndex = i + batchSize; // resume immediately after the matched batch
                break;
            }
        }
        if (resumeIndex !== -1) {
            // Adjust the queue so that processing resumes after the matching batch.
            const queueSlice = this.queue.slice(resumeIndex);
            this.queue = queueSlice;
            logger.info(`${this.instanceName} - Subscriber resumed from the matched snapshot position.`);
        }
        else if (this.queue.length > 0) {
            // Log info message and process the entire queue if no match is found.
            logger.info(`${this.instanceName} - No matching batch found during resume; processing the entire subscriber's queue.`);
        }
        this.active = true;
        logger.info(`${this.instanceName} - Subscriber became active.`);
        this.processQueue();
    }
}
