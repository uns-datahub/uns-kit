/**
 * Example: publish schema-system metadata for object relationships and lifecycle timing.
 *
 * This is producer metadata. The controller stores these fields in
 * attribute_schema.schema_json and can later materialize relationship evidence
 * into object_id_relationship edges.
 */
import { ConfigFile, UnsProxyProcess, getLogger } from "@uns-kit/core";
import { registerAttributeDescriptions, registerObjectTypeDescriptions } from "@uns-kit/core/uns/uns-dictionary-registry.js";
import type { ISO8601 } from "@uns-kit/core/uns/uns-interfaces.js";
import { UnsTopics } from "@uns-kit/core/uns/uns-topics.js";
import {
  GeneratedAttributeDescriptions,
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
  "templateSchemaMetadataOutput",
  config.uns.instanceMode!,
  config.uns.handover!,
  { publishThrottlingDelay: 1000 },
);

const now = new Date();
const time = now.toISOString() as ISO8601;
const topic: UnsTopics = "enterprise/site/area/line/";
const asset = resolveGeneratedAsset("asset");
const materialObjectType = GeneratedObjectTypes["material"];
const currentMaterialId = "1124";
const previousMaterialId = "112";
const mergedParentMaterialIds = ["1122", "1123"];

try {
  await mqttOutput.publishMqttMessage({
    topic,
    asset,
    assetDescription: "Example production line",
    objectType: materialObjectType,
    objectId: currentMaterialId,
    attributes: [
      {
        attribute: "previous-material",
        description: "Previous material ObjectId before this process stage.",
        valueType: "string",
        systemRole: "relationship-evidence",
        relationshipEvidence: {
          relationshipKey: "material-renumbering",
          ownerEndpoint: "target",
          valueEndpoint: "source",
          sourceObjectType: materialObjectType,
          targetObjectType: materialObjectType,
          sourceObjectIdFrom: "value",
          targetObjectIdFrom: "ownerObjectId",
          observedAtFrom: "packetTimestamp",
          defaultStatus: "suggested",
        },
        data: {
          dataGroup: "material-lineage",
          time,
          value: previousMaterialId,
        },
      },
      {
        attribute: "previous-materials",
        description: "Previous material ObjectIds that were joined into this material.",
        valueType: "array<string>",
        systemRole: "relationship-evidence",
        relationshipEvidence: {
          relationshipKey: "material-merge",
          ownerEndpoint: "target",
          valueEndpoint: "source",
          sourceObjectType: materialObjectType,
          targetObjectType: materialObjectType,
          sourceObjectIdFrom: "value[]",
          targetObjectIdFrom: "ownerObjectId",
          observedAtFrom: "packetTimestamp",
          defaultStatus: "suggested",
        },
        data: {
          dataGroup: "material-lineage",
          time,
          currentMaterialObjectId: currentMaterialId,
          operationId: "weld-1122-1123",
          value: mergedParentMaterialIds,
        },
      },
      {
        attribute: "process-state",
        description: "Material lifecycle state in this process stage.",
        valueType: "string",
        systemRole: "lifecycle-time-source",
        lifecycle: {
          timestampFrom: "packetTimestamp",
          startValues: ["entered", "processing"],
          endValues: ["done", "exited"],
        },
        validityMode: "lifecycle",
        lifecycleEndValue: "done",
        data: {
          dataGroup: "material-lifecycle",
          time,
          value: "processing",
        },
      },
    ],
  });

  logger.info(`Published schema-system metadata example for material ${currentMaterialId}.`);
} finally {
  await mqttOutput.flush();
  await mqttOutput.stop();
  await unsProxyProcess.shutdown();
}
