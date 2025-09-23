// status-monitor.ts
import logger from "../logger";
import { DataSizeMeasurements } from "./uns-measurements";
import { UnsPacket } from "./uns-packet";
export class StatusMonitor {
    mqttProxy;
    processStatusTopic;
    activeSupplier;
    memoryIntervalMs;
    statusIntervalMs;
    memoryInterval;
    statusInterval;
    /**
     * @param mqttProxy The MQTT proxy used to publish messages.
     * @param processStatusTopic The base topic for the process (ending with a slash).
     * @param activeSupplier A function returning the current active state (boolean).
     * @param memoryIntervalMs Interval in milliseconds for publishing memory status.
     * @param statusIntervalMs Interval in milliseconds for publishing active status.
     */
    constructor(mqttProxy, processStatusTopic, activeSupplier, memoryIntervalMs, statusIntervalMs) {
        this.mqttProxy = mqttProxy;
        this.processStatusTopic = processStatusTopic;
        this.activeSupplier = activeSupplier;
        this.memoryIntervalMs = memoryIntervalMs;
        this.statusIntervalMs = statusIntervalMs;
    }
    /**
     * Starts the periodic memory and status updates.
     */
    start() {
        this.memoryInterval = setInterval(() => this.publishMemoryUpdates(), this.memoryIntervalMs);
        this.statusInterval = setInterval(() => this.publishStatusUpdates(), this.statusIntervalMs);
    }
    /**
     * Stops the periodic updates.
     */
    stop() {
        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
            this.memoryInterval = undefined;
        }
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = undefined;
        }
    }
    /**
     * Publishes memory usage updates via MQTT.
     * In this example, only the `heapUsed` metric is published.
     */
    async publishMemoryUpdates() {
        try {
            const time = UnsPacket.formatToISO8601(new Date());
            const memoryUsage = process.memoryUsage();
            const heapUsedMessage = { data: { time, value: Math.round(memoryUsage.heapUsed / 1048576), uom: DataSizeMeasurements.MegaByte } };
            let packet = await UnsPacket.unsPacketFromUnsMessage(heapUsedMessage);
            this.mqttProxy.publish(`${this.processStatusTopic}heap-used`, JSON.stringify(packet));
            const heapTotalMessage = { data: { time, value: Math.round(memoryUsage.heapTotal / 1048576), uom: DataSizeMeasurements.MegaByte } };
            packet = await UnsPacket.unsPacketFromUnsMessage(heapTotalMessage);
            this.mqttProxy.publish(`${this.processStatusTopic}heap-total`, JSON.stringify(packet));
        }
        catch (error) {
            logger.error(`StatusMonitor - Error publishing memory updates: ${error.message}`);
        }
    }
    /**
     * Publishes the process active status via MQTT.
     */
    async publishStatusUpdates() {
        try {
            const time = UnsPacket.formatToISO8601(new Date());
            const activeMessage = {
                data: { time, value: Number(this.activeSupplier()) },
            };
            const packet = await UnsPacket.unsPacketFromUnsMessage(activeMessage);
            this.mqttProxy.publish(`${this.processStatusTopic}active`, JSON.stringify(packet), { retain: false, });
        }
        catch (error) {
            logger.error(`StatusMonitor - Error publishing status updates: ${error.message}`);
        }
    }
}
