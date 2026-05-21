#!/usr/bin/env node
import { main } from "./sync-uns-metadata.js";

main().catch((error) => {
  console.error("Failed to refresh UNS metadata:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
