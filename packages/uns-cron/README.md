# @uns-kit/cron

`@uns-kit/cron` adds cron-style scheduling to the UNS runtime. It registers a `createCrontabProxy` method on `UnsProxyProcess`, emitting `cronEvent` notifications that can be bridged to MQTT topics or any downstream integration.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.

## uns-kit in context

uns-kit is a batteries-included toolkit for Unified Namespace applications. It standardizes MQTT wiring, auth, config schemas, and scaffolding so you can focus on scheduled behaviors and domain logic. The toolkit includes:

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime utilities (UnsProxyProcess, MQTT helpers, configuration tooling, gRPC gateway support). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin that exposes HTTP endpoints, handles JWT/JWKS auth, and republishes API metadata to UNS. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/temporal`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-temporal) | Temporal.io integration that wires workflows into UnsProxyProcess. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | Command line tool for scaffolding new UNS applications. |

## Installation

```bash
pnpm add @uns-kit/cron
# or
npm install @uns-kit/cron
```

You will also need `@uns-kit/core` in your project because the plugin augments `UnsProxyProcess`.

## Quick Start

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import type { UnsProxyProcessWithCron } from "@uns-kit/cron";
import "@uns-kit/cron";

async function main() {
  const process = new UnsProxyProcess("mqtt-broker:1883", { processName: "cron-demo" }) as UnsProxyProcessWithCron;

  const cronProxy = await process.createCrontabProxy("*/5 * * * *");
  cronProxy.event.on("cronEvent", () => {
    console.log("tick");
  });
}

void main();
```

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

`build` emits ESM JavaScript and type declarations into `dist/`.

## License

MIT © Aljoša Vister
