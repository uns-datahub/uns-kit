/**
 * Change this file according to your specifications and rename it to index.ts
 *
 * This example shows how to register GET and POST API endpoints using @uns-kit/api.
 * Each endpoint is tied to a UNS topic/asset/objectType/objectId/attribute path and
 * is automatically registered with the UNS controller and exposed via Swagger.
 *
 * Endpoint signature:
 *   api.get(topic, asset, objectType, objectId, attribute, options?)
 *   api.post(topic, asset, objectType, objectId, attribute, options?)
 *
 * Events:
 *   apiGetEvent  — fired for every incoming GET request
 *   apiPostEvent — fired for every incoming POST request
 */
import { UnsProxyProcess, ConfigFile } from "@uns-kit/core";
import { IApiProxyOptions } from "@uns-kit/core";
import type { UnsEvents } from "@uns-kit/core";
import "@uns-kit/api";
import { type UnsProxyProcessWithApi } from "@uns-kit/api";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file.
 */
const config = await ConfigFile.loadConfig();

/**
 * Create the API proxy.
 * Auth is automatically applied to every registered endpoint.
 * Use jwksWellKnownUrl (preferred in production) or jwtSecret (dev/simple deployments).
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, { processName: config.uns.processName }) as UnsProxyProcessWithApi;
const apiOptions: IApiProxyOptions = config.uns?.jwksWellKnownUrl
  ? {
      jwks: {
        wellKnownJwksUrl: config.uns.jwksWellKnownUrl,
        ...(config.uns.kidWellKnownUrl !== undefined
          ? { activeKidUrl: config.uns.kidWellKnownUrl }
          : {}),
      },
    }
  : {
      jwtSecret: "CHANGEME",
    };
const apiInput = await unsProxyProcess.createApiProxy("templateUnsApiInput", apiOptions);

// ─── GET endpoints ────────────────────────────────────────────────────────────

/**
 * Register a GET endpoint.
 * Query params are validated automatically; required params return 400 when missing.
 * chatCanonical maps natural-language field names to query params for LLM tooling.
 */
await apiInput.get(
  "enterprise/site/area/line/",
  "line-3-furnace",
  "energy-resource",
  "main-bus",
  "current",
  {
    tags: ["Energy"],
    apiDescription: "Current reading for line-3-furnace main-bus",
    queryParams: [
      { name: "from", type: "string", required: false, description: "Start of time range (ISO 8601)", chatCanonical: "from" },
      { name: "to",   type: "string", required: false, description: "End of time range (ISO 8601)",   chatCanonical: "to"   },
      { name: "limit", type: "number", required: false, description: "Maximum number of records",     chatCanonical: "limit", defaultValue: 100 },
    ],
    chatDefaults: { limit: 100 },
  }
);

await apiInput.get(
  "enterprise/site/area/line/",
  "line-3-compressor",
  "utility-resource",
  "air-loop-1",
  "pressure",
  {
    tags: ["Utility"],
    apiDescription: "Pressure reading for line-3-compressor air-loop-1",
    queryParams: [
      { name: "limit", type: "number", required: false, description: "Maximum number of records", defaultValue: 50 },
    ],
  }
);

// ─── POST endpoints ───────────────────────────────────────────────────────────

/**
 * Register a POST endpoint.
 * Use POST when the caller needs to send a request body (commands, write operations, etc.).
 * The requestBody schema is published to Swagger so clients know what to send.
 */
await apiInput.post(
  "enterprise/site/area/line/",
  "line-3-furnace",
  "energy-resource",
  "main-bus",
  "setpoint",
  {
    tags: ["Energy"],
    apiDescription: "Write a new setpoint for line-3-furnace main-bus",
    requestBody: {
      description: "Setpoint payload",
      required: true,
      schema: {
        type: "object",
        required: ["value"],
        properties: {
          value: { type: "number", description: "Target setpoint value" },
          unit:  { type: "string", description: "Unit of measurement, e.g. A" },
        },
      },
    },
  }
);

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handle all GET requests.
 * event.req is the Express Request; event.res is the Express Response.
 * Use event.req.query for query parameters and event.req.appContext for UNS context.
 */
apiInput.event.on("apiGetEvent", (event: UnsEvents["apiGetEvent"]) => {
  try {
    // const { from, to, limit } = event.req.query;
    // Add your data-fetching logic here (e.g. SQL query, time-series lookup)
    event.res.json({ status: "ok", data: [] });
  } catch (error) {
    event.res.status(400).json({ error: "Bad request" });
  }
});

/**
 * Handle all POST requests.
 * event.req.body contains the parsed JSON body (Express json() middleware is pre-configured).
 */
apiInput.event.on("apiPostEvent", (event: UnsEvents["apiPostEvent"]) => {
  try {
    const body = event.req.body as { value?: number; unit?: string };
    // Add your write/command logic here
    event.res.json({ status: "ok", received: body });
  } catch (error) {
    event.res.status(400).json({ error: "Bad request" });
  }
});

// ─── NOTE: registerCatchAll ───────────────────────────────────────────────────
//
// registerCatchAll() is used ONLY by the uns-api-global microservice, which acts
// as a catch-all gateway for an entire topic namespace. Regular microservices
// do NOT call this — use get() / post() above for per-attribute endpoints.
