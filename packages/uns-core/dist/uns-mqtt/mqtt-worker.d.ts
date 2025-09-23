import { IMqttWorkerData } from "./mqtt-interfaces";
import { ThrottledPublisher, ThrottledSubscriber } from "./throttled-queue";
export declare class MqttWorker {
    private mqttProxy;
    protected publisher: ThrottledPublisher;
    protected subscriber: ThrottledSubscriber;
    constructor(workerData: IMqttWorkerData);
    /**
     * Listen for incoming messages from the main thread and process them.
     */
    private initializeMessageListener;
    /**
     * Get the state of the publisher.
     */
    getPublisherState(): boolean;
    /**
     * Get the state of the subscriber.
     */
    getSubscriberState(): boolean;
}
