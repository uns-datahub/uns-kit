import { ConfigFile, UnsProxyProcess } from "@uns-kit/core";
import type { ISO8601 } from "@uns-kit/core/uns/uns-interfaces.js";

let activeProcess: UnsProxyProcess | undefined;

async function main(): Promise<void> {
  const config = await ConfigFile.loadConfig();
  const processName = config.uns.processName ?? "__APP_NAME__";
  const unsProcess = new UnsProxyProcess(config.infra.host ?? "localhost", {
    processName,
  });
  activeProcess = unsProcess;
  const shutdown = (signal: NodeJS.Signals): void => {
    console.log(`Received ${signal}; shutting down UNS process '${processName}'.`);
    void unsProcess.shutdown().catch((error: unknown) => {
      const reason = error instanceof Error ? error : new Error(String(error));
      console.error(`UNS process '${processName}' shutdown failed: ${reason.message}`);
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

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

  console.log(`UNS process '${processName}' is ready. Edit src/index.ts to add your logic.`);
}

void main().catch(async (error: unknown) => {
  const reason = error instanceof Error ? error : new Error(String(error));
  try {
    await activeProcess?.shutdown();
  } catch (shutdownError) {
    const shutdownReason = shutdownError instanceof Error ? shutdownError : new Error(String(shutdownError));
    console.error(`UNS process cleanup failed: ${shutdownReason.message}`);
  }
  console.error(`UNS process startup failed: ${reason.message}`);
  process.exitCode = 1;
});
