/**
 * Change this file according to your specifications and rename it to index.ts
 */
import { UnsProxyProcess, ConfigFile, logger, UnsEvents } from "@uns-kit/core";
import { registerAttributeDescriptions, registerObjectTypeDescriptions } from "@uns-kit/core/uns/uns-dictionary-registry.js";
import "@uns-kit/cron";
import { type UnsProxyProcessWithCron } from "@uns-kit/cron";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import {
  GeneratedObjectTypes,
  GeneratedAttributes,
  GeneratedAttributesByType,
  GeneratedAttributeDescriptions,
  GeneratedObjectTypeDescriptions,
} from "./uns/uns-dictionary.generated.js";
import { GeneratedPhysicalMeasurements } from "./uns/uns-measurements.generated.js";


/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();
registerObjectTypeDescriptions(GeneratedObjectTypeDescriptions);
registerAttributeDescriptions(GeneratedAttributeDescriptions);

/**
 * Connect to the output broker and create a crontab proxy
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {processName:config.uns.processName}) as UnsProxyProcessWithCron;;
const mqttOutput = await unsProxyProcess.createUnsMqttProxy((config.output?.host)!, "templateUnsRttOutput", config.uns.instanceMode!, config.uns.handover!, { publishThrottlingDelay: 1000});
const cronInput = await unsProxyProcess.createCrontabProxy("* * * * * *");

/**
 * Event listener for cron events.
 * On each cron event, publish a message to the MQTT output broker.
 */
cronInput.event.on("cronEvent", async (event: UnsEvents["cronEvent"]) => {
  try {
    const time = UnsPacket.formatToISO8601(new Date());
    const numberValue: number = 42;
    const topic: UnsTopics = "example/";
    const asset = "asset";
    const assetDescription = "Sample asset";

    const dataGroup = "sensor";

    mqttOutput.publishMqttMessage({
      topic,
      asset,
      assetDescription,
      objectType: GeneratedObjectTypes.equipment,
      objectId: "main",
      attributes: [
        {
          attribute: GeneratedAttributesByType["energy-resource"]["current"],
          data: { dataGroup, time, value: numberValue, uom: GeneratedPhysicalMeasurements.Ampere }
        }
      ],
    });
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error publishing message to MQTT: ${reason.message}`);
    throw error;
  }
});
