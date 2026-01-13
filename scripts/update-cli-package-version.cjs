#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");

const packageJsonPath = path.resolve(process.cwd(), "package.json");
const cliPkgPath = path.resolve(__dirname, "../packages/uns-cli/package.json");

const pkg = readJson(packageJsonPath);
const pkgName = pkg.name;
const pkgVersion = pkg.version;
if (!pkgName || !pkgVersion) {
  throw new Error(`Could not read package name/version from ${packageJsonPath}.`);
}

if (!pkgName.startsWith("@uns-kit/")) {
  throw new Error(`Refusing to update unsKitPackages for non-UNS package: ${pkgName}.`);
}

const cliPkg = readJson(cliPkgPath);
const unsKitPackages = (cliPkg.unsKitPackages ??= {});

if (unsKitPackages[pkgName] === pkgVersion) {
  console.log(`@uns-kit/cli already pins ${pkgName} to ${pkgVersion}.`);
  process.exit(0);
}

unsKitPackages[pkgName] = pkgVersion;
writeJson(cliPkgPath, cliPkg);
console.log(`Updated @uns-kit/cli unsKitPackages["${pkgName}"] -> ${pkgVersion}`);
