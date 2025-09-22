import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";

async function main(): Promise<void> {
  const name = "sandbox-app";
  const process = new UnsProxyProcess("localhost:1883", {
    processName: name,
  });

  console.log(`UNS process '${name}' is ready. Edit src/index.ts to add your logic.`);

  // Keep the process alive or add plugin logic here
  void process;
}

void main();
