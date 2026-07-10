/**
 * Example: publish a sub-asset under an existing parent asset.
 *
 * V1 sub-assets use the normal UNS publish fields:
 * - topic is the full parent asset path
 * - asset is only the leaf sub-asset name
 */
import { ConfigFile, UnsProxyProcess, getLogger } from "@uns-kit/core";
import { registerAttributeDescriptions, registerObjectTypeDescriptions } from "@uns-kit/core/uns/uns-dictionary-registry.js";
import type { ISO8601 } from "@uns-kit/core/uns/uns-interfaces.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import { GeneratedPhysicalMeasurements } from "../uns/uns-measurements.generated.js";
import {
  GeneratedAttributeDescriptions,
  GeneratedAttributesByType,
  GeneratedObjectTypeDescriptions,
  GeneratedObjectTypes,
} from "../uns/uns-dictionary.generated.js";
import { resolveGeneratedAsset } from "../uns/uns-assets.js";

const logger = getLogger(import.meta.url);

const config = await ConfigFile.loadConfig();
registerObjectTypeDescriptions(GeneratedObjectTypeDescriptions);
registerAttributeDescriptions(GeneratedAttributeDescriptions);

const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {
  processName: config.uns.processName!,
});

const mqttOutput = await unsProxyProcess.createUnsMqttProxy(
  config.output?.host!,
  "templateSubassetExampleOutput",
  config.uns.instanceMode!,
  config.uns.handover!,
  { publishThrottlingDelay: 1000 },
);

try {
  const parentAssetTopic: UnsTopics = "enterprise/site/area/line-1/";
  const subAsset = resolveGeneratedAsset("pump-1");
  const now = new Date();
  const time = now.toISOString() as ISO8601;
  const intervalStart = new Date(now.getTime() - 1000).toISOString() as ISO8601;
  const intervalEnd = time;

  await mqttOutput.publishMqttMessage({
    topic: parentAssetTopic,
    asset: subAsset,
    assetDescription: "Example pump owned by a separate microservice",
    objectType: GeneratedObjectTypes["equipment"],
    objectId: "main",
    attributes: {
      attribute: GeneratedAttributesByType["equipment"]["temperature"],
      description: "Example sub-asset temperature",
      valueType: "number",
      presentationKind: "chart",
      defaultAggregation: "last",
      data: {
        time,
        value: 42,
        uom: GeneratedPhysicalMeasurements.Celsius,
        intervalStart,
        intervalEnd,
      },
    },
  });

  logger.info(
    "Published sub-asset example to " +
      `${parentAssetTopic}${subAsset}/equipment/main/temperature`,
  );
} finally {
  await mqttOutput.flush();
  await mqttOutput.stop();
  await unsProxyProcess.shutdown();
}
