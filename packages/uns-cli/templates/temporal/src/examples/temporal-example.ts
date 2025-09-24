/**
 * Change this file according to your specifications and rename it to index.ts
 */
import { UnsProxyProcess, ConfigFile, logger } from "@uns-kit/core";
import { ITemporalTopic } from "@uns-kit/temporal";
import { type UnsProxyProcessWithTemporal } from "@uns-kit/temporal";
import { UnsAttributeType } from "@uns-kit/core/graphql/schema.js";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Connect to the temporal and register uns topic for temporal
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {processName:config.uns.processName}) as UnsProxyProcessWithTemporal;
const temporalTopic: ITemporalTopic = {
  attribute: "temporal-data",
  topic: "sij/",
  attributeType: UnsAttributeType.Data,
  attributeNeedsPersistence: true,
  dataGroup: "temporal",
  description: "Temporal data example",
  tags: ["temporal"],
}
const temporalProxy = await unsProxyProcess.createTemporalProxy("templateUnsTemporal", "temporal-1.sij.digital:7233", "hv");
await temporalProxy.initializeTemporalProxy(temporalTopic);

// Start temporal workflow
const result = await temporalProxy.startWorkflow("TransformHvSclData", {'coil_id': "42"}, "ETL_HV_SCL_TASK_QUEUE");
logger.info(`Workflow result: ${JSON.stringify(result)}`);