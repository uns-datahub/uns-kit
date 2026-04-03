import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggerMock, connectMock } = vi.hoisted(() => ({
  loggerMock: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  connectMock: vi.fn(),
}));

vi.mock("../packages/uns-core/src/logger.js", () => ({
  default: loggerMock,
}));

vi.mock("mqtt", () => ({
  default: {
    connect: connectMock,
  },
  connect: connectMock,
}));

import MqttProxy, { formatMqttError } from "../packages/uns-core/src/uns-mqtt/mqtt-proxy.ts";

class FakeMqttClient extends EventEmitter {
  public connected = false;
  public stream = { setMaxListeners: vi.fn() };
  public subscribe = vi.fn();
  public publish = vi.fn((_topic: string, _message: string | Buffer, _options: unknown, callback?: (error?: Error | null) => void) => callback?.());
  public end = vi.fn((_force?: boolean, callback?: () => void) => callback?.());
}

const getMessages = (mockFn: { mock: { calls: unknown[][] } }): string[] => mockFn.mock.calls.map(([message]) => String(message));

describe("MqttProxy logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMock.mockReset();
  });

  it("formats aggregate MQTT startup errors with useful connection details", () => {
    const connectionError = Object.assign(new Error(""), {
      code: "ECONNREFUSED",
      address: "127.0.0.1",
      port: 1883,
    });
    const aggregateError = new AggregateError([connectionError], "");
    const errorInfo = formatMqttError(aggregateError);

    expect(errorInfo.code).toBe("ECONNREFUSED");
    expect(errorInfo.message).toContain("ECONNREFUSED");
    expect(errorInfo.message).toContain("127.0.0.1:1883");
    expect(errorInfo.message).not.toBe("Unknown MQTT error");
  });

  it("does not log disconnect lifecycle messages when stop runs before any connection was established", () => {
    const proxy = new MqttProxy("127.0.0.1", "controller-cluster", { statusTopic: "" });
    const client = new FakeMqttClient();
    (proxy as any).mqttClient = client;

    proxy.stop();

    const debugMessages = getMessages(loggerMock.debug);
    expect(debugMessages.some((message) => message.includes("Disconnecting from MQTT broker"))).toBe(false);
    expect(debugMessages.some((message) => message.includes("Disconnected from MQTT broker"))).toBe(false);
  });

  it("keeps retry cleanup quiet even after a previous successful connection", () => {
    const proxy = new MqttProxy("127.0.0.1", "controller-cluster", { statusTopic: "" });
    const client = new FakeMqttClient();
    (proxy as any).mqttClient = client;
    (proxy as any).hasEstablishedConnection = true;

    proxy.stop({ reason: "retry" });

    const debugMessages = getMessages(loggerMock.debug);
    expect(debugMessages.some((message) => message.includes("Disconnecting from MQTT broker"))).toBe(false);
    expect(debugMessages.some((message) => message.includes("Disconnected from MQTT broker"))).toBe(false);
  });

  it("still exposes disconnect lifecycle logs for real connected-session shutdowns", () => {
    const proxy = new MqttProxy("127.0.0.1", "controller-cluster", { statusTopic: "" });
    const client = new FakeMqttClient();
    (proxy as any).mqttClient = client;
    (proxy as any).hasEstablishedConnection = true;

    proxy.stop({ reason: "shutdown" });

    const debugMessages = getMessages(loggerMock.debug);
    expect(debugMessages).toContain("controller-cluster - Disconnecting from MQTT broker...");
    expect(debugMessages).toContain("controller-cluster - Disconnected from MQTT broker.");
  });

  it("restores isConnected on reconnect without duplicating subscribe or interval setup", async () => {
    const client = new FakeMqttClient();
    connectMock.mockReturnValue(client);
    let proxy: MqttProxy | undefined;

    try {
      proxy = new MqttProxy("127.0.0.1", "controller-cluster", {
        statusTopic: "uns-infra/test/controller/",
        mqttSubToTopics: ["sensors/#"],
      });

      const startPromise = proxy.start();
      (proxy as any).handleMqttConnect();
      await startPromise;

      expect(proxy.isConnected).toBe(true);
      const statusInterval = (proxy as any).statusUpdateInterval;
      const statsInterval = (proxy as any).transformationStatsInterval;
      const subscribeLogs = loggerMock.debug.mock.calls
        .map(([message]) => String(message))
        .filter((message) => message.includes("Subscribed to 1 topics."));
      expect(subscribeLogs).toHaveLength(1);

      proxy.isConnected = false;
      expect(proxy.isConnected).toBe(false);

      (proxy as any).handleMqttConnect();
      expect(proxy.isConnected).toBe(true);
      expect((proxy as any).statusUpdateInterval).toBe(statusInterval);
      expect((proxy as any).transformationStatsInterval).toBe(statsInterval);
      expect(
        loggerMock.debug.mock.calls
          .map(([message]) => String(message))
          .filter((message) => message.includes("Subscribed to 1 topics.")),
      ).toHaveLength(1);
    } finally {
      await proxy?.stop({ reason: "shutdown" });
    }
  });
});

describe("formatMqttError", () => {
  it("falls back to a stable message instead of returning a blank string", () => {
    expect(formatMqttError(new Error("")).message).toBe("Error");
    expect(formatMqttError(undefined).message).toBe("Unknown MQTT error");
  });
});
