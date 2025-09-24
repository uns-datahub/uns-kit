/**
 * Change this file according to your specifications and rename it to index.ts
 */
import { UnsProxyProcess, ConfigFile, logger, type IUnsMessage } from "@uns-kit/core";
import { UnsAttributeType } from "../graphql/schema.js";
import { ITemporalTopic } from "@uns-kit/t;

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Connect to the temporal and register uns topic for temporal
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host, {processName:config.uns.processName});
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