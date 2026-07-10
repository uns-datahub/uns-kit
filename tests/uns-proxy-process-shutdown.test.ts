import { describe, expect, it, vi } from "vitest";

import { UnsProxyProcess } from "../packages/uns-core/src/uns/uns-proxy-process.js";

type ProxyStop = { stop: ReturnType<typeof vi.fn> };

function createProcessForShutdown(proxyStops: ProxyStop[], processMqttStop = vi.fn(async () => undefined)) {
  const process = Object.create(UnsProxyProcess.prototype) as any;
  process.processName = "test-process";
  process.shutdownPromise = null;
  process.statusMonitor = { stop: vi.fn() };
  process.mqttInputHandler = undefined;
  process.unsMqttProxies = proxyStops;
  process.processMqttProxy = {
    event: { off: vi.fn() },
    stop: processMqttStop,
  };
  return { process: process as UnsProxyProcess, processMqttStop };
}

describe("UnsProxyProcess shutdown", () => {
  it("attempts every cleanup and propagates child drain failures", async () => {
    const drainFailure = new Error("publisher drain timed out");
    const firstProxy = { stop: vi.fn(async () => { throw drainFailure; }) };
    const secondProxy = { stop: vi.fn(async () => undefined) };
    const { process, processMqttStop } = createProcessForShutdown([firstProxy, secondProxy]);

    const shutdownError = await process.shutdown().catch((error) => error);

    expect(shutdownError).toBeInstanceOf(AggregateError);
    expect((shutdownError as AggregateError).errors).toContain(drainFailure);
    expect(firstProxy.stop).toHaveBeenCalledOnce();
    expect(secondProxy.stop).toHaveBeenCalledOnce();
    expect(processMqttStop).toHaveBeenCalledOnce();
  });

  it("is idempotent and runs cleanup only once", async () => {
    let finishStop!: () => void;
    const proxyStop = vi.fn(() => new Promise<void>((resolve) => {
      finishStop = resolve;
    }));
    const { process, processMqttStop } = createProcessForShutdown([{ stop: proxyStop }]);

    const firstShutdown = process.shutdown();
    const secondShutdown = process.shutdown();

    expect(secondShutdown).toBe(firstShutdown);
    finishStop();
    await expect(firstShutdown).resolves.toBeUndefined();
    await expect(process.shutdown()).resolves.toBeUndefined();
    expect(proxyStop).toHaveBeenCalledOnce();
    expect(processMqttStop).toHaveBeenCalledOnce();
  });
});
