#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";
import readline from "node:readline/promises";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const coreVersion = resolveCoreVersion();
const execFileAsync = promisify(execFile);

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

  await ensureGitRepository(targetDir);

  const remoteUrl = await getGitRemoteUrl(targetDir, "origin");
  let gitRemoteMessage: string | undefined;
  let ensuredRemoteUrl = remoteUrl;

  if (!ensuredRemoteUrl) {
    const remoteAnswer = (await promptQuestion(
      "Azure DevOps repository URL (e.g. https://dev.azure.com/sijit/industry40/_git/my-repo): ",
    )).trim();

    if (!remoteAnswer) {
      throw new Error("A repository URL is required to set the git remote origin.");
    }

    await addGitRemote(targetDir, "origin", remoteAnswer);
    ensuredRemoteUrl = remoteAnswer;
    gitRemoteMessage = `  Added git remote origin -> ${remoteAnswer}`;
  }

  const inferredOrganization = ensuredRemoteUrl ? inferAzureOrganization(ensuredRemoteUrl) : undefined;

  const defaultOrg = config.devops?.organization?.trim() || inferredOrganization || "sijit";
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
  if (gitRemoteMessage) {
    console.log(gitRemoteMessage);
  }
  if (pkgChanged) {
    console.log("  Updated package.json scripts/devDependencies. Run pnpm install to fetch new packages.");
  } else {
    console.log("  Existing package.json already contained required entries.");
  }
}

async function ensureGitRepository(dir: string): Promise<void> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      encoding: "utf8",
    });
    if (stdout.trim() !== "true") {
      throw new Error(`Directory ${dir} is not a git repository.`);
    }
  } catch (error) {
    if (isGitCommandNotFoundError(error)) {
      throw new Error("Git is required to run configure-devops but was not found in PATH.");
    }

    const execError = error as ExecFileError;
    const stderr = typeof execError.stderr === "string" ? execError.stderr : "";
    if (stderr.includes("not a git repository")) {
      throw new Error(`Directory ${dir} is not a git repository.`);
    }

    throw error;
  }
}

async function getGitRemoteUrl(dir: string, remoteName: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["remote", "get-url", remoteName], {
      cwd: dir,
      encoding: "utf8",
    });
    return stdout.trim();
  } catch (error) {
    if (isGitCommandNotFoundError(error)) {
      throw new Error("Git is required to run configure-devops but was not found in PATH.");
    }

    if (isGitRemoteMissingError(error)) {
      return null;
    }

    throw error;
  }
}

async function addGitRemote(dir: string, remoteName: string, remoteUrl: string): Promise<void> {
  try {
    await execFileAsync("git", ["remote", "add", remoteName, remoteUrl], {
      cwd: dir,
      encoding: "utf8",
    });
  } catch (error) {
    if (isGitCommandNotFoundError(error)) {
      throw new Error("Git is required to run configure-devops but was not found in PATH.");
    }

    const execError = error as ExecFileError;
    const stderr = typeof execError.stderr === "string" ? execError.stderr.trim() : "";
    if (stderr) {
      throw new Error(`Failed to add git remote origin: ${stderr}`);
    }

    throw new Error(`Failed to add git remote origin: ${(error as Error).message}`);
  }
}

function inferAzureOrganization(remoteUrl: string): string | undefined {
  try {
    const url = new URL(remoteUrl);
    const hostname = url.hostname.toLowerCase();
    if (hostname === "dev.azure.com" || hostname.endsWith(".visualstudio.com")) {
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length >= 1) {
        return segments[0];
      }
    }
  } catch (error) {
    // ignore parse errors for non-HTTP(S) remotes
  }

  if (remoteUrl.startsWith("git@ssh.dev.azure.com:")) {
    const [, pathPart] = remoteUrl.split(":", 2);
    if (pathPart) {
      const segments = pathPart.split("/").filter(Boolean);
      // Format: v3/{organization}/{project}/{repo}
      if (segments.length >= 2) {
        return segments[1];
      }
    }
  }

  return undefined;
}

function isGitRemoteMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const execError = error as ExecFileError;
  if (typeof execError.stderr === "string") {
    return execError.stderr.includes("No such remote");
  }

  return false;
}

function isGitCommandNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as NodeJS.ErrnoException).code === "ENOENT");
}

type ExecFileError = NodeJS.ErrnoException & {
  code?: number | string;
  stdout?: string;
  stderr?: string;
};

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
