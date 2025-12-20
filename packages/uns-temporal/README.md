# @uns-kit/temporal

`@uns-kit/temporal` bridges Temporal.io workflows into the Unified Namespace. The plugin registers a `createTemporalProxy` method on `UnsProxyProcess`, tracks workflow metadata, and republishes workflow results via UNS topics.

## uns-kit in context

uns-kit is a batteries-included toolkit for Unified Namespace applications. It standardizes MQTT wiring, auth, config schemas, and scaffolding so you can focus on orchestrating workflows instead of boilerplate. The toolkit includes:

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://www.npmjs.com/package/@uns-kit/core) | Base runtime utilities (UnsProxyProcess, MQTT helpers, configuration tooling, gRPC gateway support). |
| [`@uns-kit/api`](https://www.npmjs.com/package/@uns-kit/api) | Express plugin that exposes HTTP endpoints, handles JWT/JWKS auth, and republishes API metadata to UNS. |
| [`@uns-kit/cron`](https://www.npmjs.com/package/@uns-kit/cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/temporal`](https://www.npmjs.com/package/@uns-kit/temporal) | Temporal.io integration that wires workflows into UnsProxyProcess. |
| [`@uns-kit/cli`](https://www.npmjs.com/package/@uns-kit/cli) | Command line tool for scaffolding new UNS applications. |

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
