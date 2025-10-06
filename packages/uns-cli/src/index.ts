#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, mkdir, readFile, readdir, stat, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import process from "node:process";
import readline from "node:readline/promises";
import { promisify } from "node:util";
import * as azdev from "azure-devops-node-api";
import type { IGitApi } from "azure-devops-node-api/GitApi";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const cliVersion = resolveCliVersion();
const coreVersion = resolveCoreVersion();
const execFileAsync = promisify(execFile);
const AZURE_DEVOPS_PROVIDER = "azure-devops" as const;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "configure") {
    const configureArgs = args.slice(1);
    try {
      await runConfigureCommand(configureArgs);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
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

  if (command === "configure-vscode") {
    const targetPath = args[1];
    try {
      await configureVscode(targetPath);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "configure-codegen") {
    const targetPath = args[1];
    try {
      await configureCodegen(targetPath);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "configure-api") {
    const targetPath = args[1];
    try {
      await configureApi(targetPath);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "configure-cron") {
    const targetPath = args[1];
    try {
      await configureCron(targetPath);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "configure-temporal") {
    const targetPath = args[1];
    try {
      await configureTemporal(targetPath);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "configure-python") {
    const targetPath = args[1];
    try {
      await configurePython(targetPath);
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
  console.log(
    `\nuns-kit v${cliVersion}\n` +
    "\nUsage: uns-kit <command> [options]\n" +
    "\nCommands:\n" +
    "  create <name>           Scaffold a new UNS application\n" +
    "  configure [dir] [features...] Configure multiple templates (--all for everything)\n" +
    "  configure-devops [dir]  Configure Azure DevOps tooling in an existing project\n" +
    "  configure-vscode [dir]  Add VS Code workspace configuration files\n" +
    "  configure-codegen [dir] Copy GraphQL codegen template and dependencies\n" +
    "  configure-api [dir]     Copy UNS API examples and add @uns-kit/api\n" +
    "  configure-cron [dir]    Copy UNS cron examples and add @uns-kit/cron\n" +
    "  configure-temporal [dir] Copy UNS Temporal examples and add @uns-kit/temporal\n" +
    "  configure-python [dir]   Copy Python gateway client scaffolding\n" +
    "  help                    Show this message\n",
  );
}

async function createProject(projectName: string): Promise<void> {
  const targetDir = path.resolve(process.cwd(), projectName);
  await ensureTargetDir(targetDir);

  const templateDir = path.resolve(__dirname, "../templates/default");
  await copyTemplateDirectory(templateDir, targetDir, targetDir);

  const pkgName = normalizePackageName(projectName);
  await patchPackageJson(targetDir, pkgName);
  await patchConfigJson(targetDir, pkgName);
  await replacePlaceholders(targetDir, pkgName);
  const initializedGit = await initGitRepository(targetDir);

  console.log(`\nCreated ${pkgName} in ${path.relative(process.cwd(), targetDir)}`);
  console.log("Next steps:");
  console.log(`  cd ${projectName}`);
  console.log("  pnpm install");
  console.log("  pnpm run dev");
  if (initializedGit) {
    console.log("  git status  # verify the new repository");
  }
}

async function initGitRepository(targetDir: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: targetDir,
      encoding: "utf8",
    });
    if (stdout.trim() === "true") {
      return false;
    }
  } catch (error) {
    if (isGitCommandNotFoundError(error)) {
      console.log("Git not found on PATH. Skipping repository initialization.");
      return false;
    }

    const execError = error as ExecFileError;
    const stderr = typeof execError.stderr === "string" ? execError.stderr : "";
    if (stderr && !stderr.includes("not a git repository")) {
      console.warn("Unable to determine git repository status:", stderr.trim());
      return false;
    }
  }

  try {
    await execFileAsync("git", ["init"], {
      cwd: targetDir,
      encoding: "utf8",
    });
    console.log("Initialized empty Git repository.");
    return true;
  } catch (error) {
    if (isGitCommandNotFoundError(error)) {
      console.log("Git not found on PATH. Skipping repository initialization.");
      return false;
    }

    const execError = error as ExecFileError;
    const stderr = typeof execError.stderr === "string" ? execError.stderr.trim() : "";
    if (stderr) {
      console.warn(`Failed to initialize git repository: ${stderr}`);
    } else {
      console.warn(`Failed to initialize git repository: ${(error as Error).message}`);
    }
    return false;
  }
}

type PackageJson = {
  name?: string;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
};

type DevopsConfig = {
  provider?: string;
  organization?: string;
  project?: string;
  [key: string]: unknown;
};

type ConfigJson = {
  devops?: DevopsConfig;
  [key: string]: unknown;
};

type AzureRemoteInfo = {
  organization?: string;
  project?: string;
  repository?: string;
};

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

  const pkg = JSON.parse(pkgRaw) as PackageJson;
  const config = JSON.parse(configRaw) as ConfigJson;

  await ensureGitRepository(targetDir);

  const remoteUrl = await getGitRemoteUrl(targetDir, "origin");
  const remoteInfo = remoteUrl ? parseAzureRemote(remoteUrl) : undefined;

  const repositoryName = inferRepositoryNameFromPackage(pkg.name) || inferRepositoryNameFromPackage(path.basename(targetDir));

  const defaultOrganization = config.devops?.organization?.trim() || remoteInfo?.organization || "example-org";
  const organization = await promptWithDefault(
    defaultOrganization ? `Azure DevOps organization [${defaultOrganization}]: ` : "Azure DevOps organization: ",
    defaultOrganization,
    "Azure DevOps organization is required.",
  );

  const defaultProject = config.devops?.project?.trim() || remoteInfo?.project || "";
  const project = await promptWithDefault(
    defaultProject ? `Azure DevOps project [${defaultProject}]: ` : "Azure DevOps project: ",
    defaultProject,
    "Azure DevOps project is required.",
  );

  if (!config.devops || typeof config.devops !== "object") {
    config.devops = {};
  }
  const devopsConfig = config.devops as DevopsConfig;
  devopsConfig.provider = AZURE_DEVOPS_PROVIDER;
  devopsConfig.organization = organization;
  devopsConfig.project = project;

  let gitRemoteMessage: string | undefined;
  let repositoryUrlMessage: string | undefined;
  let ensuredRemoteUrl = remoteUrl ?? "";

  if (!remoteUrl) {
    const { gitApi } = await resolveAzureGitApi(organization);
    const repositoryDetails = await ensureAzureRepositoryExists(gitApi, {
      organization,
      project,
      repository: repositoryName,
    });

    ensuredRemoteUrl = repositoryDetails.remoteUrl ?? buildAzureGitRemoteUrl(organization, project, repositoryName);
    await addGitRemote(targetDir, "origin", ensuredRemoteUrl);
    gitRemoteMessage = `  Added git remote origin -> ${ensuredRemoteUrl}`;
    const friendlyUrl = repositoryDetails.webUrl ?? buildAzureRepositoryUrl(organization, project, repositoryName);
    if (friendlyUrl) {
      repositoryUrlMessage = `  Repository URL: ${friendlyUrl}`;
    }
  } else {
    ensuredRemoteUrl = remoteUrl;
    gitRemoteMessage = `  Git remote origin detected -> ${ensuredRemoteUrl}`;
    const friendlyUrl = buildAzureRepositoryUrl(
      remoteInfo?.organization ?? organization,
      remoteInfo?.project ?? project,
      remoteInfo?.repository ?? repositoryName,
    );
    if (friendlyUrl) {
      repositoryUrlMessage = `  Repository URL: ${friendlyUrl}`;
    }
  }

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

  const azurePipelineTemplatePath = path.resolve(__dirname, "../templates/azure-pipelines.yml");
  try {
    await access(azurePipelineTemplatePath);
  } catch (error) {
    throw new Error("Azure Pipelines template is missing. Please ensure templates/azure-pipelines.yml exists.");
  }

  const pipelineTargetPath = path.join(targetDir, "azure-pipelines.yml");
  let pipelineMessage = "";
  if (await fileExists(pipelineTargetPath)) {
    pipelineMessage = "  azure-pipelines.yml already exists (skipped).";
  } else {
    await copyFile(azurePipelineTemplatePath, pipelineTargetPath);
    pipelineMessage = "  Added azure-pipelines.yml pipeline definition.";
  }

  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  if (pkgChanged) {
    await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }

  console.log(`\nDevOps tooling configured.`);
  console.log(`  DevOps provider: ${AZURE_DEVOPS_PROVIDER}`);
  console.log(`  Azure organization: ${organization}`);
  console.log(`  Azure project: ${project}`);
  if (repositoryUrlMessage) {
    console.log(repositoryUrlMessage);
  }
  if (gitRemoteMessage) {
    console.log(gitRemoteMessage);
  }
  if (pipelineMessage) {
    console.log(pipelineMessage);
  }
  if (pkgChanged) {
    console.log("  Updated package.json scripts/devDependencies. Run pnpm install to fetch new packages.");
  } else {
    console.log("  Existing package.json already contained required entries.");
  }
}

async function configureVscode(targetPath?: string): Promise<void> {
  const targetDir = path.resolve(process.cwd(), targetPath ?? ".");
  const templateDir = path.resolve(__dirname, "../templates/vscode");

  try {
    await access(templateDir);
  } catch (error) {
    throw new Error("VS Code template directory is missing. Please ensure templates/vscode is available.");
  }

  const { copied, skipped } = await copyTemplateDirectory(templateDir, targetDir, targetDir);

  console.log("\nVS Code configuration files processed.");
  if (copied.length) {
    console.log("  Added:");
    for (const file of copied) {
      console.log(`    ${file}`);
    }
  }
  if (skipped.length) {
    console.log("  Skipped (already exists):");
    for (const file of skipped) {
      console.log(`    ${file}`);
    }
  }
  if (!copied.length && !skipped.length) {
    console.log("  No files were found in the VS Code template directory.");
  }
}

async function configureCodegen(targetPath?: string): Promise<void> {
  const targetDir = path.resolve(process.cwd(), targetPath ?? ".");
  const templateDir = path.resolve(__dirname, "../templates/codegen");
  const packagePath = path.join(targetDir, "package.json");

  try {
    await access(templateDir);
  } catch (error) {
    throw new Error("GraphQL codegen template directory is missing. Please ensure templates/codegen is available.");
  }

  let pkgRaw: string;
  try {
    pkgRaw = await readFile(packagePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Could not find package.json in ${targetDir}`);
    }
    throw error;
  }

  const pkg = JSON.parse(pkgRaw) as PackageJson;

  const { copied, skipped } = await copyTemplateDirectory(templateDir, targetDir, targetDir);

  const devDeps = (pkg.devDependencies ??= {});
  const deps = pkg.dependencies ?? {};

  const requiredDevDeps: Record<string, string> = {
    "@graphql-codegen/cli": "^5.0.7",
    "@graphql-codegen/typescript": "^4.1.6",
    "@graphql-codegen/typescript-operations": "^4.6.1",
    "@graphql-codegen/typescript-resolvers": "^4.3.1",
    "graphql": "^16.11.0",
    "graphql-request": "^7.2.0"
  };

  let pkgChanged = false;
  for (const [name, version] of Object.entries(requiredDevDeps)) {
    if (!devDeps[name] && !deps[name]) {
      devDeps[name] = version;
      pkgChanged = true;
    }
  }

  const scripts = (pkg.scripts ??= {});
  if (!scripts.codegen) {
    scripts.codegen = "graphql-code-generator --config codegen.ts";
    pkgChanged = true;
  }
  if (!scripts["refresh-uns"]) {
    scripts["refresh-uns"] = "node ./node_modules/@uns-kit/core/dist/tools/refresh-uns.js";
    pkgChanged = true;
  }

  if (pkgChanged) {
    await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }

  console.log("\nGraphQL code generation setup complete.");
  if (copied.length) {
    console.log("  Added files:");
    for (const file of copied) {
      console.log(`    ${file}`);
    }
  }
  if (skipped.length) {
    console.log("  Skipped existing files:");
    for (const file of skipped) {
      console.log(`    ${file}`);
    }
  }
  if (!copied.length && !skipped.length) {
    console.log("  No template files were copied.");
  }

  if (pkgChanged) {
    console.log("  Updated package.json scripts/devDependencies. Run pnpm install to fetch new packages.");
  } else {
    console.log("  Existing package.json already contained required scripts and dependencies.");
  }
}

async function configureApi(targetPath?: string): Promise<void> {
  await configurePlugin({
    targetPath,
    templateName: "api",
    dependencyName: "@uns-kit/api",
    dependencySpecifier: resolveUnsPackageSpecifier("@uns-kit/api", "../../uns-api/package.json"),
    label: "UNS API",
  });
}

async function configureCron(targetPath?: string): Promise<void> {
  await configurePlugin({
    targetPath,
    templateName: "cron",
    dependencyName: "@uns-kit/cron",
    dependencySpecifier: resolveUnsPackageSpecifier("@uns-kit/cron", "../../uns-cron/package.json"),
    label: "UNS cron",
  });
}

async function configureTemporal(targetPath?: string): Promise<void> {
  await configurePlugin({
    targetPath,
    templateName: "temporal",
    dependencyName: "@uns-kit/temporal",
    dependencySpecifier: resolveUnsPackageSpecifier("@uns-kit/temporal", "../../uns-temporal/package.json"),
    label: "UNS Temporal",
  });
}

async function configurePython(targetPath?: string): Promise<void> {
  await configurePlugin({
    targetPath,
    templateName: "python",
    label: "UNS Python client",
  });
}

const configureFeatureHandlers = {
  devops: configureDevops,
  vscode: configureVscode,
  codegen: configureCodegen,
  api: configureApi,
  cron: configureCron,
  temporal: configureTemporal,
  python: configurePython,
} as const;

type ConfigureFeatureName = keyof typeof configureFeatureHandlers;

const AVAILABLE_CONFIGURE_FEATURES = Object.keys(configureFeatureHandlers) as ConfigureFeatureName[];

const configureFeatureLabels: Record<ConfigureFeatureName, string> = {
  devops: "Azure DevOps tooling",
  vscode: "VS Code workspace",
  codegen: "GraphQL codegen tooling",
  api: "UNS API resources",
  cron: "UNS cron resources",
  temporal: "UNS Temporal resources",
  python: "Python client scaffolding",
};

type ConfigureCommandOptions = {
  targetPath?: string;
  features: ConfigureFeatureName[];
};

async function runConfigureCommand(args: string[]): Promise<void> {
  const { targetPath, features } = parseConfigureArgs(args);
  if (!features.length) {
    throw new Error("No features specified. Provide feature names or pass --all.");
  }

  const location = targetPath ?? ".";
  const featureSummary = features.map((feature) => configureFeatureLabels[feature]).join(", ");
  console.log(`Configuring ${featureSummary} in ${location}`);
  for (const feature of features) {
    const handler = configureFeatureHandlers[feature];
    await handler(targetPath);
  }
}

function parseConfigureArgs(args: string[]): ConfigureCommandOptions {
  let targetPath: string | undefined;
  let includeAll = false;
  const featureInputs: string[] = [];

  for (const arg of args) {
    if (arg === "--all") {
      includeAll = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unknown option ${arg}.`);
    }

    const normalized = arg.trim().toLowerCase();
    if (configureFeatureAliases[normalized]) {
      featureInputs.push(arg);
      continue;
    }

    if (!targetPath) {
      targetPath = arg;
      continue;
    }

    featureInputs.push(arg);
  }

  const featureOrder: ConfigureFeatureName[] = [];
  const featureSet = new Set<ConfigureFeatureName>();

  const addFeature = (feature: ConfigureFeatureName): void => {
    if (!featureSet.has(feature)) {
      featureSet.add(feature);
      featureOrder.push(feature);
    }
  };

  if (includeAll) {
    for (const feature of AVAILABLE_CONFIGURE_FEATURES) {
      addFeature(feature);
    }
  }

  for (const input of featureInputs) {
    addFeature(resolveConfigureFeatureName(input));
  }

  return { targetPath, features: featureOrder };
}

const configureFeatureAliases: Record<string, ConfigureFeatureName> = {
  devops: "devops",
  "configure-devops": "devops",
  vscode: "vscode",
  "configure-vscode": "vscode",
  codegen: "codegen",
  "configure-codegen": "codegen",
  api: "api",
  "configure-api": "api",
  cron: "cron",
  "configure-cron": "cron",
  temporal: "temporal",
  "configure-temporal": "temporal",
  python: "python",
  "configure-python": "python",
};

function resolveConfigureFeatureName(input: unknown): ConfigureFeatureName {
  if (typeof input !== "string") {
    throw new Error(
      `Invalid feature value ${JSON.stringify(input)}. Expected a string from: ${AVAILABLE_CONFIGURE_FEATURES.join(", ")}.`,
    );
  }

  const normalized = input.trim().toLowerCase();
  const feature = configureFeatureAliases[normalized];
  if (!feature) {
    throw new Error(
      `Unknown feature "${input}". Available features: ${AVAILABLE_CONFIGURE_FEATURES.join(", ")}.`,
    );
  }

  return feature;
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

async function copyTemplateDirectory(
  sourceDir: string,
  targetDir: string,
  targetRoot: string,
): Promise<{ copied: string[]; skipped: string[] }> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  const copied: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const destinationName = entry.isFile() ? normalizeTemplateFilename(entry.name) : entry.name;
    const destinationPath = path.join(targetDir, destinationName);
    const relativePath = path.relative(targetRoot, destinationPath) || destinationName;

    if (entry.isDirectory()) {
      await mkdir(destinationPath, { recursive: true });
      const result = await copyTemplateDirectory(sourcePath, destinationPath, targetRoot);
      copied.push(...result.copied);
      skipped.push(...result.skipped);
      continue;
    }

    if (entry.isFile()) {
      await mkdir(path.dirname(destinationPath), { recursive: true });
      if (await fileExists(destinationPath)) {
        skipped.push(relativePath);
        continue;
      }
      await copyFile(sourcePath, destinationPath);
      copied.push(relativePath);
    }
  }

  return { copied, skipped };
}

function normalizeTemplateFilename(filename: string): string {
  if (filename === "gitignore" || filename === ".npmignore") {
    return ".gitignore";
  }
  return filename;
}

async function configurePlugin(options: {
  targetPath?: string;
  templateName: string;
  dependencyName?: string;
  dependencySpecifier?: string;
  label: string;
}): Promise<void> {
  const { targetPath, templateName, dependencyName, dependencySpecifier, label } = options;
  const targetDir = path.resolve(process.cwd(), targetPath ?? ".");
  const templateDir = path.resolve(__dirname, `../templates/${templateName}`);
  const packagePath = path.join(targetDir, "package.json");

  try {
    await access(templateDir);
  } catch (error) {
    throw new Error(`${label} template directory is missing. Please ensure templates/${templateName} exists.`);
  }

  let pkgRaw: string;
  try {
    pkgRaw = await readFile(packagePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Could not find package.json in ${targetDir}`);
    }
    throw error;
  }

  const pkg = JSON.parse(pkgRaw) as PackageJson;

  const { copied, skipped } = await copyTemplateDirectory(templateDir, targetDir, targetDir);

  let pkgChanged = false;
  if (dependencyName && dependencySpecifier) {
    const deps = (pkg.dependencies ??= {});
    if (deps[dependencyName] !== dependencySpecifier) {
      deps[dependencyName] = dependencySpecifier;
      pkgChanged = true;
    }
  }

  if (pkgChanged) {
    await writeFile(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  }

  console.log(`\n${label} assets processed.`);
  if (copied.length) {
    console.log("  Added files:");
    for (const file of copied) {
      console.log(`    ${file}`);
    }
  }
  if (skipped.length) {
    console.log("  Skipped existing files:");
    for (const file of skipped) {
      console.log(`    ${file}`);
    }
  }
  if (!copied.length && !skipped.length) {
    console.log("  No template files were copied.");
  }

  if (dependencyName && dependencySpecifier) {
    if (pkgChanged) {
      console.log(`  Added dependency ${dependencyName}@${dependencySpecifier}. Run pnpm install to fetch it.`);
    } else {
      console.log("  Existing package.json already contained the required dependency.");
    }
  }
}

async function resolveAzureGitApi(organization: string): Promise<{ gitApi: IGitApi }> {
  const tokensUrl = `https://dev.azure.com/${organization}/_usersSettings/tokens`;
  const envPat = process.env.AZURE_PAT?.trim();

  if (envPat) {
    try {
      const gitApi = await createAzureGitApi(organization, envPat);
      console.log("Using PAT from AZURE_PAT environment variable.");
      return { gitApi };
    } catch (error) {
      console.log("The AZURE_PAT environment variable is invalid or expired. Please provide a new PAT.");
    }
  }

  while (true) {
    const input = (await promptQuestion(
      `Azure DevOps Personal Access Token (create at ${tokensUrl}): `,
    )).trim();

    if (!input) {
      console.log("A Personal Access Token is required to create the repository.");
      continue;
    }

    try {
      const gitApi = await createAzureGitApi(organization, input);
      return { gitApi };
    } catch (error) {
      console.log("The provided PAT is invalid or expired. Please try again.");
    }
  }
}

async function createAzureGitApi(organization: string, personalAccessToken: string): Promise<IGitApi> {
  const authHandler = azdev.getPersonalAccessTokenHandler(personalAccessToken);
  const connection = new azdev.WebApi(`https://dev.azure.com/${organization}`, authHandler);
  await connection.connect();
  return connection.getGitApi();
}

async function ensureAzureRepositoryExists(
  gitApi: IGitApi,
  params: { organization: string; project: string; repository: string },
): Promise<{ remoteUrl?: string; webUrl?: string }> {
  const repositoryName = params.repository.trim();
  if (!repositoryName) {
    throw new Error("Repository name is required.");
  }

  let existingRemoteUrl: string | undefined;
  let existingWebUrl: string | undefined;

  try {
    const repositories = await gitApi.getRepositories(params.project);
    const existing = repositories?.find(
      (repo) => repo.name?.toLowerCase() === repositoryName.toLowerCase(),
    );
    if (existing) {
      existingRemoteUrl = existing.remoteUrl ?? undefined;
      existingWebUrl = existing.webUrl ?? existingRemoteUrl;
      return { remoteUrl: existingRemoteUrl, webUrl: existingWebUrl };
    }
  } catch (error) {
    // Fallback to attempting creation even if listing failed (e.g., limited permissions)
  }

  try {
    const created = await gitApi.createRepository({ name: repositoryName }, params.project);
    const remoteUrl = created?.remoteUrl ?? buildAzureGitRemoteUrl(params.organization, params.project, repositoryName);
    const webUrl = created?.webUrl ?? created?.remoteUrl ?? buildAzureRepositoryUrl(params.organization, params.project, repositoryName);
    console.log(`  Created Azure DevOps repository "${repositoryName}" in project "${params.project}".`);
    return { remoteUrl, webUrl };
  } catch (error) {
    try {
      const repository = await gitApi.getRepository(repositoryName, params.project);
      if (repository?.remoteUrl) {
        return {
          remoteUrl: repository.remoteUrl,
          webUrl: repository.webUrl ?? repository.remoteUrl,
        };
      }
    } catch (lookupError) {
      // Ignore lookup failure; we'll rethrow original error below.
    }

    const message = (error as Error).message || String(error);
    throw new Error(
      `Failed to create Azure DevOps repository "${repositoryName}" in project "${params.project}": ${message}`,
    );
  }
}

function parseAzureRemote(remoteUrl: string): AzureRemoteInfo | undefined {
  try {
    const url = new URL(remoteUrl);
    const hostname = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);

    if (hostname === "dev.azure.com") {
      const organization = segments[0] || url.username || undefined;
      const project = segments[1];
      const repository = extractRepositoryFromSegments(segments.slice(2));
      return {
        organization: organization ? decodeURIComponent(organization) : undefined,
        project: project ? decodeURIComponent(project) : undefined,
        repository,
      };
    }

    if (hostname.endsWith(".visualstudio.com")) {
      const organization = hostname.replace(/\.visualstudio\.com$/, "");
      const project = segments[0];
      const repository = extractRepositoryFromSegments(segments.slice(1));
      return {
        organization,
        project: project ? decodeURIComponent(project) : undefined,
        repository,
      };
    }
  } catch (error) {
    // Non-HTTP remote (e.g., SSH)
  }

  if (remoteUrl.startsWith("git@ssh.dev.azure.com:")) {
    const [, pathPart] = remoteUrl.split(":", 2);
    if (pathPart) {
      const segments = pathPart.split("/").filter(Boolean);
      // Format: v3/{organization}/{project}/{repo}
      if (segments[0]?.toLowerCase() === "v3") {
        return {
          organization: segments[1] ? decodeURIComponent(segments[1]) : undefined,
          project: segments[2] ? decodeURIComponent(segments[2]) : undefined,
          repository: stripGitExtension(segments.slice(3).join("/")),
        };
      }
    }
  }

  return undefined;
}

function extractRepositoryFromSegments(segments: string[]): string | undefined {
  if (!segments.length) {
    return undefined;
  }

  if (segments[0] === "_git") {
    return stripGitExtension(segments.slice(1).join("/"));
  }

  if (segments.length >= 2 && segments[1] === "_git") {
    return stripGitExtension(segments.slice(2).join("/"));
  }

  return stripGitExtension(segments.join("/"));
}

function stripGitExtension(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.endsWith(".git") ? value.slice(0, -4) : value;
}

function encodeAzureSegment(segment: string): string {
  return encodeURIComponent(segment.trim());
}

function buildAzureGitRemoteUrl(organization: string, project: string, repository: string): string {
  const segments = [organization, project, "_git", repository].map(encodeAzureSegment);
  return `https://dev.azure.com/${segments.join("/")}`;
}

function buildAzureRepositoryUrl(organization: string, project: string, repository: string): string | undefined {
  if (!organization || !project || !repository) {
    return undefined;
  }
  return buildAzureGitRemoteUrl(organization, project, repository);
}

function inferRepositoryNameFromPackage(pkgName: unknown): string {
  if (typeof pkgName !== "string" || !pkgName.trim()) {
    return "uns-app";
  }

  const trimmed = pkgName.trim();
  const baseName = trimmed.startsWith("@") ? trimmed.split("/").pop() ?? trimmed : trimmed;
  return baseName.replace(/[^A-Za-z0-9._-]+/g, "-");
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

async function promptWithDefault(message: string, defaultValue: string, requiredMessage: string): Promise<string> {
  while (true) {
    const answer = (await promptQuestion(message)).trim();
    if (answer) {
      return answer;
    }
    if (defaultValue) {
      return defaultValue;
    }
    console.log(requiredMessage);
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
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

  const dependencies = (pkg.dependencies ??= {});
  if (dependencies["@uns-kit/core"]) {
    dependencies["@uns-kit/core"] = resolveUnsPackageSpecifier(
      "@uns-kit/core",
      "../../uns-core/package.json",
    );
  } else {
    dependencies["@uns-kit/core"] = `^${coreVersion}`;
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

function resolveUnsPackageSpecifier(packageName: string, relativeLocalPath: string): string {
  const localPath = path.resolve(__dirname, relativeLocalPath);
  if (existsSync(localPath)) {
    const pkg = require(localPath) as { version?: string };
    const version = pkg?.version ?? "0.0.1";
    return `workspace:^${version}`;
  }

  const version = resolveUnsPackageVersion(packageName, relativeLocalPath);
  return `^${version}`;
}

function resolveUnsPackageVersion(packageName: string, relativeLocalPath: string): string {
  const attempt = (factory: () => string | undefined): string | undefined => {
    try {
      return factory();
    } catch (error) {
      return undefined;
    }
  };

  const directVersion = attempt(() => {
    const pkg = require(`${packageName}/package.json`) as { version?: string };
    return pkg?.version;
  });
  if (directVersion) {
    return directVersion;
  }

  const workspaceVersion = attempt(() => {
    const pkgPath = path.resolve(__dirname, relativeLocalPath);
    const pkg = require(pkgPath) as { version?: string };
    return pkg?.version;
  });
  if (workspaceVersion) {
    return workspaceVersion;
  }

  const cliDependencyVersion = attempt(() => {
    const cliPkg = require("../package.json") as {
      dependencies?: Record<string, string>;
    };
    const range = cliPkg.dependencies?.[packageName];
    if (typeof range === "string") {
      const match = range.match(/\d+\.\d+\.\d+/);
      return match?.[0];
    }
    return undefined;
  });
  if (cliDependencyVersion) {
    return cliDependencyVersion;
  }

  return "0.0.1";
}

function resolveCliVersion(): string {
  const attempt = (factory: () => string | undefined): string | undefined => {
    try {
      return factory();
    } catch (error) {
      return undefined;
    }
  };

  const packageVersion = attempt(() => {
    const pkg = require("../package.json") as { version?: string };
    return pkg?.version;
  });
  if (packageVersion) {
    return packageVersion;
  }

  const envVersion = attempt(() => process.env.npm_package_version?.trim());
  if (envVersion) {
    return envVersion;
  }

  return "0.0.0";
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
