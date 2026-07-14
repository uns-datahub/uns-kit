#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const packagePaths = fs.readdirSync(path.join(root, "packages"))
  .map((directory) => path.join(root, "packages", directory, "package.json"))
  .filter((packagePath) => fs.existsSync(packagePath));
const packages = packagePaths.map(readJson)
  .filter((pkg) => typeof pkg.name === "string" && pkg.name.startsWith("@uns-kit/"));
const versions = new Set(packages.map((pkg) => pkg.version));

if (versions.size !== 1) {
  throw new Error(`Expected one shared @uns-kit package version, found: ${[...versions].join(", ")}.`);
}

const cliPackage = packages.find((pkg) => pkg.name === "@uns-kit/cli");
if (!cliPackage) throw new Error("Could not find @uns-kit/cli package manifest.");

const expectedPins = new Map(
  packages
    .filter((pkg) => pkg.name !== "@uns-kit/cli")
    .map((pkg) => [pkg.name, pkg.version]),
);
const actualPins = cliPackage.unsKitPackages ?? {};
const mismatches = [...expectedPins].filter(([name, version]) => actualPins[name] !== version);
const unexpectedPins = Object.keys(actualPins).filter((name) => !expectedPins.has(name));

if (mismatches.length || unexpectedPins.length) {
  const details = [
    ...mismatches.map(([name, version]) => `${name}: expected ${version}, got ${actualPins[name] ?? "missing"}`),
    ...unexpectedPins.map((name) => `${name}: unexpected CLI pin ${actualPins[name]}`),
  ];
  throw new Error(`@uns-kit/cli unsKitPackages are out of sync:\n${details.join("\n")}`);
}

console.log(`Verified ${packages.length} @uns-kit packages at ${[...versions][0]}.`);
