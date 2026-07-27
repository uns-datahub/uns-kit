# MQTT table columns object migration

This guide describes the MQTT table-contract migration from an array of named
column descriptors to an object keyed by column name.

## Why this change

The legacy shape requires a consumer to search an array before it can read a
named value:

```json
{
  "columns": [
    { "name": "power", "type": "double", "value": 42.1, "uom": "kW" }
  ]
}
```

The object form exposes a stable JSON path for each column:

```json
{
  "columns": {
    "power": { "type": "double", "value": 42.1, "uom": "kW" }
  }
}
```

Consumers can therefore address `message.table.columns.power.value` directly.

## Scope

This is an MQTT table wire-contract migration only. It does not replace every
array named `columns` in an application.

In scope are MQTT table parsing, validation, packet construction,
serialization, and the direct publishers and consumers of those packets.
Ordered schema metadata, application configuration arrays, gRPC payloads, and
other unrelated data contracts retain their existing shape unless their owner
migrates them separately.

## Canonical contract

The public writer contract and normalized reader contract are equivalent to:

```ts
export interface IUnsTableColumn {
  type: QuestDbType;
  value: string | number | boolean | null;
  uom?: MeasurementUnit;
}

export type IUnsTableColumns = Record<string, IUnsTableColumn>;

export interface IUnsTable {
  time: ISO8601;
  dataGroup?: string;
  columns: IUnsTableColumns;
}
```

The legacy `{ name, type, value, uom }` descriptor is an inbound-parser
concern, not a normal public publisher type. The object key carries the column
name.

`dataGroup` remains a storage and routing field on `IUnsTable`; this migration
does not change `dataGroup`, `virtualGroup`, or table-schema metadata.

## Compatibility rules

- Readers accept both the legacy array and the object form during the
  migration window, then normalize to the object form at the `uns-kit`
  boundary.
- New structured publishers emit only the object form.
- Downstream consumers use the normalized object and must not add their own
  array/object compatibility branches.
- Packet versions must be explicit: accept only the supported legacy and
  object-form versions, and reject malformed or unsupported versions with an
  actionable reason.
- Validate an outbound table before it is queued. A failed validation must not
  silently produce an incomplete packet.

Raw MQTT publishing remains a generic escape hatch. A raw table payload is
safe only when it was first constructed and validated by the canonical packet
builder.

## Column names

For new publishers, use stable names that are safe for MQTT consumers and the
selected history store:

```text
^[A-Za-z_][A-Za-z0-9_]{0,62}$
```

`__proto__`, `prototype`, and `constructor` are reserved. Implementations must
iterate own properties and avoid prototype-sensitive object assignment.

Do not silently lowercase, sanitize, or rename an existing column. A name
change also changes downstream paths and storage schemas. Migrate a
non-conforming producer deliberately, preserving legacy-read compatibility
until its consumers have moved.

## Adoption sequence

1. Upgrade consumers so they accept and normalize both shapes.
2. Verify equivalent legacy-array and object packets produce equivalent rows
   in the target history store.
3. Upgrade structured publishers to emit the new packet version and object
   form.
4. Keep dual-read support for an agreed migration window, including external
   MQTT consumers.
5. Retire legacy-read support only in a later, communicated breaking release.

Update dependency declarations and lockfiles together. Confirm the resolved
package version rather than relying only on a version range in `package.json`.

## Verification checklist

- A valid legacy array normalizes to the expected object.
- A valid object packet remains unchanged after normalization.
- Invalid names, missing required types, malformed values, and unsupported
  packet versions are rejected with useful diagnostics.
- Number, boolean, string, null, and unit values survive packet construction
  and persistence.
- Legacy and object-form test packets produce equivalent history rows.
- Direct named paths such as `message.table.columns.power.value` work in the
  intended MQTT consumer.
- Publishers and consumers have focused tests for their boundary; applications
  that only configure a publisher do not need to duplicate packet parsing.

## Rollback

If an object-form publisher causes an integration issue, roll back that
publisher to the prior release while retaining compatibility-capable consumers.
Do not roll back readers before all object-form publishers have stopped. Keep
the packet examples and validation evidence with the release so operators can
distinguish an MQTT contract issue from a storage or transport failure.
