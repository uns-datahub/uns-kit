/**
 * Change this file according to your specifications and rename it to index.ts
 */

import { UnsProxyProcess, ConfigFile, logger, type IUnsMessage } from "@uns-kit/core";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import { UnsTags } from "@uns-kit/core/uns/uns-tags.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Load and configure input and output brokers from config.json
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {processName: config.uns.processName!});
const mqttInput = await unsProxyProcess.createUnsMqttProxy((config.input?.host)!, "templateUnsRttInput", config.uns.instanceMode!, config.uns.handover!, {
  mqttSubToTopics: ["integration/raw-table"],
  publishThrottlingDelay:0,
  subscribeThrottlingDelay:0
});
const mqttOutput = await unsProxyProcess.createUnsMqttProxy((config.output?.host)!, "templateUnsRttOutput", config.uns.instanceMode!, config.uns.handover!, {
  publishThrottlingDelay:0,
  subscribeThrottlingDelay:0  
});

/**
 * The input worker connects to the upstream broker and listens for incoming messages.
 * It processes the messages and transforms them into a table-type IUnsMessage.
 * The resulting message is published to the output broker.
 */
mqttInput.event.on("input", async (event) => {
  try {
    if (event.topic === "integration/raw-table") {
      const jsonObject = JSON.parse(event.message);
      const timestamp = jsonObject.Timestamp;
      delete(jsonObject.Timestamp);

      const time = UnsPacket.formatToISO8601(new Date(timestamp));
      const message: IUnsMessage = { table: {dataGroup:"demo_table", values:jsonObject, time}};
      const topic: UnsTopics = "example/factory-a/line-1/";
      const tags: UnsTags[] = [];
      const packet = await UnsPacket.unsPacketFromUnsMessage(message);
      mqttOutput.publishMqttMessage({ topic, attribute: "table-sample", packet, description: "Table", tags });
    }
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error publishing message to MQTT: ${reason.message}`);
    throw reason;
  }
});
