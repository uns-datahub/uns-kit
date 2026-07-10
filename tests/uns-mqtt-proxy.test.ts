import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { FakeWorker } = vi.hoisted(() => {
  class MiniEmitter {
    private listeners = new Map<string, Array<(...args: any[]) => void>>();

    on(eventName: string, handler: (...args: any[]) => void): this {
      const handlers = this.listeners.get(eventName) ?? [];
      handlers.push(handler);
      this.listeners.set(eventName, handlers);
      return this;
    }

    emit(eventName: string, ...args: any[]): boolean {
      const handlers = this.listeners.get(eventName) ?? [];
      for (const handler of handlers) {
        handler(...args);
      }
      return handlers.length > 0;
    }

    removeAllListeners(): this {
      this.listeners.clear();
      return this;
    }
  }

  class MockWorker extends MiniEmitter {
    static instances: MockWorker[] = [];
    public readonly postedMessages: any[] = [];
    public readonly terminate = vi.fn(async () => 0);

    constructor(_filename: string, _options: unknown) {
      super();
      MockWorker.instances.push(this);
    }

    postMessage(message: any): void {
      this.postedMessages.push(message);
    }
  }

  return { FakeWorker: MockWorker };
});

vi.mock("worker_threads", () => ({
  Worker: FakeWorker,
}));

import UnsMqttProxy from "../packages/uns-core/src/uns-mqtt/uns-mqtt-proxy.js";

const getLastWorker = (): InstanceType<typeof FakeWorker> => {
  const worker = FakeWorker.instances.at(-1);
  if (!worker) {
    throw new Error("Expected fake worker instance to exist.");
  }
  return worker;
};

describe("UnsMqttProxy publish drain contract", () => {
  afterEach(async () => {
    const workers = [...FakeWorker.instances];
    FakeWorker.instances.length = 0;
    for (const worker of workers) {
      worker.removeAllListeners();
    }
  });

  beforeEach(() => {
    FakeWorker.instances.length = 0;
  });

  it("rejects publishMessage immediately when the worker reports queue-full at enqueue time", async () => {
    const proxy = new UnsMqttProxy("localhost", "proc", "instance", {
      maxPendingPublishes: 2,
    });
    const worker = getLastWorker();

    const publishPromise = proxy.publishMessage("raw/data", "third");
    const enqueue = worker.postedMessages.at(-1);

    worker.emit("message", {
      command: "enqueueAccepted",
      id: enqueue.id,
      status: "error",
      error: "proc-instance - Publisher queue is full (2).",
    });

    await expect(publishPromise).rejects.toThrow("Publisher queue is full");
    await proxy.stop({ drain: false });
  });

  it("flush waits for delayed async publish completions", async () => {
    const proxy = new UnsMqttProxy("localhost", "proc", "instance");
    const worker = getLastWorker();

    const publishPromise = proxy.publishMessage("raw/data", "payload");
    const enqueue = worker.postedMessages.at(-1);
    worker.emit("message", { command: "enqueueAccepted", id: enqueue.id, status: "accepted" });
    await publishPromise;

    const flushPromise = proxy.flush(1000);
    let settled = false;
    void flushPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    worker.emit("message", { command: "publishResult", id: enqueue.id, status: "success", topic: "raw/data" });
    await expect(flushPromise).resolves.toBeUndefined();
    await proxy.stop({ drain: false });
  });

  it("stop drains accepted publishes before terminating the worker by default", async () => {
    const proxy = new UnsMqttProxy("localhost", "proc", "instance");
    const worker = getLastWorker();

    const publishPromise = proxy.publishMessage("raw/data", "payload");
    const enqueue = worker.postedMessages.at(-1);
    worker.emit("message", { command: "enqueueAccepted", id: enqueue.id, status: "accepted" });
    await publishPromise;

    const stopPromise = proxy.stop();
    await Promise.resolve();
    expect(worker.terminate).not.toHaveBeenCalled();

    worker.emit("message", { command: "publishResult", id: enqueue.id, status: "success", topic: "raw/data" });
    await expect(stopPromise).resolves.toBeUndefined();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("emits async proxy error events for broker publish failure after acceptance and still drains", async () => {
    const proxy = new UnsMqttProxy("localhost", "proc", "instance");
    const worker = getLastWorker();
    const errorHandler = vi.fn();
    proxy.event.on("error", errorHandler);

    const publishPromise = proxy.publishMessage("raw/data", "payload");
    const enqueue = worker.postedMessages.at(-1);
    worker.emit("message", { command: "enqueueAccepted", id: enqueue.id, status: "accepted" });
    await publishPromise;

    const flushPromise = proxy.flush(1000);
    worker.emit("message", {
      command: "publishResult",
      id: enqueue.id,
      status: "error",
      topic: "raw/data",
      error: "broker rejected publish",
    });

    await expect(flushPromise).resolves.toBeUndefined();
    expect(errorHandler).toHaveBeenCalledWith({ code: 0, message: "broker rejected publish" });
    await proxy.stop({ drain: false });
  });

  it("does not hang flush when the worker exits while publishes are still pending", async () => {
    const proxy = new UnsMqttProxy("localhost", "proc", "instance");
    const worker = getLastWorker();

    const publishPromise = proxy.publishMessage("raw/data", "payload");
    const enqueue = worker.postedMessages.at(-1);
    worker.emit("message", { command: "enqueueAccepted", id: enqueue.id, status: "accepted" });
    await publishPromise;

    const flushPromise = proxy.flush(1000);
    worker.emit("exit", 1);

    await expect(flushPromise).rejects.toThrow("MQTT worker exited with code 1");
    await proxy.stop({ drain: false }).catch(() => undefined);
  });
});
