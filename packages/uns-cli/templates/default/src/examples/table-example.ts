/**
 * Change this file according to your specifications and rename it to index.ts
 */

import { UnsProxyProcess, ConfigFile, logger, type IUnsMessage } from "@uns-kit/core";
import { registerAttributeDescriptions, registerObjectTypeDescriptions } from "@uns-kit/core/uns/uns-dictionary-registry.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import {
  GeneratedObjectTypes,
  GeneratedAttributes,
  GeneratedAttributeDescriptions,
  GeneratedObjectTypeDescriptions,
} from "../uns/uns-dictionary.generated.js";
import type { IUnsTableColumn } from "@uns-kit/core/uns/uns-interfaces.js";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();
registerObjectTypeDescriptions(GeneratedObjectTypeDescriptions);
registerAttributeDescriptions(GeneratedAttributeDescriptions);

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
      const time = UnsPacket.formatToISO8601(new Date());
      const columns: IUnsTableColumn[] = [
        { name: "kolona_a", type: "int", value: 10 },
        { name: "kolona_b", type: "symbol", value: "1" },
        { name: "kolona_c", type: "varchar", value: "10" },
        { name: "kolona_d", type: "double", value: 3 },
      ];

      const message: IUnsMessage = { table: { dataGroup: "demo_table", columns, time } };
      const topic: UnsTopics = "enterprise/site/area/line/";
      const packet = await UnsPacket.unsPacketFromUnsMessage(message);
      mqttOutput.publishMqttMessage({
        topic,
        asset:"asset",
        objectType: GeneratedObjectTypes["resource-status"],
        objectId: "main",
        attribute: GeneratedAttributes["status"] ?? "status",
        description: GeneratedAttributeDescriptions["status"] ?? "Table",
        tags: [],
        packet,
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error publishing message to MQTT: ${reason.message}`);
    throw reason;
  }
});
