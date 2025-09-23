import { ConfigFile, UnsProxyProcess, logger } from "@uns-kit/core";

async function main(): Promise<void> {
  const config = await ConfigFile.loadConfig("./demo-config.json");

  const process = new UnsProxyProcess(config.infra.host!, {
    processName: config.uns.processName ?? "uns-demo"
  });

  logger.info("UNS demo process started. Add your test logic in src/index.ts.");

  // TODO: add demo pipelines, plugin wiring, etc.
  void process;
}

void main().catch(error => {
  logger.error("Demo process failed", error);
  process.exit(1);
});
