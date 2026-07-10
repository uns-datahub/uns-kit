# Schema System Metadata

`@uns-kit/core` producers can attach schema-system metadata to published
attributes. The metadata is published in the produced-topics registry and the
UNS DataHub controller stores it in `attribute_schema.schema_json`.

## Relationship Evidence

Use `systemRole: "relationship-evidence"` when a scalar attribute value points
to another `ObjectId`. This example says that the owner object is the target and
the attribute value is the source.

```ts
await uns.publishMqttMessage({
  topic: "factory/rolling/",
  asset: "mill-1",
  objectType: "material",
  objectId: "1124",
  attributes: {
    attribute: "previous-material",
    description: "Previous material ObjectId before this process stage.",
    data: {
      time: new Date().toISOString() as ISO8601,
      value: "112",
    },
    valueType: "string",
    systemRole: "relationship-evidence",
    relationshipEvidence: {
      relationshipKey: "material-renumbering",
      ownerEndpoint: "target",
      valueEndpoint: "source",
      sourceObjectType: "material",
      targetObjectType: "material",
    },
  },
});
await uns.flush();
```

After the controller has this schema metadata, a runtime or operator action can
materialize the scalar value into an `object_id_relationship` edge.

## Lifecycle Timing

Use lifecycle roles when an attribute defines the local process interval for an
object occurrence.

```ts
await uns.publishMqttMessage({
  topic: "factory/furnace/",
  asset: "furnace-1",
  objectType: "material",
  objectId: "1124",
  attributes: {
    attribute: "process-state",
    description: "Material state in furnace.",
    data: {
      time: new Date().toISOString() as ISO8601,
      value: "processing",
    },
    valueType: "string",
    systemRole: "lifecycle-time-source",
    lifecycle: {
      timestampFrom: "packetTimestamp",
      startValues: ["entered", "processing"],
      endValues: ["done", "exited"],
    },
  },
});
await uns.flush();
```
