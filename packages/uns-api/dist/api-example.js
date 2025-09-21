import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import unsApiPlugin from "./uns-api-plugin";
import { ConfigFile } from "@uns-kit/core/config-file";
/**
 * Load the configuration from a file.
 * On the server, this file is provided by the `uns-datahub-controller`.
 * In the development environment, you are responsible for creating and maintaining this file and its contents.
 */
const config = await ConfigFile.loadConfig();
/**
 * Connect to the API proxy process
 */
const unsProxyProcess = new UnsProxyProcess(config.infra.host, { processName: config.uns.processName });
unsApiPlugin;
const apiOptions = config.uns?.jwksWellKnownUrl
    ? {
        jwks: {
            wellKnownJwksUrl: config.uns.jwksWellKnownUrl,
            activeKidUrl: config.uns.kidWellKnownUrl,
        },
    }
    : {
        jwtSecret: "CHANGEME",
    };
const apiInput = await unsProxyProcess.createApiProxy("templateUnsApiInput", apiOptions);
/**
 * Register an API endpoint and event handler
 */
apiInput.get("sij/", "summary-1", {
    tags: ["Tag1"],
    apiDescription: "Test API endpoint 1",
    queryParams: [
        { name: "filter", type: "string", required: true, description: "Filter za podatke" },
        { name: "limit", type: "number", required: false, description: "Koliko podatkov želiš" },
    ]
});
apiInput.get("sij/", "summary-2", {
    tags: ["Tag2"],
    apiDescription: "Test API endpoint 2",
    queryParams: [
        { name: "filter", type: "string", required: true, description: "Filter za podatke" },
        { name: "limit", type: "number", required: false, description: "Koliko podatkov želiš" },
    ]
});
apiInput.event.on("apiGetEvent", (event) => {
    try {
        const appContext = event.req.appContext;
        // Add SQL query or any other code here
        event.res.send("OK");
    }
    catch (error) {
        event.res.status(400).send("Error");
    }
});
