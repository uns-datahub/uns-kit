/**
 * Change this file according to your specifications and rename it to index.ts
 */

import UnsProxyProcess from "../uns/uns-proxy-process";
import { ConfigFile } from "../config-file";
import logger from "../logger";
import { IUnsMessage } from "../uns/uns-interfaces";
import { UnsPacket } from "../uns/uns-packet";
import { UnsTags } from "../uns/uns-tags";
import { UnsTopics } from "../uns/uns-topics";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Load and configure input and output brokers from config.json
 */
if (!config.infra?.host || !config.input?.host || !config.output?.host) {
  throw new Error("Missing required configuration in config.json");
}
const unsProxyProcess = new UnsProxyProcess(config.infra.host, {processName: config.uns.processName});
const mqttInput = await unsProxyProcess.createUnsMqttProxy(config.input.host, "templateUnsRttInput", config.uns.instanceMode, config.uns.handover, {
  mqttSubToTopics: ["iba/zrm"],
  publishThrottlingDelay:0,
  subscribeThrottlingDelay:0
});
const mqttOutput = await unsProxyProcess.createUnsMqttProxy(config.output.host, "templateUnsRttOutput", config.uns.instanceMode, config.uns.handover, {
  publishThrottlingDelay:0,
  subscribeThrottlingDelay:0  
});

/**
 * The input worker connects to the IBA broker and listens for incoming messages.
 * It processes the messages and transforms them into a table-type IUnsMessage.
 * The resulting message is published to the output broker.
 */
mqttInput.event.on("input", async (event) => {
  try {
    if (event.topic === "iba/zrm") {
      const jsonObject = JSON.parse(event.message);
      const timestamp = jsonObject.Timestamp;
      delete(jsonObject.Timestamp);

      const time = UnsPacket.formatToISO8601(new Date(timestamp));
      const message: IUnsMessage = { table: {dataGroup:"iba_test", values:jsonObject, time}};
      const topic: UnsTopics = "sij/acroni/hv/";
      const tags: UnsTags[] = [];
      const packet = await UnsPacket.unsPacketFromUnsMessage(message);
      mqttOutput.publishMqttMessage({ topic, attribute: "zrm", packet, description: "Table", tags });
    }
  } catch (error) {
    logger.error(`Error publishing message to MQTT: ${error.message}`);
  }
});
