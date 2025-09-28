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
import { UnsAttributeType } from "@uns-kit/core/uns/uns-interfaces";
import type { UnsProxyProcessWithTemporal } from "@uns-kit/temporal";
import "@uns-kit/temporal";

async function main() {
  const process = new UnsProxyProcess("mqtt-broker:1883", { processName: "temporal-demo" }) as UnsProxyProcessWithTemporal;

  const temporal = await process.createTemporalProxy("line-etl", "temporal:7233", "line-namespace");
  await temporal.initializeTemporalProxy({
    topic: "factory/",
    attribute: "line-status",
    attributeType: UnsAttributeType.Data,
  });

  await temporal.startWorkflow("TransformLineData", { coil_id: "42" }, "ETL_LINE_TASK_QUEUE");
}

void main();
```

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

## License

MIT © Aljoša Vister
