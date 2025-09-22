#!/usr/bin/env node
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const coreVersion = resolveCoreVersion();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "create") {
    const projectName = args[1];
    if (!projectName) {
      console.error("Missing project name. Example: uns-kit create my-app");
      process.exitCode = 1;
      return;
    }

    try {
      await createProject(projectName);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

function printHelp(): void {
  console.log(`\nUsage: uns-kit <command> [options]\n\nCommands:\n  create <name>   Scaffold a new UNS application\n  help            Show this message\n`);
}

async function createProject(projectName: string): Promise<void> {
  const targetDir = path.resolve(process.cwd(), projectName);
  await ensureTargetDir(targetDir);

  const templateDir = path.resolve(__dirname, "../templates/default");
  await cp(templateDir, targetDir, { recursive: true, force: false });

  const pkgName = normalizePackageName(projectName);
  await patchPackageJson(targetDir, pkgName);
  await patchConfigJson(targetDir, pkgName);
  await replacePlaceholders(targetDir, pkgName);

  console.log(`\nCreated ${pkgName} in ${path.relative(process.cwd(), targetDir)}`);
  console.log("Next steps:");
  console.log(`  cd ${projectName}`);
  console.log("  pnpm install");
  console.log("  pnpm run dev");
}

async function ensureTargetDir(dir: string): Promise<void> {
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`Path ${dir} exists and is not a directory.`);
    }
    const entries = await readdir(dir);
    if (entries.length > 0) {
      throw new Error(`Directory ${dir} is not empty.`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dir, { recursive: true });
      return;
    }
    throw error;
  }
}

async function patchPackageJson(targetDir: string, packageName: string): Promise<void> {
  const pkgFile = path.join(targetDir, "package.json");
  const raw = await readFile(pkgFile, "utf8");
  const pkg = JSON.parse(raw);
  pkg.name = packageName;

  if (pkg.dependencies && pkg.dependencies["@uns-kit/core"]) {
    pkg.dependencies["@uns-kit/core"] = `^${coreVersion}`;
  }

  await writeFile(pkgFile, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

async function patchConfigJson(targetDir: string, packageName: string): Promise<void> {
  const configFile = path.join(targetDir, "config.json");

  try {
    const raw = await readFile(configFile, "utf8");
    const config = JSON.parse(raw);
    if (config.uns && typeof config.uns === "object") {
      config.uns.processName = packageName;
    }
    await writeFile(configFile, JSON.stringify(config, null, 2) + "\n", "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function replacePlaceholders(targetDir: string, packageName: string): Promise<void> {
  const replacements: Record<string, string> = {
    __APP_NAME__: packageName
  };

  const filesToUpdate = [
    path.join(targetDir, "README.md"),
    path.join(targetDir, "src/index.ts"),
    path.join(targetDir, "config.json")
  ];

  for (const file of filesToUpdate) {
    try {
      await access(file);
      let content = await readFile(file, "utf8");
      for (const [placeholder, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(placeholder, "g"), value);
      }
      await writeFile(file, content, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function normalizePackageName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) {
    return trimmed;
  }
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "uns-app";
}

function resolveCoreVersion(): string {
  try {
    const corePkg = require("@uns-kit/core/package.json") as { version?: string };
    if (corePkg?.version) {
      return corePkg.version;
    }
  } catch (error) {
    // Ignore and try local path
  }

  try {
    const localPath = path.resolve(__dirname, "../../uns-core/package.json");
    const raw = require(localPath) as { version?: string };
    if (raw?.version) {
      return raw.version;
    }
  } catch (error) {
    // Ignore
  }

  return "0.0.1";
}

void main();
