# MQTT table columns object migration plan

Status date: 2026-07-20

This document is the canonical cross-repository plan for changing the MQTT
`IUnsTable.columns` wire shape from an array of named column descriptors to an
object keyed by column name. Update this file whenever implementation, release,
deployment, or verification state changes.

## Rollout gate

**May production publishers emit the object form? No.**

The gate may change to **Yes** only after the active `uns-archiver` deployment
can read both shapes and the legacy-array/object equivalence smoke has passed
against QuestDB. `uns-api-global` is the first production publisher that may be
upgraded after that gate is cleared.

## Cross-repository branch

Use the same branch name in every source repository changed for this migration:

```text
codex/mqtt-table-columns-object
```

The shared name makes related GitHub and Azure DevOps work easy to locate. Do
not create branches or apply source fixes in copied deployment trees such as
`uns-datahub-tools/uns-datahub-controller/rtt-nodes/*`; use those copies only to
identify deployed versions, then rebuild and redeploy from the owning source
repository.

## Why this change

The current MQTT packet shape requires consumers to search an array before they
can read a named table field:

```json
{
  "columns": [
    { "name": "power", "type": "double", "value": 42.1, "uom": "kW" }
  ]
}
```

Kepware cannot reliably address a column by name in that array. The target
shape exposes each column as a named JSON field:

```json
{
  "columns": {
    "power": { "type": "double", "value": 42.1, "uom": "kW" }
  }
}
```

This allows consumers to address `message.table.columns.power.value` directly.

## Scope boundaries

This is an MQTT table wire-contract migration. It is not a general replacement
of every array named `columns`.

In scope:

- MQTT `message.table.columns` parsing, validation, construction, and
  serialization;
- direct MQTT table publishers and consumers;
- published examples and migration guidance;
- package, lockfile, deployment, and integration verification required by the
  new `@uns-kit/core` boundary.

Explicitly out of scope:

- gRPC;
- controller assistant `[[TABLE_JSON]]` artifacts;
- `IUnsTableColumnMetadata[]` / attribute `tableColumns` schema metadata;
- capture `outputSchema.columns` and other ordered schema definitions;
- Datahub range/history result column arrays;
- application configuration arrays that are not themselves the MQTT wire
  packet.

Internal arrays may remain where ordering, conditional `.push()` operations,
or placeholder resolution make them useful. They must be converted only at the
structured MQTT publish boundary. In particular, this migration must not
silently change the persisted `uns-databridge` configuration shape.

## Confirmed decisions

- `@uns-kit/core` owns MQTT table validation, inbound legacy parsing,
  normalization, structured packet construction, and serialization.
- The public TypeScript publisher contract uses only the object form.
- Inbound readers accept both the legacy array and the new object form. Legacy
  input is normalized at the `uns-kit` boundary.
- The canonical parsed representation is the new object form.
- Downstream consumers operate only on the canonical object. They do not
  contain their own array/object compatibility branches.
- `IUnsTableColumn.name` is removed from the canonical column value because the
  object key carries the name.
- `IUnsTableColumn.type` remains required. Type inference is not part of this
  migration because null values and schema evolution make it ambiguous.
- Structured publishers emit only the new object form. Legacy read
  compatibility remains available for a substantially longer period than the
  publisher transition.
- `dataGroup` remains a storage/routing field on `IUnsTable`; this migration
  does not change `dataGroup`, `virtualGroup`, or table schema metadata.
- Column names are preserved exactly. There is no automatic lowercasing,
  sanitization, or renaming.
- JSON object key order is not part of the MQTT contract. UI/schema ordering
  continues to come from schema metadata rather than the value packet.
- gRPC and assistant `TABLE_JSON` are out of scope.

## Column key contract

New structured publishers must use Kepware- and SQL-safe column keys:

```text
^[A-Za-z_][A-Za-z0-9_]{0,62}$
```

The names `__proto__`, `prototype`, and `constructor` are reserved and rejected.
The implementation must build normalized objects without prototype-sensitive
property assignment and iterate own properties only.

Before applying this rule to legacy inbound arrays, audit deployed column names.
If an existing deployed producer has a non-conforming name, preserve read
compatibility for that legacy packet and migrate the producer deliberately;
never silently rewrite a column name because that would also change the
QuestDB schema and downstream queries.

## Target TypeScript contract

The public write and canonical read contract is equivalent to:

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
  // Existing interval, window, event, and lifecycle fields remain unchanged.
}
```

The legacy descriptor is an internal inbound-parser concern, not a normal
public publisher type:

```ts
interface IUnsLegacyTableColumn extends IUnsTableColumn {
  name: string;
}
```

Keep the two runtime boundaries explicit:

- inbound: `unknown -> validate and normalize array or object -> IUnsTable`;
- outbound: `IUnsTable object -> validate object only -> IUnsPacket`.

A typed `tableColumnEntries(columns)` helper may wrap `Object.entries()` for
canonical objects, but it must not accept the legacy union or perform downstream
compatibility normalization.

## Structured publishing and the raw escape hatch

`UnsMqttProxy.publishMqttMessage()` is the structured UNS publish path and must
always pass tables through the new outbound validator. `UnsPacket` construction
must always serialize object-form columns.

`UnsMqttProxy.publishMessage(topic, string)` is intentionally a generic raw
MQTT escape hatch and cannot guarantee the UNS table contract. Audit every raw
publish call that can carry a table packet. A raw publish is acceptable only if
the payload was first constructed and validated by the canonical `UnsPacket`
builder; document intentional non-UNS raw messages separately.

## Package and packet versions

The TypeScript public API change requires a new semver major. All six
coordinated `@uns-kit/*` package manifests are set to `3.0.0`; publishing is
still a separate explicit step.

The MQTT packet wire version must also change because the emitted table shape
changes. The working target is packet version `2.0.0`. The implementation must
define and test supported versions instead of merely checking that a `version`
field exists:

- legacy packet version with array columns -> accepted and normalized;
- new packet version with object columns -> accepted as canonical;
- new structured publishers -> always emit the new packet version and object
  form;
- unsupported/malformed versions -> rejected with an observable reason.

Python has its own package version. Its breaking pre-1.0 release boundary is
set to `uns-kit` `0.2.0`; publishing remains separate from npm.

Every affected application must update both its dependency declaration and
lockfile, then record the actually resolved version. A caret range in
`package.json` is not proof that the intended package is installed.

## Failure semantics

Define failure behavior as part of the major contract:

- malformed inbound MQTT packet -> parser returns `null` and records a bounded,
  actionable reason;
- invalid outbound table -> packet builder/publisher rejects before enqueueing;
- packet construction must never silently return `undefined` after validation
  failure;
- archiver distinguishes malformed/non-retryable packets from retryable
  QuestDB transport failures;
- rollout monitoring checks rejected packets, non-retryable archiver errors,
  publish failures, and persisted row counts.

## Current state

### Completed analysis and documentation

- [x] Located the TypeScript contract and validation in
  `packages/uns-core/src/uns/uns-interfaces.ts` and `uns-packet.ts`.
- [x] Confirmed the original TypeScript contract required
  `IUnsTableColumn[]`.
- [x] Implemented the TypeScript canonical object contract, dual-shape inbound
  parser, object-only outbound builder, packet-version handling, and focused
  tests.
- [x] Implemented Python inbound normalization, object-form output, required
  column types, examples, and focused tests. Python temporarily accepts legacy
  builder arrays but always converts them before output.
- [x] Added the version-bounded `3.0.0` core migration and generated CLI agent
  guidance.
- [x] Confirmed that the controller UNS monitor consumes produced-topic
  metadata, not business `IUnsTable` value packets.
- [x] Confirmed that controller assistant `TABLE_JSON` handling is unrelated.
- [x] Identified the direct runtime publishers and consumers listed below.
- [x] Reviewed the migration plan and incorporated contract, rollout, release,
  raw-publish, key-safety, and status-tracking corrections.

### Remaining work

- [ ] `uns-archiver` canonical object iteration is implemented locally, but its
  `@uns-kit/core` dependency/lockfile cannot be upgraded and its dual-wire
  integration cannot be completed until the `3.x` npm package is available.
- [ ] No release has been published or deployed.
- [ ] No controller dependency bump or integration smoke has been completed.
- [ ] npm package version `3.0.0`, Python package version `0.2.0`, and emitted
  MQTT packet version `2.0.0` are implemented and tested but not published.

## Status tracking

Use these states independently. Code completion is not deployment completion.

- `Not started`
- `In progress`
- `Implemented`
- `Released`
- `Deployed`
- `Verified`
- `Not applicable`

| Repository or surface | Role and required work | Code | Released version | Deployed version | Verified | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `uns-kit/packages/uns-core` | Canonical object types, dual-shape inbound parser, object-only outbound validation, packet-version handling, tests, and exported canonical helpers. | Implemented at `3.0.0` | - | N/A | Yes, local | 16 combined contract/metadata/CLI tests passed; version check confirmed six packages at `3.0.0`; full TypeScript build passed |
| `uns-kit/packages/uns-py` | Canonical parser/builder behavior, required `type`, object-form output, examples, tests, and separate package release. | Implemented at `0.2.0` | - | N/A | Yes, targeted local | 14 packet tests, focused Ruff and mypy checks, and wheel/sdist build passed; full suite remains blocked by missing optional extras and unrelated baseline failures |
| `uns-kit/packages/uns-cli` | Table examples, window-load examples, README snippets, generated migration guidance, and CLI upgrade tests. | Implemented | - | N/A | Yes, local | CLI upgrade idempotency tests and full TypeScript workspace build passed |
| `uns-archiver` | Consume canonical object entries, remove array-only guards/`.length`, preserve QuestDB symbol/field behavior, and expose ingest failures. | Implemented; dependency upgrade pending npm release | - | - | Yes, packed-package integration | 10 tests, typecheck, and build passed with packed core/api `3.0.0`; legacy `1.3.0` array and `2.0.0` object packets produced identical canonical writer entries; writer test preserves symbol-before-field, UoM, null-skip, and flush behavior |
| `uns-api-global` | Update last-value reader and capture publisher together; preserve UoM projection and latest-value behavior. | Implemented; dependency/lockfile update pending npm release | - | - | Yes, local packed packages | All 83 tests passed with locally packed core/api `3.0.0`; typecheck and build passed; current checked-in dependency remains `2.x` until release |
| `rtt-demo-app` | Convert table payloads at the publish boundary while retaining convenient internal construction where useful. | Implemented; dependency/lockfile update pending npm release | - | - | Yes, local packed packages | HRM table arrays are converted once at the publish boundary; typecheck and build passed with packed core/api `3.0.0` |
| `uns-databridge` | Preserve configuration shape, convert resolved descriptors at the publish boundary, and apply every crossed core migration from its current `1.x` dependency. | Implemented; dependency/lockfile update pending npm release | - | - | Yes, local packed package | Ordered configuration arrays remain unchanged; resolved MQTT columns become an object; boolean inference added; process-owned shutdown handles SIGINT/SIGTERM; typecheck and build passed with core `1.x` and packed `3.0.0` |
| `@uns-kit/bridge-core` | Update its direct `@uns-kit/core` and `@uns-kit/api` dependencies to the `3.x` release so bridge runtimes do not install duplicate incompatible major versions. No table payload implementation was found in the installed package surface. | Blocked; source repository is not present locally | - | N/A | Dependency evidence only | Installed `1.0.1` declares core/api `^2.0.59`; repository metadata points to `uns-datahub/uns-bridge-core` |
| `uns-datahub-controller` | Upgrade dependency and lockfile; verify produced-topic metadata and controller build without changing `TABLE_JSON`. | Not started | - | - | No | - |
| `uns-bridge-opcua` / `uns-bridge-mqtt` | Update checked-in table examples and then consume compatible core/api/bridge-core releases; runtime normalizers currently publish scalar requests and do not directly assemble tables. | Examples implemented; dependency graph pending releases | - | - | Yes, local override rehearsal | Runtime/config search found table construction only under `src/examples`; both typecheck/build with packed core/api `3.0.0` when transitive bridge-core dependencies are overridden consistently |
| Other generated examples | Update checked-in examples only where they are built or intentionally maintained. | Inventory complete; only in-scope bridge copies updated now | - | - | Source audit complete | Remaining hits are generated examples in repos without runtime table usage; update them when those repos cross the core `3.x` boundary |
| Legacy vendored implementations | Determine deployment status; update owning source parser or retire the runtime. | Source audit complete; deployment audit pending | - | - | No production evidence | `uns-api-hv`, `uns-etl-hv`, `uns-rtt-network`, and `uns-rtt-estevci` use older, different `table.values`/DML contracts rather than current `IUnsTable.columns` |
| External MQTT consumers | Audit Kepware, Node-RED, replay jobs, transparent bridges, and other non-repository subscribers. | Audit not started | N/A | N/A | No | - |

## Repository inventory

Confirmed coordinated source repositories:

- `uns-kit`
- `uns-archiver`
- `uns-api-global`
- `rtt-demo-app`
- `uns-databridge`
- `uns-datahub-controller` as an indirect metadata/integration consumer

Repositories containing table examples or generated scaffold copies include:

- `bi-export-api`
- `uns-energenti`
- `uns-rag`
- `uns-assistant-runtime`
- `uns-bridge-opcua`
- `uns-bridge-mqtt`
- `uns-rtt-solvera-v2`
- `data-offer-template`

These example hits do not by themselves prove runtime MQTT table usage. Update
them only if the examples participate in the build or are intentionally
maintained as current guidance. `uns-assistant-runtime` and `uns-rag` are not
expected to need runtime changes for this MQTT migration.

Legacy repositories with local or vendored UNS packet implementations include
`uns-api-hv`, `uns-etl-hv`, `uns-rtt-network`, and `uns-rtt-estevci`. A new
`@uns-kit/core` release will not make those parsers compatible automatically.

Repository search is not a complete MQTT consumer inventory. Before clearing
the rollout gate, inspect active broker subscriptions and deployed RTT versions
for Kepware, Node-RED, external MQTT clients, replay/offline queue processes,
and bridges that transparently forward raw packets.

## `uns-kit` implementation sequence

1. Add focused packet tests before changing behavior.
2. Introduce the canonical public object types and keep legacy array types
   internal to inbound decoding.
3. Implement a single inbound validator/normalizer used by
   `UnsPacket.parseMqttPacket()`.
4. Implement object-only outbound validation used by
   `UnsPacket.unsPacketFromUnsMessage()` and structured MQTT publishing.
5. Make invalid outbound construction reject instead of silently returning
   `undefined`.
6. Add packet-version compatibility and emitted-version tests.
7. Audit raw `publishMessage()` paths in `uns-kit` templates/examples.
8. Align Python parsing, building, required types, examples, and tests. Decide
   explicitly whether Python temporarily accepts legacy builder arrays and
   converts them to object output or rejects them at the new release boundary;
   it must never emit arrays after the migration.
9. Update core README, Python README/examples, CLI templates, sandbox examples,
   and the published migration entry.
10. Run targeted tests, TypeScript version checks, and the full TypeScript and
    Python builds before release.

## Migration and release documentation

Before publishing the new version:

- add a version-bounded entry to `packages/uns-core/MIGRATIONS.md`;
- update the generated CLI `AGENTS.md` migration block and its idempotency test;
- document before/after publisher examples and the consumer-first rollout;
- record the TypeScript package version, Python package version, and MQTT packet
  version here;
- verify CLI package pins and workspace version checks;
- add the actual release evidence to the status table.

Applications must apply every migration boundary they cross. This is especially
important for `uns-databridge`, which currently depends on `@uns-kit/core` 1.x
and therefore also crosses the existing 2.0.71 MQTT publishing/shutdown
migration.

## Deployment rollout

The rollout is consumer-first. Publishing the new shape before the active
archiver understands it can reject table rows as non-retryable.

1. Implement, verify, and release the compatibility-capable `uns-kit` versions.
2. Upgrade `uns-archiver` dependency and lockfile, migrate its canonical object
   iteration, deploy it, and verify both legacy-array and object-form rows in
   QuestDB. Only this step can clear the publisher rollout gate.
3. Upgrade and deploy `uns-api-global` as one coordinated change: its last-value
   consumer and capture publisher live in the same runtime. Verify latest values,
   UoMs, capture output, and archiver persistence.
4. Upgrade remaining confirmed publishers, beginning with a canary where
   possible: `rtt-demo-app`, then `uns-databridge`, then other audited RTT
   publishers.
5. Upgrade `uns-datahub-controller` dependency and lockfile and run the metadata
   integration smoke. The controller is not a direct business table consumer
   and does not gate the packet-format switch.
6. Update intentionally maintained example repositories and verify their
   builds. Do not change unrelated runtime code in `uns-assistant-runtime` or
   `uns-rag` solely because they contain generated examples.
7. Complete the deployed legacy-runtime and external-consumer audit.
8. Keep dual-shape inbound reading after all publishers have migrated. Any
   future removal requires a separate versioned migration and deployment audit.

## Verification matrix

### `uns-kit` TypeScript

- Parse a valid legacy array and return the canonical object representation.
- Parse a valid object and preserve names, types, values, nulls, booleans, and
  UoMs.
- Round-trip legacy input through parse/re-serialization and emit object form.
- Reject empty arrays and objects.
- Reject missing/invalid `type`, missing/invalid `value`, invalid object values,
  empty names, reserved names, and duplicate legacy-array names.
- Reject or explicitly handle an object value containing a conflicting `name`.
- Preserve existing interval, window, event, deletion, and `dataGroup` fields.
- Verify that structured publisher APIs serialize only object columns and the
  new packet version.
- Verify `IUnsTableColumnMetadata[]` and produced-topic registration remain
  unchanged.
- Verify malformed inbound packets return `null` and invalid outbound packets
  reject observably.
- Add compile coverage proving the old TypeScript publisher shape fails while
  the new shape compiles.

### Python

- `parse()` validates and normalizes both accepted inbound shapes.
- `table()` and `from_message()` emit only object-form columns.
- Every published column includes a valid `type`.
- Python examples produce packets accepted by TypeScript parsing and
  `uns-archiver`.
- Python package-version and MQTT packet-version tests match the chosen release
  contract.

### Downstream consumers

- `uns-archiver` writes equivalent QuestDB rows for legacy and new wire input.
- Symbol columns are still written before fields.
- Null values, timestamps, booleans, lifecycle/window fields, and `dataGroup`
  retain their current behavior.
- Archiver trace column counts work for canonical objects.
- `uns-api-global` last-value results expose the same values and `<name>_uom`
  fields for both accepted wire shapes.
- Existing non-wire schema/config arrays retain their current persisted shape.

### Integration

- Publish a new object-form table packet through structured `uns-kit` APIs.
- Publish a legacy packet directly to the test broker and verify canonical
  consumer behavior.
- Confirm the controller registers the attribute as a table and preserves its
  produced-topic metadata.
- Confirm `uns-archiver` persists both rows with equivalent QuestDB schema and
  values.
- Confirm `uns-api-global` exposes the latest values.
- Confirm Kepware can browse and read a named path such as
  `message.table.columns.power.value`.
- Run builds/typechecks in every modified source repository without modifying
  assistant `TABLE_JSON` artifacts.

## Monitoring and rollback

Before each publisher deployment, record baseline archiver rejected-packet and
non-retryable-error counts. After deployment, compare publish counts, archiver
ingest counts, QuestDB row counts, and last-value results for the canary topics.

If object-form publishing causes errors:

1. roll back the affected publisher first so it resumes legacy array output;
2. keep the compatibility-capable consumers deployed when they are healthy;
3. do not roll back the dual-shape reader merely because the publisher was
   rolled back;
4. attach logs, affected topics, package/deployment versions, and rollback
   evidence to this document before retrying.

## Update protocol for future threads

Every thread that changes this migration must:

1. read this document before editing code;
2. use the shared branch name in each modified source repository;
3. update the status date and the applicable status-table row;
4. record commit, release, deployment, test, or production evidence in the
   `Evidence` column;
5. preserve the rollout gate until the active archiver deployment is verified;
6. distinguish source changes from copied deployment artifacts.

## Remaining open decisions

- Confirm ownership, release version, and timing for the external
  `@uns-kit/bridge-core` dependency update to core/api `3.x`.
- Decide the guaranteed duration of legacy inbound array support; the current
  recommendation is a long compatibility window.
- Confirm which legacy vendored runtimes and external MQTT consumers are still
  deployed.
