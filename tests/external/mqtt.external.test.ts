import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { connect, createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import UnsMqttProxy from "../../packages/uns-core/src/uns-mqtt/uns-mqtt-proxy.js";
import type { UnsEvents } from "../../packages/uns-core/src/uns/uns-interfaces.js";
import { UnsPacket } from "../../packages/uns-core/src/uns/uns-packet.js";

const podmanReady = spawnSync("podman", ["info"], { stdio: "ignore" }).status === 0;
const runLoadTest = process.env["UNS_KIT_RUN_LOAD_TEST"] === "1";
const containerName = `uns-kit-mqtt-test-${process.pid}`;
const configPath = fileURLToPath(new URL("../mosquitto-remote.conf", import.meta.url));

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function reserveTcpPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to reserve a TCP port for the Mosquitto test container.");
  }
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForTcpPort(port: number, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise<boolean>((resolve) => {
      const socket = connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (connected) return;
    await delay(100);
  }
  throw new Error(`Mosquitto did not become reachable on port ${port} within ${timeoutMs}ms.`);
}

function startMosquitto(port: number): string {
  const result: SpawnSyncReturns<string> = spawnSync(
    "podman",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      containerName,
      "--publish",
      `127.0.0.1:${port}:1883`,
      "--volume",
      `${configPath}:/mosquitto/config/mosquitto.conf:ro`,
      "eclipse-mosquitto:2.0",
    ],
    { encoding: "utf8" },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`Failed to start isolated Mosquitto container: ${result.stderr || result.error}`);
  }
  return result.stdout.trim();
}

function waitForMessages(inputProxy: UnsMqttProxy, expectedCount: number, timeoutMs: number) {
  return new Promise<Array<{ topic: string; value: unknown }>>((resolve, reject) => {
    const received: Array<{ topic: string; value: unknown }> = [];
    const timeout = setTimeout(() => {
      inputProxy.event.off("input", onInput);
      reject(new Error(`Received ${received.length}/${expectedCount} MQTT messages within ${timeoutMs}ms.`));
    }, timeoutMs);
    const onInput = (event: UnsEvents["input"]) => {
      const packet = UnsPacket.parseMqttPacket(event.message);
      received.push({ topic: event.topic, value: packet?.message.data?.value });
      if (received.length === expectedCount) {
        clearTimeout(timeout);
        inputProxy.event.off("input", onInput);
        resolve(received);
      }
    };
    inputProxy.event.on("input", onInput);
  });
}

describe.skipIf(!podmanReady)("MQTT transformation (external)", () => {
  let mqttPort = 0;
  let containerId = "";
  let inputProxy: UnsMqttProxy;
  let outputProxy: UnsMqttProxy;

  beforeAll(async () => {
    mqttPort = await reserveTcpPort();
    containerId = startMosquitto(mqttPort);
    await waitForTcpPort(mqttPort);

    inputProxy = new UnsMqttProxy(
      "127.0.0.1",
      "uns-kit-external-test",
      "input",
      {
        clientId: `uns-kit-external-input-${process.pid}`,
        mqttSubToTopics: ["example/#"],
        port: mqttPort,
        publishThrottlingDelay: 0,
        subscribeThrottlingDelay: 0,
      },
      false,
      true,
    );
    outputProxy = new UnsMqttProxy(
      "127.0.0.1",
      "uns-kit-external-test",
      "output",
      {
        clientId: `uns-kit-external-output-${process.pid}`,
        port: mqttPort,
        publishThrottlingDelay: 0,
        subscribeThrottlingDelay: 0,
      },
      true,
      false,
    );

    // Give the worker-owned clients time to connect and establish the subscription.
    await delay(500);
  }, 30_000);

  afterAll(async () => {
    await Promise.allSettled([inputProxy?.stop({ drain: true, timeoutMs: 10_000 }), outputProxy?.stop({ drain: true, timeoutMs: 10_000 })]);
    if (containerId) {
      spawnSync("podman", ["rm", "--force", containerId], { stdio: "ignore" });
    }
  });

  it("publishes and receives a transformed data packet", async () => {
    const receivedPromise = waitForMessages(inputProxy, 1, 10_000);
    const time = UnsPacket.formatToISO8601(new Date());

    await outputProxy.publishMqttMessage({
      topic: "example/",
      asset: "",
      objectType: "equipment",
      objectId: "main",
      attributes: {
        attribute: "data-single",
        description: "Number value",
        data: { time, value: 123 },
        tags: [],
      },
    });
    await outputProxy.flush(10_000);

    await expect(receivedPromise).resolves.toEqual([{ topic: "example/equipment/main/data-single", value: 123 }]);
  });

  it.skipIf(!runLoadTest)(
    "publishes 20,000 transformed data packets",
    async () => {
      const messageCount = 20_000;
      const receivedPromise = waitForMessages(inputProxy, messageCount, 90_000);
      const time = UnsPacket.formatToISO8601(new Date());

      for (let index = 0; index < messageCount; index += 1) {
        await outputProxy.publishMqttMessage({
          topic: "example/",
          asset: "",
          objectType: "equipment",
          objectId: "main",
          attributes: {
            attribute: "data-multi",
            description: `Number value ${index}`,
            data: { time, value: 123 + index },
            tags: [],
          },
        });
      }
      await outputProxy.flush(90_000);

      const received = await receivedPromise;
      expect(received).toHaveLength(messageCount);
      expect(received[0]?.topic).toBe("example/equipment/main/data-multi");
    },
    120_000,
  );
});
