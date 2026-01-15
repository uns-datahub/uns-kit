/**
 * Change this file according to your specifications and rename it to index.ts
 */
import { UnsProxyProcess, ConfigFile } from "@uns-kit/core";
import { IApiProxyOptions } from "@uns-kit/core";
import type { UnsEvents } from "@uns-kit/core";
import "@uns-kit/api";
import { type UnsProxyProcessWithApi } from "@uns-kit/api";

/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();

/**
 * Connect to the API proxy process
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host!, {processName: config.uns.processName}) as UnsProxyProcessWithApi;
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

/**
 * Register an API endpoint and event handler
 */
apiInput.get(
  "enterprise/site/area/line/",
  "line-3-furnace",
  "energy-resource",
  "main-bus",
  "summary-1",
  {
    tags: ["Tag1"],
    apiDescription: "Test API endpoint 1",
    queryParams: [
      { name: "filter", type: "string", required: true, description: "Filter za podatke" },
      { name: "limit", type: "number", required: false, description: "Koliko podatkov želiš" },
    ],
  }
);

apiInput.get(
  "enterprise/site/area/line/",
  "line-3-compressor",
  "utility-resource",
  "air-loop-1",
  "summary-2",
  {
    tags: ["Tag2"],
    apiDescription: "Test API endpoint 2",
    queryParams: [
      { name: "filter", type: "string", required: true, description: "Filter za podatke" },
      { name: "limit", type: "number", required: false, description: "Koliko podatkov želiš" },
    ],
  }
);

/**
 * Optional: register a catch-all API mapping for a topic prefix.
 * This does not create per-attribute API nodes; the controller treats it as a fallback handler.
 * You can provide a separate Swagger doc for catch-all so it stays distinct from normal APIs (optional).
 */
await apiInput.registerCatchAll("sij/acroni/#", {
  // apiBase/apiBasePath/swaggerPath are optional; defaults use this service host/port and "/api".
  // apiBase: "http://127.0.0.1:3000",
  // apiBasePath: "/api",
  apiDescription: "Catch-all handler for sij/acroni/*",
  tags: ["CatchAll"],
  queryParams: [
    { name: "topicPath", type: "string", required: true, description: "Resolved topic path" },
    { name: "filter", type: "string", required: false, description: "Filter parameter" },
  ],
  // Optional: serve a separate Swagger doc for catch-all
  // swaggerPath: "/catchall-swagger.json",
  // swaggerDoc: { ... },
});

apiInput.event.on("apiGetEvent", (event: UnsEvents["apiGetEvent"]) => {
  try {
    const appContext = event.req.appContext;
    // Add SQL query or any other code here
    event.res.send("OK");
  } catch (error) {
    event.res.status(400).send("Error");
  }    
});
