import { afterEach, describe, expect, it } from "vitest";
import UnsApiProxy from "../packages/uns-api/src/uns-api-proxy.js";

const waitForListening = async (proxy: any): Promise<void> => {
  while (!proxy.app.server.listening) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const closeProxy = async (proxy: any): Promise<void> => {
  await proxy.stop();
  if (proxy.app?.server?.listening) {
    await new Promise<void>((resolve, reject) => {
      proxy.app.server.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
};

describe("UnsApiProxy path generation", () => {
  const proxies: any[] = [];

  afterEach(async () => {
    while (proxies.length > 0) {
      await closeProxy(proxies.pop());
    }
  });

  it("registers distinct Express and Swagger paths for different assets and unregisters by the same identity", async () => {
    const proxy: any = new UnsApiProxy("rtt-demo-app", "rttDemoApi", {});
    proxies.push(proxy);
    await waitForListening(proxy);

    await proxy.get(
      "sij/acroni/vv/" as any,
      "tp-1" as any,
      "energy-resource" as any,
      "main" as any,
      "power" as any,
      { apiDescription: "tp-1 power" },
    );
    await proxy.get(
      "sij/acroni/vv/" as any,
      "tp-2" as any,
      "energy-resource" as any,
      "main" as any,
      "power" as any,
      { apiDescription: "tp-2 power" },
    );
    await proxy.get(
      "sij/acroni/vv/" as any,
      "tp-1" as any,
      "utility-resource" as any,
      "outside" as any,
      "temperature" as any,
      { apiDescription: "tp-1 temperature" },
    );
    await proxy.get(
      "sij/acroni/vv/" as any,
      "tp-2" as any,
      "utility-resource" as any,
      "outside" as any,
      "temperature" as any,
      { apiDescription: "tp-2 temperature" },
    );

    const registeredRoutePaths = proxy.app.router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);

    expect(registeredRoutePaths).toEqual(expect.arrayContaining([
      "/sij/acroni/vv/tp-1/energy-resource/main/power",
      "/sij/acroni/vv/tp-2/energy-resource/main/power",
      "/sij/acroni/vv/tp-1/utility-resource/outside/temperature",
      "/sij/acroni/vv/tp-2/utility-resource/outside/temperature",
    ]));

    expect(proxy.app.swaggerSpec.paths["/api/sij/acroni/vv/tp-1/energy-resource/main/power"]?.get?.summary).toBe("tp-1 power");
    expect(proxy.app.swaggerSpec.paths["/api/sij/acroni/vv/tp-2/energy-resource/main/power"]?.get?.summary).toBe("tp-2 power");
    expect(proxy.app.swaggerSpec.paths["/api/sij/acroni/vv/tp-1/utility-resource/outside/temperature"]?.get?.summary).toBe("tp-1 temperature");
    expect(proxy.app.swaggerSpec.paths["/api/sij/acroni/vv/tp-2/utility-resource/outside/temperature"]?.get?.summary).toBe("tp-2 temperature");

    expect(proxy.producedApiEndpoints.has("sij/acroni/vv/tp-1/energy-resource/main/power")).toBe(true);
    expect(proxy.producedApiEndpoints.has("sij/acroni/vv/tp-2/energy-resource/main/power")).toBe(true);
    expect(proxy.producedApiEndpoints.has("sij/acroni/vv/tp-1/utility-resource/outside/temperature")).toBe(true);
    expect(proxy.producedApiEndpoints.has("sij/acroni/vv/tp-2/utility-resource/outside/temperature")).toBe(true);

    await proxy.unregister(
      "sij/acroni/vv/" as any,
      "tp-1" as any,
      "energy-resource" as any,
      "main" as any,
      "power" as any,
      "GET",
    );

    expect(proxy.app.swaggerSpec.paths["/api/sij/acroni/vv/tp-1/energy-resource/main/power"]).toBeUndefined();
    expect(proxy.app.swaggerSpec.paths["/api/sij/acroni/vv/tp-2/energy-resource/main/power"]?.get?.summary).toBe("tp-2 power");
    expect(proxy.producedApiEndpoints.has("sij/acroni/vv/tp-1/energy-resource/main/power")).toBe(false);
    expect(proxy.producedApiEndpoints.has("sij/acroni/vv/tp-2/energy-resource/main/power")).toBe(true);
  });
});
