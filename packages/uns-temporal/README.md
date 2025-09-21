# @uns-kit/temporal

`@uns-kit/temporal` bridges Temporal.io workflows into the Unified Namespace. The plugin registers a `createTemporalProxy` method on `UnsProxyProcess`, tracks workflow metadata, and republishes workflow results via UNS topics.

## Installation

```bash
pnpm add @uns-kit/temporal
# or
npm install @uns-kit/temporal
```

Install `@uns-kit/core` as well—the plugin augments its runtime.

## Example

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import unsTemporalPlugin, { type UnsProxyProcessWithTemporal } from "@uns-kit/temporal";

const process = new UnsProxyProcess("mqtt-broker:1883", { processName: "temporal-demo" }) as UnsProxyProcessWithTemporal;
unsTemporalPlugin;

const temporal = await process.createTemporalProxy("hv-etl", "temporal:7233", "hv-namespace");
await temporal.initializeTemporalProxy({
  topic: "factory/",
  attribute: "hv-status",
  attributeType: UnsAttributeType.Data,
});

await temporal.startWorkflow("TransformHvSclData", { coil_id: "42" }, "ETL_HV_SCL_TASK_QUEUE");
```

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

## License

MIT © Aljoša Vister
