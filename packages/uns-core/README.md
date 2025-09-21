# @uns-kit/core

Core utilities and runtime building blocks for building Unified Namespace (UNS) realtime transformers. The package bundles the process lifecycle manager, MQTT integrations, gRPC gateway helpers, configuration tooling, and shared type definitions that power the UNS ecosystem.

## Installation

```bash
pnpm add @uns-kit/core
# or
npm install @uns-kit/core
```

## Key Features

- **UnsProxyProcess** – plugin-ready runtime for managing UNS proxy instances and MQTT wiring.
- **MQTT helpers** – resilient publishers, topic builders, throttled queues, and handover support.
- **Configuration utilities** – Zod-powered config schema generation and secret resolution helpers.
- **gRPC gateway helpers** – infrastructure to bridge Python workers into the UNS message fabric.

## Usage

Most projects start by creating an `UnsProxyProcess` and registering plugins:

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";

const process = new UnsProxyProcess("mqtt-broker.svc:1883", { processName: "my-rtt" });
```

See the individual plugin packages (`@uns-kit/cron`, `@uns-kit/api`, `@uns-kit/temporal`) for examples on extending the process with runtime capabilities.

## Development

```bash
# Lint and type-check the sources
pnpm run typecheck

# Emit JavaScript and declaration files to dist/
pnpm run build
```

## License

MIT © Aljoša Vister
