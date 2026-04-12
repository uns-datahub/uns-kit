import { UnsProxyProcess } from "@uns-kit/core";

async function main(): Promise<void> {
  const name = "__APP_NAME__";
  const process = new UnsProxyProcess("localhost:1883", {
    processName: name,
  });

  const proxy = await process.createMqttProxy("ts-output");

  await proxy.publishMqttMessage({
    topic: "example/site/area/line/",
    asset: "demo-asset",
    objectType: "utility-resource",
    objectId: "main",
    attributes: {
      attribute: "status",
      description: "Service startup marker",
      data: {
        time: new Date().toISOString(),
        value: "started",
        uom: "state",
        dataGroup: "runtime",
      },
      validityMode: "lifecycle",
      lifecycleEndValue: "stopped",
    },
  });

  console.log(`UNS process '${name}' is ready. Edit src/index.ts to add your logic.`);
}

void main();
