/**
 * Change this file according to your specifications and rename it to index.ts
 */
import { UnsProxyProcess, ConfigFile, logger } from "@uns-kit/core";
import type { IUnsMessage, UnsEvents } from "@uns-kit/core";
import "@uns-kit/cron";
import { type UnsProxyProcessWithCron } from "@uns-kit/cron.js";
import { UnsTags } from "../uns/uns-tags.js";
import { UnsTopics } from "../uns/uns-topics.js";
import { PhysicalMeasurements } from "@uns-kit/core/uns/uns-measurements.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import { ObjectTypes } from "@uns-kit/core/uns/uns-object.js";
import { EquipmentAttributes } from "@uns-kit/core/uns/uns-attributes.js";


/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Connect to the output broker and create a crontab proxy
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {processName:config.uns.processName}) as UnsProxyProcessWithCron;;
const mqttOutput = await unsProxyProcess.createUnsMqttProxy((config.output?.host)!, "templateUnsRttOutput", config.uns.instanceMode, config.uns.handover, { publishThrottlingDelay: 1000});
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
    const topic: UnsTopics = "example/";
    const objectType = ObjectTypes.Equipment;
    const objectId = "main";
    const tags: UnsTags[] = [];
    const packet = await UnsPacket.unsPacketFromUnsMessage(message);
    mqttOutput.publishMqttMessage({
      topic,
      attribute: EquipmentAttributes.MeasuredTemperature,
      packet,
      description: "Number value",
      objectType,
      objectId,
      tags
    });
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error publishing message to MQTT: ${reason.message}`);
    throw error;
  }
});
