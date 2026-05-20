# @uns-kit/database

Database helpers for UNS services. The package keeps database access outside `@uns-kit/core` while still fitting the same config/secret-resolution flow used by the rest of `uns-kit`.

## Installation

Install the package plus only the driver(s) you need:

```bash
pnpm add @uns-kit/database pg
# or
pnpm add @uns-kit/database better-sqlite3
# or
pnpm add @uns-kit/database oracledb
```

`pnpm add @uns-kit/database pg` is the intended one-command install pattern for Postgres support. Replace `pg` with `oracledb` or `better-sqlite3` for the other drivers.

## What it provides

- Driver-aware client factory for `pg`, `sqlite`, and `oracle`
- One portable SQL parameter style for all drivers: write SQL with `:namedParams`
- Shared database manager for multiple named connections
- SQL file loading from a configured `sqlDir`
- Zod schemas for app-level `databases` config extensions

## Config schema integration

Inside your app's `src/config/project.config.extension.ts`:

```ts
import { z } from "zod";
import { databasesConfigSchema } from "@uns-kit/database";

export const projectExtrasSchema = z.object({
  databases: databasesConfigSchema,
});
```

The schema uses the same placeholder object shapes as `@uns-kit/core`, so `ConfigFile.loadConfig()` resolves database secrets automatically.

## Example config

```json
{
  "databases": {
    "main": {
      "dialect": "pg",
      "host": { "provider": "external", "key": "PG_HOST" },
      "port": 5432,
      "database": "factory",
      "user": "app_user",
      "password": { "provider": "env", "key": "PG_PASSWORD" },
      "usePool": true,
      "sqlDir": "./sql"
    }
  }
}
```

Set `"usePool": false` for Postgres or Oracle when you want a direct non-pooled connection, matching the old local proxy behavior.

## Usage

```ts
import { ConfigFile } from "@uns-kit/core";
import { registerDatabase } from "@uns-kit/database";

const config = await ConfigFile.loadConfig();
registerDatabase("main", config.databases.main);
registerDatabase("reporting", config.databases.reporting);
registerDatabase("mesOracle", config.databases.mesOracle);
```

Then in another file:

```ts
import { getDatabase } from "@uns-kit/database";

const db = await getDatabase("main");
const rows = await db.queryFile("queries/get-orders.sql", {
  lineId: "L1",
  fromTs: "2026-05-20T08:00:00Z",
});
```

Use `:lineId`, `:fromTs`, etc. in SQL files. The package compiles them to `$1`, `?`, or Oracle bind syntax depending on the selected driver. The authoring style stays the same for all supported databases: plain SQL plus `:namedParam` bindings.

See also:
- [`examples/app-startup.ts`](D:/projects/uns-kit/packages/uns-database/examples/app-startup.ts)
- [`examples/orders-service.ts`](D:/projects/uns-kit/packages/uns-database/examples/orders-service.ts)
