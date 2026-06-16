import { describe, expect, it } from "vitest";
import { UnsAttributeType } from "../packages/uns-core/src/graphql/schema.ts";
import UnsProxy from "../packages/uns-core/src/uns/uns-proxy.ts";
import type { ITopicObject, UnsEvents } from "../packages/uns-core/src/uns/uns-interfaces.ts";

class TestUnsProxy extends UnsProxy {
  constructor() {
    super();
    this.instanceStatusTopic = "uns-infra/test/1/process/instance/";
    this.instanceNameWithSuffix = "test-instance";
  }

  register(topic: ITopicObject): void {
    this.registerUniqueTopic(topic);
  }
}

describe("UNS produced topic metadata", () => {
  it("publishes counter metadata into the produced topics registry", () => {
    const proxy = new TestUnsProxy();
    let event: UnsEvents["unsProxyProducedTopics"] | null = null;
    proxy.event.on("unsProxyProducedTopics", value => {
      event = value;
    });

    proxy.register({
      timestamp: "2026-06-02T12:00:00.000Z",
      topic: "plant/line/",
      asset: "meter-1",
      objectType: "energy-resource",
      objectId: "main",
      attribute: "active-energy-total",
      attributeType: UnsAttributeType.Data,
      description: "Active energy cumulative total",
      tags: null,
      attributeNeedsPersistence: true,
      dataGroup: "metering",
      valueType: "number",
      presentationKind: "counter",
      defaultAggregation: "last",
      counterResetPolicy: "new-value",
      systemRole: "relationship-evidence",
      relationshipEvidence: {
        relationshipKey: "material-renumbering",
        ownerEndpoint: "target",
        valueEndpoint: "source",
        sourceObjectType: "material",
        targetObjectType: "material",
      },
      lifecycle: {
        timestampFrom: "packetTimestamp",
      },
      tableColumns: [
        {
          name: "active_energy_total",
          valueType: "number",
          presentationKind: "counter",
          defaultAggregation: "last",
          counterResetPolicy: "new-value",
        },
      ],
    });

    expect(event?.producedTopics).toHaveLength(1);
    expect(event?.producedTopics[0]).toMatchObject({
      valueType: "number",
      presentationKind: "counter",
      defaultAggregation: "last",
      counterResetPolicy: "new-value",
      systemRole: "relationship-evidence",
      relationshipEvidence: {
        relationshipKey: "material-renumbering",
        ownerEndpoint: "target",
        valueEndpoint: "source",
        sourceObjectType: "material",
        targetObjectType: "material",
      },
      lifecycle: {
        timestampFrom: "packetTimestamp",
      },
      tableColumns: [
        {
          name: "active_energy_total",
          valueType: "number",
          presentationKind: "counter",
          defaultAggregation: "last",
          counterResetPolicy: "new-value",
        },
      ],
    });
  });

  it("keeps virtual grouping separate from storage dataGroup", () => {
    const proxy = new TestUnsProxy();
    let event: UnsEvents["unsProxyProducedTopics"] | null = null;
    proxy.event.on("unsProxyProducedTopics", value => {
      event = value;
    });

    proxy.register({
      timestamp: "2026-06-16T08:00:00.000Z",
      topic: "sij/acroni/vv/",
      asset: "hrm-stand-1",
      objectType: "material",
      objectId: "slab-001",
      attribute: "location",
      attributeType: UnsAttributeType.Data,
      description: "Material location",
      tags: null,
      attributeNeedsPersistence: true,
      dataGroup: "asset",
      virtualGroup: "material",
    });

    expect(event?.producedTopics).toHaveLength(1);
    expect(event?.producedTopics[0]).toMatchObject({
      dataGroup: "asset",
      virtualGroup: "material",
      objectType: "material",
      objectId: "slab-001",
    });
  });
});
