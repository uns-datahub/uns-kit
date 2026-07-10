import { ConfigFile, UnsProxyProcess } from "@uns-kit/core";
import type { ISO8601 } from "@uns-kit/core/uns/uns-interfaces.js";

async function main(): Promise<void> {
  const config = await ConfigFile.loadConfig();
  const processName = config.uns.processName ?? "__APP_NAME__";
  const unsProcess = new UnsProxyProcess(config.infra.host ?? "localhost", {
    processName,
  });

  const mqttOutput = await unsProcess.createUnsMqttProxy(
    config.output?.host ?? "localhost",
    "defaultOutput",
    config.uns.instanceMode ?? "wait",
    config.uns.handover ?? true,
  );

  const time = new Date().toISOString() as ISO8601;

  await mqttOutput.publishMqttMessage({
    topic: "example/site/area/line/",
    asset: "demo-asset",
    objectType: "utility-resource",
    objectId: "main",
    attributes: {
      attribute: "status",
      description: "Service startup marker",
      data: {
        time,
        value: "started",
        dataGroup: "runtime",
      },
      validityMode: "lifecycle",
      lifecycleEndValue: "stopped",
    },
  });

  await mqttOutput.flush();
  await mqttOutput.stop();
  await unsProcess.shutdown();

  console.log(`UNS process '${processName}' is ready. Edit src/index.ts to add your logic.`);
}

void main();
