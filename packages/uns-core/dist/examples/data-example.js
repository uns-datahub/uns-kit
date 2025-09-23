/**
 * Change this file according to your specifications and rename it to index.ts
 */
import UnsProxyProcess from "../uns/uns-proxy-process.js";
import { ConfigFile } from "../config-file.js";
import logger from "../logger.js";
import { PhysicalMeasurements } from "../uns/uns-measurements.js";
import { UnsPacket } from "../uns/uns-packet.js";
/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();
/**
 * Connect to input and output brokers
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host, { processName: config.uns.processName });
const mqttInput = await unsProxyProcess.createUnsMqttProxy((config.input?.host), "templateUnsRttInput", config.uns.instanceMode, config.uns.handover, {
    mqttSubToTopics: ["raw/#"],
});
const mqttOutput = await unsProxyProcess.createUnsMqttProxy((config.output?.host), "templateUnsRttOutput", config.uns.instanceMode, config.uns.handover, { publishThrottlingDelay: 1000 });
/**
 * Event listener for input events.
 * Transform an input message and publish it with publishMqttMessage function.
 */
mqttInput.event.on("input", async (event) => {
    try {
        if (event.topic === "raw/data") {
            const time = UnsPacket.formatToISO8601(new Date());
            const values = event.message.split(",");
            const numberValue = parseFloat(values[0]);
            const message = { data: { dataGroup: "electricity", time, value: numberValue, uom: PhysicalMeasurements.MiliVolt } };
            const topic = "sij/";
            const tags = [];
            const packet = await UnsPacket.unsPacketFromUnsMessage(message);
            mqttOutput.publishMqttMessage({ topic, attribute: "data-number", packet, description: "Number value", tags });
        }
    }
    catch (error) {
        const reason = error instanceof Error ? error : new Error(String(error));
        logger.error(`Error publishing message to MQTT: ${reason.message}`);
        throw reason;
    }
});
