# Counter Delta Policy

Producer-side delta calculation is deprecated in `uns-kit`.

`MessageMode.Delta`, `MessageMode.Both`, and gRPC
`PublishRequest.value_is_cumulative` compute a delta from previous values held
in the producer process. That state is lost when a microservice restarts,
reconnects, is redeployed, or moves between instances, so the next delta can be
wrong or must be skipped.

## Direction

- Producers publish the raw cumulative counter value.
- Producers mark counter attributes with metadata:
  - `valueType: "number"`
  - `presentationKind: "counter"`
  - `defaultAggregation: "last"`
  - optional `counterResetPolicy`, such as `new-value`, `null`, or `rollover`
- Datahub history APIs calculate `delta` and `rate` from persisted QuestDB
  history at query time.
- UI/chart consumers request the desired view from the API instead of deriving
  counter semantics locally.

## Examples

Data series:

```json
{
  "attribute": "active-energy-total",
  "description": "Cumulative active energy counter",
  "valueType": "number",
  "presentationKind": "counter",
  "defaultAggregation": "last",
  "counterResetPolicy": "new-value",
  "data": {
    "time": "2026-06-02T12:00:00.000Z",
    "value": 12345.6,
    "uom": "kWh",
    "dataGroup": "metering"
  }
}
```

Table series:

```json
{
  "attribute": "measurements",
  "description": "Metering table",
  "tableColumns": [
    {
      "name": "active_energy_total",
      "valueType": "number",
      "presentationKind": "counter",
      "defaultAggregation": "last",
      "counterResetPolicy": "new-value"
    }
  ],
  "table": {
    "time": "2026-06-02T12:00:00.000Z",
    "dataGroup": "metering",
    "columns": [
      { "name": "active_energy_total", "type": "double", "value": 12345.6, "uom": "kWh" },
      { "name": "power", "type": "double", "value": 42.1, "uom": "kW" }
    ]
  }
}
```

## Compatibility

The deprecated producer modes remain available for existing services, but new
code should not use them. Existing physical `*-delta` attributes should be
treated as ordinary numeric attributes, not as the preferred counter model.
