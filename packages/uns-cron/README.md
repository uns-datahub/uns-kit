# @uns-kit/cron

`@uns-kit/cron` adds cron-style scheduling to the UNS runtime. It registers a `createCrontabProxy` method on `UnsProxyProcess` that fires a `cronEvent` on every tick. Use this to trigger periodic MQTT publishes, data pulls, or any scheduled logic inside your microservice.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.

## uns-kit in context

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime (UnsProxyProcess, MQTT helpers, config tooling, gRPC gateway). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin — HTTP endpoints, JWT/JWKS auth, Swagger, UNS metadata. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | CLI for scaffolding new UNS applications. |

## Installation

```bash
pnpm add @uns-kit/cron
# or
npm install @uns-kit/cron
```

`@uns-kit/core` must also be present — the plugin augments `UnsProxyProcess`.

## How it works

1. Import `@uns-kit/cron` as a side-effect to register the plugin.
2. Call `proc.createCrontabProxy(schedule, options?)` with a cron expression.
3. Listen to `cronEvent` — it fires on every tick with the event name and expression.
4. Inside the handler, publish to MQTT, query a database, call an API — whatever your service needs on that cadence.

## Single schedule

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import { ConfigFile } from "@uns-kit/core";
import type { UnsEvents } from "@uns-kit/core";
import "@uns-kit/cron";
import { type UnsProxyProcessWithCron } from "@uns-kit/cron";

const config = await ConfigFile.loadConfig();
const proc = new UnsProxyProcess(config.infra.host!, { processName: config.uns.processName }) as UnsProxyProcessWithCron;

// Fire every 5 minutes
const cron = await proc.createCrontabProxy("*/5 * * * *", { event: "collect" });

cron.event.on("cronEvent", async ({ event, cronExpression }: UnsEvents["cronEvent"]) => {
  // Pull data from a sensor / database and publish to UNS
  const reading = await fetchSensorReading();
  proc.publish("enterprise/site/area/sensor/energy-resource/main/current", { value: reading });
});
```

## Multiple schedules on one proxy

Pass an array of `{ cronExpression, event }` objects to handle different cadences from a single handler:

```ts
const cron = await proc.createCrontabProxy([
  { cronExpression: "* * * * * *",   event: "fast-poll" },   // every second
  { cronExpression: "*/10 * * * *",  event: "slow-summary" }, // every 10 minutes
]);

cron.event.on("cronEvent", ({ event }) => {
  if (event === "fast-poll") {
    // lightweight polling
  } else if (event === "slow-summary") {
    // heavier aggregation
  }
});
```

## Multiple schedules with shared options

```ts
const cron = await proc.createCrontabProxy(
  ["*/5 * * * *", "0 * * * *"],
  { timezone: "Europe/Ljubljana" },
);
```

## Cron expression reference

| Expression | Meaning |
|---|---|
| `* * * * * *` | Every second (6-part with seconds) |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 6 * * 1-5` | Every weekday at 06:00 |

The underlying scheduler supports both 5-part (minute-level) and 6-part (second-level) cron expressions.

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

`build` emits ESM JavaScript and type declarations into `dist/`.

## License

MIT © Aljoša Vister
