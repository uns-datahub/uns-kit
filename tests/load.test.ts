// tests/integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync, SpawnSyncReturns } from 'child_process';
import UnsProxyProcess from '../src/uns/uns-proxy-process.js';
import { UnsPacket } from '../src/uns/uns-packet.js';
import { IUnsMessage, UnsEvents } from "../src/uns/uns-interfaces.js";
import { UnsTags } from "../src/uns/uns-tags.js";
import { UnsTopics } from "../src/uns/uns-topics.js";
import UnsMqttProxy from "../src/uns-mqtt/uns-mqtt-proxy.js";

describe('Integration Tests for Message Transformation', () => {
  const mqttPort = 1883;
  const containerName = 'mosquitto-test';
  const configPath = `${process.cwd()}/tests/mosquitto-remote.conf`;
  let containerId: string;
  let uns: UnsProxyProcess;
  let inputProxy: UnsMqttProxy;
  let outputProxy: UnsMqttProxy;

  beforeAll(async () => {
    // Spawn mosquitto from podman
    spawnSync('podman', ['rm', '-f', containerName]);
    const result: SpawnSyncReturns<string> = spawnSync('podman', [
      'run', '-d', '--rm', '--name', containerName,
      '-p', `${mqttPort}:1883`,
      '-v', `${configPath}:/mosquitto/config/mosquitto.conf`,
      'eclipse-mosquitto:2.0'
    ], { encoding: 'utf-8' });

    if (result.error || result.status !== 0) {
      console.error('Podman run failed stdout:\n', result.stdout);
      console.error('Podman run failed stderr:\n', result.stderr);
      throw new Error(`Failed to start mosquitto container: ${result.stderr || result.error}`);
    }

    containerId = result.stdout.trim();
    console.log(`Mosquitto container started: ${containerId}`);

    // Create uns proxy process and two uns proxies
    uns = new UnsProxyProcess(`localhost:${mqttPort}`);

    inputProxy = await uns.createUnsMqttProxy(`localhost:${mqttPort}`, 'templateUnsRttInput', 'force', true, {
      mqttSubToTopics: ['example/#'],
      subscribeThrottlingDelay: 0,
      publishThrottlingDelay: 0
    });
    outputProxy = await uns.createUnsMqttProxy(`localhost:${mqttPort}`, 'templateUnsRttOutput', 'force', true, {
      subscribeThrottlingDelay: 0,
      publishThrottlingDelay: 0
    });

    // 4) Wait briefly for proxies to become active
    await new Promise((r) => setTimeout(r, 20000));
  }, 60000);

  afterAll(() => {
    // Stop & remove the container by ID
    if (containerId) {
      const stopRes = spawnSync('podman', ['rm', '-f', containerId], { stdio: 'inherit' });
      if (stopRes.status !== 0) {
        console.warn(`Failed to stop container ${containerId}`);
      }
    }
  });

  it('Test multiple data packets', async () => {
    // Handle input events on input proxy server
    const received: Array<{ topic: string; message: any }> = [];
    inputProxy.event.on('input', (e: UnsEvents['input']) => {
      const pkt = UnsPacket.parseMqttPacket(e.message)!;
      received.push({ topic: e.topic, message: pkt.message.data.value });
    });

    // Send data packet
    const time = UnsPacket.formatToISO8601(new Date());
    const topic: UnsTopics = "example/";
    const tags: UnsTags[] = [];
    for (let i = 0; i < 20000; i++) {
      outputProxy.publishMqttMessage({
        topic,
        asset: "",
        objectType: "equipment",
        objectId: "",
        attributes: [
          {
            attribute: "data-multi",
            description: `Number value ${i}`,
            data: { time, value: 123 + i },
            tags,
          },
        ],
      });
    }

    await new Promise((r) => setTimeout(r, 30000));

    expect(received).toHaveLength(20000);
    expect(received[0].topic).toBe('example/data-multi');
  }, {timeout:40000});  
});
