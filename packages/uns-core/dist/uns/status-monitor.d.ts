import type MqttProxy from "../uns-mqtt/mqtt-proxy.js";
export declare class StatusMonitor {
    private mqttProxy;
    private processStatusTopic;
    private activeSupplier;
    private memoryIntervalMs;
    private statusIntervalMs;
    private processIdentity?;
    private memoryInterval?;
    private statusInterval?;
    /**
     * @param mqttProxy The MQTT proxy used to publish messages.
     * @param processStatusTopic The base topic for the process (ending with a slash).
     * @param activeSupplier A function returning the current active state (boolean).
     * @param memoryIntervalMs Interval in milliseconds for publishing memory status.
     * @param statusIntervalMs Interval in milliseconds for publishing active status.
     * @param processIdentity Optional identity to attach to active status messages.
     */
    constructor(mqttProxy: MqttProxy, processStatusTopic: string, activeSupplier: () => boolean, memoryIntervalMs: number, statusIntervalMs: number, processIdentity?: {
        processName: string;
        processId: string;
    });
    /**
     * Starts the periodic memory and status updates.
     */
    start(): void;
    /**
     * Stops the periodic updates.
     */
    stop(): void;
    /**
     * Publishes memory usage updates via MQTT.
     * In this example, only the `heapUsed` metric is published.
     */
    private publishMemoryUpdates;
    /**
     * Publishes the process active status via MQTT.
     */
    private publishStatusUpdates;
}
//# sourceMappingURL=status-monitor.d.ts.map