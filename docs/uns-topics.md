# UNS Topics Reference

This page documents the MQTT topics published by `@uns-kit/core` and the additional topics published by `@uns-kit/api`.

## Base topic format

Most core topics are published under the process namespace:

```
uns-infra/<packageName>/<version>/<processName>/
```

- `packageName` and `version` are read from the running app's `package.json`.
- `processName` is required in your config and is used in topics and logs.

Instance-specific topics append the instance name:

```
uns-infra/<packageName>/<version>/<processName>/<instanceName>/
```

`instanceName` is the label you pass when creating a proxy instance in code
(for example, `createUnsMqttProxy(..., "input")` or `createApiProxy(..., "api")`).
It lets a single process publish separate instance-level status and registries.

## Core process-level topics

These are emitted for each process (not per instance):

- `.../active`  
  Active status for the process; `data.value` is `1` (active) or `0` (inactive).  
  When available, `processName`/`processId` are included in MQTT user properties.
- `.../heap-used`  
  Heap used in MB; `data.value` is rounded to whole MB.
- `.../heap-total`  
  Heap total in MB; `data.value` is rounded to whole MB.
- `.../handover`  
  Handover control channel for `handover_request`, `handover_subscriber`, `handover_fin`, and `handover_ack` messages.

## Core instance-level topics

These are emitted for each instance:

- `.../<instanceName>/alive`  
  Heartbeat (bit) and LWT target.
- `.../<instanceName>/uptime`  
  Uptime in minutes.
- `.../<instanceName>/t-publisher-active`  
  Throttled publisher active flag (bit).
- `.../<instanceName>/t-subscriber-active`  
  Throttled subscriber active flag (bit).
- `.../<instanceName>/published-message-count`  
  Count of published messages since the last interval.
- `.../<instanceName>/published-message-bytes`  
  Published bytes in KB since the last interval.
- `.../<instanceName>/subscribed-message-count`  
  Count of subscribed messages since the last interval.
- `.../<instanceName>/subscribed-message-bytes`  
  Subscribed bytes in KB since the last interval.

## Produced topics registry (core)

Each UNS proxy instance periodically publishes the set of produced data topics:

```
uns-infra/<packageName>/<version>/<processName>/<instanceName>/topics
```

Payload: retained JSON array of `ITopicObject` entries.

Fields:

- `timestamp` - ISO time of first registration
- `topic` - base UNS topic (e.g. `enterprise/site/area/line/`)
- `asset`, `assetDescription`
- `objectType`, `objectTypeDescription`
- `objectId`
- `attribute`, `attributeType`
- `description`
- `tags`
- `attributeNeedsPersistence`
- `valueType`, `presentationKind`, `defaultAggregation`
- `counterResetPolicy`
- `systemRole`, `relationshipEvidence`, `lifecycle` - optional schema-system
  metadata for relationship materialization and lifecycle semantics
- `tableColumns` - optional field-level metadata for table columns that should
  behave as chartable series
- `dataGroup` - optional storage/routing group copied from the latest `data` or
  `table` payload for this UNS identity
- `virtualGroup` - optional controller/UI grouping hint for ObjectId nodes; it
  is metadata and does not request a separate history table

This list is built as your process publishes messages and is refreshed periodically.

### UNS identity, virtual grouping, and `dataGroup`

UNS identity and storage grouping are separate concepts.

The canonical UNS identity path is built from:

```
<topic>/<asset>/<objectType>/<objectId>/<attribute>
```

`objectType` and `objectId` describe the semantic object being measured or
reported. They are part of the UNS path and schema model. Changing `objectType`
does not, by itself, request a new physical history table from an archiver.

`dataGroup` is different. It is carried inside a `data` or `table` payload and is
mirrored into the produced-topics registry. It is not a path segment. Consumers
may use it as a storage/routing hint. The UNS archiver currently uses it when it
builds physical QuestDB table names:

```
<tablePrefix>_<dataGroup>_data
<tablePrefix>_<dataGroup>_table
```

If `dataGroup` is empty or omitted, the archiver writes to:

```
<tablePrefix>_data
<tablePrefix>_table
```

For example, with an archiver `tablePrefix` of `uns_automations`, a table packet
with `dataGroup: "capture"` is persisted to `uns_automations_capture_table`.
The UNS identity might still be `automations/pritiski/capture/a/records`; the
`capture` path segment there is the `objectType`, while the `capture` in the
QuestDB table name comes from `dataGroup`.

Capture-style output example:

```json
{
  "topic": "automations/",
  "asset": "pritiski",
  "objectType": "capture",
  "objectId": "a",
  "attributes": {
    "attribute": "records",
    "description": "Capture output rows.",
    "table": {
      "time": "2026-06-16T08:00:00.000Z",
      "dataGroup": "capture",
      "columns": [
        { "name": "p", "type": "double", "value": -5.8, "uom": "Pa" },
        { "name": "t", "type": "double", "value": 884.3, "uom": "degC" }
      ]
    }
  }
}
```

This publishes the UNS identity `automations/pritiski/capture/a/records`. With
`tablePrefix: "uns_automations"`, the archiver writes it to
`uns_automations_capture_table`. If the same packet used
`dataGroup: "capture_fast"`, the UNS identity would stay the same, but the
physical QuestDB table would become `uns_automations_capture_fast_table`.

`virtualGroup` is the separate controller/tree grouping concept. It is published
as metadata on `IMqttPublishRequest` or an individual `IMqttAttributeMessage` and
is mirrored into the produced-topics registry. It lets the controller group
ObjectId nodes visually without changing the UNS identity path and without
changing the archiver table name.

Treat UI virtual grouping as presentation/discovery metadata, not as a request
for a new physical table. If a producer needs a separate QuestDB storage family,
set `dataGroup` explicitly in the packet. If a UI only needs to group object IDs
visually, set `virtualGroup` rather than overloading `dataGroup`, because
`dataGroup` has storage consequences for archiver consumers.

Recommended usage:

- Use `objectType` for semantics, for example `equipment`, `material`,
  `capture`, or `trigger`.
- Use `dataGroup` only when data should be routed or persisted as a separate
  storage family, or when a consumer has an explicit policy for that group.
- Use `virtualGroup` when the controller/tree should group ObjectIds under a
  virtual folder without affecting storage. Request-level `virtualGroup` applies
  to all attributes in the request; attribute-level `virtualGroup` overrides it
  for that attribute.
- Keep storage group names stable and machine-safe. Prefer lowercase
  alphanumeric names with `_` when the group is expected to become part of a
  database table name.
- For capture-like services, model the output identity and storage group as two
  separate settings. It is valid for both to be named `capture`, but they should
  not be treated as the same field.

## API endpoints registry (@uns-kit/api)

The API plugin adds a second registry topic that lists exposed HTTP endpoints:

```
uns-infra/<packageName>/<version>/<processName>/<instanceName>/api-endpoints
```

Payload: retained JSON array of `IApiObject` entries.

Fields:

- `timestamp`
- `topic`, `asset`, `objectType`, `objectId`, `attribute`, `attributeType`
- `apiHost`
- `apiEndpoint`
- `apiMethod` (`GET`/`POST`/`PUT`/`DELETE`)
- `apiQueryParams`
- `apiDescription`
- `apiSwaggerEndpoint`

Use this topic to discover which UNS paths are backed by HTTP endpoints in the current process.

## Sample payloads

### Active status (`.../active`)

```json
{
  "message": {
    "data": {
      "time": "2024-01-01T12:00:00.000Z",
      "value": 1,
      "uom": "bit",
      "valueType": "number"
    }
  },
  "version": "1.2.0"
}
```

### Heap used (`.../heap-used`)

```json
{
  "message": {
    "data": {
      "time": "2024-01-01T12:00:00.000Z",
      "value": 128,
      "uom": "MB",
      "valueType": "number"
    }
  },
  "version": "1.2.0"
}
```

### Instance alive (`.../<instanceName>/alive`)

```json
{
  "message": {
    "data": {
      "time": "2024-01-01T12:00:00.000Z",
      "value": 1,
      "uom": "bit",
      "valueType": "number"
    }
  },
  "version": "1.2.0"
}
```

### Handover messages (`.../handover`)

Handover messages are simple JSON objects that coordinate ownership between processes.
`handover_intent` is emitted immediately when a process decides to request a handover
and waits the configured delay before publishing `handover_request`.

```json
{ "type": "handover_intent" }
```

```json
{ "type": "handover_request" }
```

```json
{ "type": "handover_subscriber", "instanceName": "templateUnsRttOutput" }
```

```json
{ "type": "handover_fin" }
```

```json
{ "type": "handover_ack" }
```

The requesting and responding processes also include `processName` and `processId`
in MQTT user properties when publishing these messages.

### Produced topics registry (`.../topics`)

```json
[
  {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "topic": "enterprise/site/area/line/",
    "asset": "asset-1",
    "assetDescription": "Line asset",
    "objectType": "energy-resource",
    "objectTypeDescription": "Energy carriers (electricity/steam/gas)",
    "objectId": "main",
    "attribute": "active-energy-total",
    "attributeType": "Data",
    "description": "Cumulative active energy counter",
    "tags": ["electrical", "metering"],
    "attributeNeedsPersistence": true,
    "valueType": "number",
    "presentationKind": "counter",
    "defaultAggregation": "last",
    "counterResetPolicy": "new-value",
    "systemRole": "relationship-evidence",
    "relationshipEvidence": {
      "relationshipKey": "material-renumbering",
      "ownerEndpoint": "target",
      "valueEndpoint": "source",
      "sourceObjectType": "material",
      "targetObjectType": "material"
    },
    "dataGroup": "sensor"
  }
]
```

### API endpoints registry (`.../api-endpoints`)

```json
[
  {
    "timestamp": "2024-01-01T12:00:00.000Z",
    "topic": "enterprise/site/area/line/",
    "asset": "asset-1",
    "objectType": "resource-status",
    "objectId": "main",
    "attribute": "status",
    "attributeType": "Api",
    "apiDescription": "Line status endpoint",
    "apiHost": "http://10.0.0.10:8080",
    "apiEndpoint": "/api/enterprise/site/area/line/status",
    "apiSwaggerEndpoint": "/process/api/swagger.json",
    "apiMethod": "GET",
    "apiQueryParams": [
      { "name": "limit", "type": "number", "required": false }
    ]
  }
]
```
