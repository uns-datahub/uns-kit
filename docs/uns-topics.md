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
