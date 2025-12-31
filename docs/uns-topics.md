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
- `dataGroup`

This list is built as your process publishes messages and is refreshed periodically.

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
    "attribute": "voltage",
    "attributeType": "Data",
    "description": "Measured voltage",
    "tags": ["electrical"],
    "attributeNeedsPersistence": true,
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
