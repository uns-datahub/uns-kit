#!/usr/bin/env node
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";
import readline from "node:readline/promises";

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

  if (command === "configure-devops") {
    const targetPath = args[1];
    try {
      await configureDevops(targetPath);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
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
  console.log(`\nUsage: uns-kit <command> [options]\n\nCommands:\n  create <name>           Scaffold a new UNS application\n  configure-devops [dir]  Configure Azure DevOps tooling in an existing project\n  help                    Show this message\n`);
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

async function configureDevops(targetPath?: string): Promise<void> {
  const targetDir = path.resolve(process.cwd(), targetPath ?? ".");
  const packagePath = path.join(targetDir, "package.json");
  const configPath = path.join(targetDir, "config.json");

  let pkgRaw: string;
  try {
    pkgRaw = await readFile(packagePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Could not find package.json in ${targetDir}`);
    }
    throw error;
  }

  let configRaw: string;
  try {
    configRaw = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Could not find config.json in ${targetDir}`);
    }
    throw error;
  }

  const pkg = JSON.parse(pkgRaw) as {
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    scripts?: Record<string, string>;
    [key: string]: unknown;
  };
  const config = JSON.parse(configRaw) as {
    devops?: { organization?: string };
    [key: string]: unknown;
  };

  const defaultOrg = config.devops?.organization ?? "sijit";
  const answer = (await promptQuestion(`Azure DevOps organization [${defaultOrg}]: `)).trim();
  const organization = answer || defaultOrg;

  if (!config.devops || typeof config.devops !== "object") {
    config.devops = {};
  }
  config.devops.organization = organization;

  const requiredDevDeps: Record<string, string> = {
    "azure-devops-node-api": "^15.1.0",
    "simple-git": "^3.27.0",
    "chalk": "^5.4.1",
    "prettier": "^3.5.3"
  };

  let pkgChanged = false;
  const devDeps = (pkg.devDependencies ??= {});
  const deps = pkg.dependencies ?? {};

  for (const [name, version] of Object.entries(requiredDevDeps)) {
    if (!devDeps[name] && !deps[name]) {
      devDeps[name] = version;
      pkgChanged = true;
    }
  }

  const scripts = (pkg.scripts ??= {});
  if (!scripts["pull-request"]) {
    scripts["pull-request"] = "node ./node_modules/@uns-kit/core/dist/tools/pull-request.js";
    pkgChanged = true;
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  if (pkgChanged) {
    await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }

  console.log(`\nDevOps tooling configured.`);
  console.log(`  Azure organization: ${organization}`);
  if (pkgChanged) {
    console.log("  Updated package.json scripts/devDependencies. Run pnpm install to fetch new packages.");
  } else {
    console.log("  Existing package.json already contained required entries.");
  }
}

async function promptQuestion(message: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(message);
  } finally {
    rl.close();
  }
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
  const attempt = (factory: () => string | undefined): string | undefined => {
    try {
      return factory();
    } catch (error) {
      return undefined;
    }
  };

  const directVersion = attempt(() => {
    const pkg = require("@uns-kit/core/package.json") as { version?: string };
    return pkg?.version;
  });
  if (directVersion) {
    return directVersion;
  }

  const workspaceVersion = attempt(() => {
    const localPath = path.resolve(__dirname, "../../uns-core/package.json");
    const pkg = require(localPath) as { version?: string };
    return pkg?.version;
  });
  if (workspaceVersion) {
    return workspaceVersion;
  }

  const dependencyVersion = attempt(() => {
    const cliPkg = require("../package.json") as {
      dependencies?: Record<string, string>;
    };
    const range = cliPkg.dependencies?.["@uns-kit/core"];
    if (typeof range === "string") {
      const match = range.match(/\d+\.\d+\.\d+/);
      return match?.[0];
    }
    return undefined;
  });
  if (dependencyVersion) {
    return dependencyVersion;
  }

  return "0.0.1";
}

void main();
