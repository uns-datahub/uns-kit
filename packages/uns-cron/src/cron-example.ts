/**
 * Change this file according to your specifications and rename it to index.ts
 */
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import { ConfigFile } from "@uns-kit/core/config-file";
import logger from "@uns-kit/core/logger";
import { IUnsMessage, UnsEvents } from "@uns-kit/core/uns/uns-interfaces";
import { PhysicalMeasurements } from "@uns-kit/core/uns/uns-measurements";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet";
import { UnsTags } from "@uns-kit/core/uns/uns-tags";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics";
import unsCronPlugin, { type UnsProxyProcessWithCron } from "./uns-cron-plugin.js";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Connect to the output broker and create a crontab proxy
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host, {processName:config.uns.processName}) as UnsProxyProcessWithCron;
unsCronPlugin;
const mqttOutput = await unsProxyProcess.createUnsMqttProxy(config.output.host, "templateUnsRttOutput", config.uns.instanceMode, config.uns.handover, { publishThrottlingDelay: 1000});
const cronInput = await unsProxyProcess.createCrontabProxy("* * * * * *");

/**
 * Event listener for cron events.
 * On each cron event, publish a message to the MQTT output broker.
 */
cronInput.event.on("cronEvent", async (event: UnsEvents["cronEvent"]) => {
  try {
    const time = UnsPacket.formatToISO8601(new Date());
    const numberValue: number = 42;
    const message: IUnsMessage = { data: { time, value: numberValue, uom: PhysicalMeasurements.MiliVolt } };
    const topic: UnsTopics = "sij/";
    const tags: UnsTags[] = [];
    const packet = await UnsPacket.unsPacketFromUnsMessage(message);
    mqttOutput.publishMqttMessage({ topic, attribute: "data-number", packet, description: "Number value", tags });
  } catch (error) {
    logger.error(`Error publishing message to MQTT: ${error.message}`);
    throw error;
  }
});
