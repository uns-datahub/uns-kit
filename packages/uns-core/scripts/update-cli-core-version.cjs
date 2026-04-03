#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const corePkgPath = path.resolve(__dirname, "../package.json");
const cliPkgPath = path.resolve(__dirname, "../../uns-cli/package.json");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");

const corePkg = readJson(corePkgPath);
const coreVersion = corePkg.version;
if (!coreVersion) {
  throw new Error("Could not read @uns-kit/core version from package.json.");
}

const cliPkg = readJson(cliPkgPath);
const unsKitPackages = (cliPkg.unsKitPackages ??= {});

if (unsKitPackages["@uns-kit/core"] === coreVersion) {
  console.log(`@uns-kit/cli already pins @uns-kit/core to ${coreVersion}.`);
  process.exit(0);
}

unsKitPackages["@uns-kit/core"] = coreVersion;
writeJson(cliPkgPath, cliPkg);
console.log(`Updated @uns-kit/cli unsKitPackages["@uns-kit/core"] -> ${coreVersion}`);
