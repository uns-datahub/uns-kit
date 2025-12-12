/**
 * Change this file according to your specifications and rename it to index.ts
 */
import { UnsProxyProcess, ConfigFile, logger, type IUnsMessage, UnsAttribute } from "@uns-kit/core";
import { PhysicalMeasurements } from "@uns-kit/core/uns/uns-measurements.js";
import { UnsPacket } from "@uns-kit/core/uns/uns-packet.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import { ObjectTypes } from "@uns-kit/core/uns/uns-object.js";
import { EnergyResourceAttributes } from "@uns-kit/core/uns/uns-attributes.js";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Connect to input and output brokers
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {processName: config.uns.processName!});
const mqttInput = await unsProxyProcess.createUnsMqttProxy((config.input?.host)!, "templateUnsRttInput", config.uns.instanceMode!, config.uns.handover!, {
  mqttSubToTopics: ["raw/#"],
});
const mqttOutput = await unsProxyProcess.createUnsMqttProxy((config.output?.host)!, "templateUnsRttOutput", config.uns.instanceMode!, config.uns.handover!, { publishThrottlingDelay: 1000});


/**
 * Event listener for input events.
 * Transform an input message and publish it with publishMqttMessage function.
 */
mqttInput.event.on("input", async (event) => {
  try {
    if (event.topic === "raw/data") {
      const values = event.message.split(",");
      const [countRaw, timestampRaw, sensorRaw] = values;
      if (!countRaw || !timestampRaw || !sensorRaw) {
        logger.warn(`Skipping malformed raw/data payload: ${event.message}`);
        return;
      }
      const numberValue = Number.parseFloat(countRaw);
      const eventDate = new Date(Number.parseInt(timestampRaw, 10));
      const sensorValue = Number.parseFloat(sensorRaw);
      const time = UnsPacket.formatToISO8601(eventDate);

      const dataGroup = "sensor";

      const message: IUnsMessage = {
        data: { dataGroup, time, value: numberValue, uom: PhysicalMeasurements.None },
      };
      const topic: UnsTopics = "enterprise/site/area/line/";
      const currentPacket = await UnsPacket.unsPacketFromUnsMessage(message);
      mqttOutput.publishMqttMessage({
        topic,
        asset:"asset",
        objectType: ObjectTypes.EnergyResource,
        objectId: "main",
        attribute: EnergyResourceAttributes.Current,
        description: "Simulated current sensor value",
        tags: [],
        packet: currentPacket
      });

      const sensorMessage: IUnsMessage = {
        data: { dataGroup, time, value: sensorValue, uom: PhysicalMeasurements.Celsius },
      };
      const sensorPacket = await UnsPacket.unsPacketFromUnsMessage(sensorMessage);
      mqttOutput.publishMqttMessage({
        topic,
        asset:"asset",
        objectType: ObjectTypes.EnergyResource,
        objectId: "main",
        attribute: EnergyResourceAttributes.Voltage,
        description: "Simulated voltage sensor value",
        tags: [],
        packet: sensorPacket
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error publishing message to MQTT: ${reason.message}`);
    throw reason;
  }
});
