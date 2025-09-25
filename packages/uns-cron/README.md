# @uns-kit/cron

`@uns-kit/cron` adds cron-style scheduling to the UNS runtime. It registers a `createCrontabProxy` method on `UnsProxyProcess`, emitting `cronEvent` notifications that can be bridged to MQTT topics or any downstream integration.

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
