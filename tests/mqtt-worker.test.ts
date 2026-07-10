import { beforeEach, describe, expect, it, vi } from "vitest";

const { parentPortMock, MqttProxyMock } = vi.hoisted(() => {
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

  const parentPort = new MiniEmitter() as MiniEmitter & {
    postMessage: ReturnType<typeof vi.fn>;
  };
  parentPort.postMessage = vi.fn();

  class MockMqttProxy {
    public event = new MiniEmitter();
    public start = vi.fn();
    public publish = vi.fn(async () => undefined);
    public subscribeAsync = vi.fn();
    public unsubscribeAsync = vi.fn();
  }

  return {
    parentPortMock: parentPort,
    MqttProxyMock: MockMqttProxy,
  };
});

vi.mock("worker_threads", () => ({
  parentPort: parentPortMock,
}));

vi.mock("../packages/uns-core/src/uns-mqtt/mqtt-proxy.js", () => ({
  default: MqttProxyMock,
}));

import { MqttWorker } from "../packages/uns-core/src/uns-mqtt/mqtt-worker.js";

describe("MqttWorker publish acceptance", () => {
  beforeEach(() => {
    parentPortMock.removeAllListeners();
    parentPortMock.postMessage.mockReset();
  });

  it("posts enqueueAccepted only after local queue acceptance succeeds", async () => {
    const worker = new MqttWorker({
      mqttHost: "localhost",
      instanceNameWithSuffix: "test-worker",
      publisherActive: true,
      subscriberActive: true,
    });

    (worker as any).publisher = {
      enqueueOrThrow: vi.fn(() => Promise.resolve()),
      becomeActive: vi.fn(),
      becomePassive: vi.fn(),
      getState: vi.fn(() => true),
    };

    parentPortMock.emit("message", {
      command: "enqueue",
      id: "accepted-1",
      topic: "raw/data",
      message: "payload",
    });

    await Promise.resolve();

    expect(parentPortMock.postMessage.mock.calls).toEqual([
      [{ command: "enqueueAccepted", id: "accepted-1", status: "accepted" }],
      [{ command: "publishResult", id: "accepted-1", status: "success", topic: "raw/data" }],
    ]);
  });

  it("reports queue-full without posting enqueueAccepted success first", async () => {
    const worker = new MqttWorker({
      mqttHost: "localhost",
      instanceNameWithSuffix: "test-worker",
      publisherActive: true,
      subscriberActive: true,
    });

    (worker as any).publisher = {
      enqueueOrThrow: vi.fn(() => {
        throw new Error("test-worker - Publisher queue is full (2).");
      }),
      becomeActive: vi.fn(),
      becomePassive: vi.fn(),
      getState: vi.fn(() => true),
    };

    parentPortMock.emit("message", {
      command: "enqueue",
      id: "rejected-1",
      topic: "raw/data",
      message: "payload",
    });

    expect(parentPortMock.postMessage.mock.calls).toEqual([
      [{
        command: "enqueueAccepted",
        id: "rejected-1",
        status: "error",
        error: "test-worker - Publisher queue is full (2).",
      }],
    ]);
  });
});
