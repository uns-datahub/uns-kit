#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readTextFileIfExists, writeTextFileIfChanged } from "./file-utils.js";

type MetadataDocument = {
  schemaVersion?: number;
  topics?: unknown;
  tags?: unknown;
  assets?: unknown;
};

type AssetMetadata = {
  description?: unknown;
};

type CliArgs = {
  controllerUrl: string;
  token: string;
  projectRoot?: string;
  dryRun: boolean;
  topicsOnly: boolean;
  tagsOnly: boolean;
  assetsOnly: boolean;
  help: boolean;
};

type FileChangeResult = {
  changed: boolean;
  relativePath: string;
};

type SyncTarget = {
  rootDir: string;
  label: string;
  topicsGenerated: string[];
  tagsGenerated: string[];
  assetsGenerated: string[];
};

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]).endsWith(path.basename(fileURLToPath(import.meta.url)))
  : false;

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = await parseArgs(argv);

  if (args.help) {
    printHelp();
    return;
  }

  const target = await resolveSyncTarget(args);
  const document = await fetchMetadataDocument(args.controllerUrl, args.token);
  const selected = selectedSections(args);

  const results: { label: string; results: FileChangeResult[] }[] = [];

  if (selected.topics) {
    const assetNames = readAssetNames(document.assets);
    results.push({
      label: "Topics TS",
      results: await updateGeneratedFiles(
        target.topicsGenerated,
        renderUnsTopicsTs(readStringArray(document.topics, "topics").map(topic => extractBaseTopicPath(topic, assetNames))),
        target.rootDir,
        args.dryRun,
      ),
    });
  }

  if (selected.tags) {
    results.push({
      label: "Tags TS",
      results: await updateGeneratedFiles(
        target.tagsGenerated,
        renderUnsTagsTs(readStringArray(document.tags, "tags")),
        target.rootDir,
        args.dryRun,
      ),
    });
  }

  if (selected.assets) {
    results.push({
      label: "Assets TS",
      results: await updateGeneratedFiles(
        target.assetsGenerated,
        renderUnsAssetsTs(readAssetEntries(document.assets)),
        target.rootDir,
        args.dryRun,
      ),
    });
  }

  printSummary({
    controllerUrl: args.controllerUrl,
    dryRun: args.dryRun,
    targetLabel: target.label,
    targetRoot: target.rootDir,
    results,
  });
}

function selectedSections(args: CliArgs): { topics: boolean; tags: boolean; assets: boolean } {
  const hasSpecificSelection = args.topicsOnly || args.tagsOnly || args.assetsOnly;
  return {
    topics: !hasSpecificSelection || args.topicsOnly,
    tags: !hasSpecificSelection || args.tagsOnly,
    assets: !hasSpecificSelection || args.assetsOnly,
  };
}

async function getControllerUrlFromConfig(): Promise<string | undefined> {
  const configPath = path.join(process.cwd(), "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    const restUrl = (config.uns as Record<string, unknown> | undefined)?.rest;
    if (typeof restUrl === "string" && restUrl.trim()) {
      return restUrl.endsWith("/api") ? restUrl.slice(0, -4) : restUrl;
    }
  } catch (error) {
    // Missing/invalid config.json is handled by the caller.
  }
  return undefined;
}

async function promptForToken(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    stdin.setRawMode(true);
    stdin.resume();
    process.stderr.write("Enter controller token: ");

    let token = "";
    stdin.on("data", onChar);

    function onChar(char: Buffer): void {
      const code = char[0];
      if (code === 13 || code === 10) {
        stdin.removeListener("data", onChar);
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        process.stderr.write("\n");
        resolve(token);
        return;
      }
      if (code === 3) {
        stdin.removeListener("data", onChar);
        stdin.setRawMode(wasRaw ?? false);
        process.stderr.write("\n");
        process.exit(1);
      }
      if (code === 127 || code === 8) {
        token = token.slice(0, -1);
      } else if (code >= 32) {
        token += char.toString("utf8");
      }
    }
  });
}

async function parseArgs(argv: string[]): Promise<CliArgs> {
  let controllerUrl = process.env.UNS_CONTROLLER_URL?.trim() ?? "";
  let token = process.env.UNS_CONTROLLER_TOKEN?.trim() ?? "";
  let projectRoot =
    process.env.UNS_METADATA_PROJECT_ROOT?.trim() ||
    process.env.UNS_SCHEMA_PROJECT_ROOT?.trim() ||
    undefined;
  let dryRun = false;
  let topicsOnly = false;
  let tagsOnly = false;
  let assetsOnly = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--topics-only") {
      topicsOnly = true;
      continue;
    }
    if (arg === "--tags-only") {
      tagsOnly = true;
      continue;
    }
    if (arg === "--assets-only") {
      assetsOnly = true;
      continue;
    }
    if (arg === "--project-root") {
      projectRoot = readRequiredValue(argv, ++index, "--project-root");
      continue;
    }
    if (arg.startsWith("--project-root=")) {
      projectRoot = arg.slice("--project-root=".length);
      continue;
    }
    if (arg === "--controller-url") {
      controllerUrl = readRequiredValue(argv, ++index, "--controller-url");
      continue;
    }
    if (arg.startsWith("--controller-url=")) {
      controllerUrl = arg.slice("--controller-url=".length);
      continue;
    }
    if (arg === "--token") {
      token = readRequiredValue(argv, ++index, "--token");
      continue;
    }
    if (arg.startsWith("--token=")) {
      token = arg.slice("--token=".length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!controllerUrl) {
    const configUrl = await getControllerUrlFromConfig();
    if (configUrl) {
      controllerUrl = configUrl;
    }
  }

  if (!help) {
    if (!controllerUrl) {
      throw new Error("Missing controller URL. Use --controller-url, set UNS_CONTROLLER_URL, or provide config.json with uns.rest.");
    }
    if (!token) {
      if (process.stdin.isTTY) {
        token = await promptForToken();
      }
      if (!token) {
        throw new Error("Missing controller token. Use --token, set UNS_CONTROLLER_TOKEN, or provide it interactively.");
      }
    }
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.slice(7).trim();
    }
    controllerUrl = normalizeControllerUrl(controllerUrl);
    assertValidUrl(controllerUrl);
  }

  return {
    controllerUrl,
    token,
    projectRoot,
    dryRun,
    topicsOnly,
    tagsOnly,
    assetsOnly,
    help,
  };
}

function readRequiredValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function assertValidUrl(value: string): void {
  try {
    new URL(value);
  } catch (error) {
    throw new Error(`Invalid controller URL "${value}". Expected an absolute URL such as http://localhost:3200.`);
  }
}

function normalizeControllerUrl(value: string): string {
  return value.replace(/\/+$/, "").replace(/\/api$/i, "");
}

function printHelp(): void {
  console.log(`Usage: tsx packages/uns-core/src/tools/sync-uns-metadata.ts [options]

Pull UNS metadata from a controller REST export and refresh generated TypeScript
topic, tag, and asset artifacts.

Options:
  --controller-url <url>   Controller base URL (env: UNS_CONTROLLER_URL, or config.json > uns.rest)
  --token <token>          Bearer token with export:uns-reference scope (env: UNS_CONTROLLER_TOKEN)
  --project-root <dir>     Write into a generated microservice project root (env: UNS_METADATA_PROJECT_ROOT or UNS_SCHEMA_PROJECT_ROOT).
                           When omitted, the tool auto-detects a generated project from the current working directory
                           and otherwise updates the uns-kit repo templates.
  --dry-run                Report file changes without writing anything
  --topics-only            Refresh only src/uns/uns-topics.ts
  --tags-only              Refresh only src/uns/uns-tags.ts
  --assets-only            Refresh only src/uns/uns-assets.ts
  --help, -h               Show this help
`);
}

async function resolveSyncTarget(args: CliArgs): Promise<SyncTarget> {
  if (args.projectRoot) {
    return buildProjectTarget(path.resolve(process.cwd(), args.projectRoot));
  }

  const currentDir = process.cwd();
  if (await looksLikeGeneratedProjectRoot(currentDir)) {
    return buildProjectTarget(currentDir);
  }

  return buildRepoTarget(await findRepoRoot());
}

async function findRepoRoot(): Promise<string> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  let probeDir = currentDir;

  while (true) {
    const packageJsonPath = path.join(probeDir, "package.json");
    try {
      const raw = await readFile(packageJsonPath, "utf8");
      const pkg = JSON.parse(raw) as { name?: string };
      if (pkg.name === "@uns-kit/core") {
        return path.resolve(probeDir, "../..");
      }
    } catch (error) {
      // Ignore missing package.json and continue walking upward.
    }

    const parentDir = path.dirname(probeDir);
    if (parentDir === probeDir) break;
    probeDir = parentDir;
  }

  throw new Error("Could not locate the @uns-kit/core package directory from sync-uns-metadata.ts.");
}

function buildRepoTarget(repoRoot: string): SyncTarget {
  return {
    rootDir: repoRoot,
    label: "uns-kit repo templates",
    topicsGenerated: [
      path.join(repoRoot, "packages/uns-core/src/uns/uns-topics.ts"),
      path.join(repoRoot, "packages/uns-cli/templates/default/src/uns/uns-topics.ts"),
    ],
    tagsGenerated: [
      path.join(repoRoot, "packages/uns-core/src/uns/uns-tags.ts"),
      path.join(repoRoot, "packages/uns-cli/templates/default/src/uns/uns-tags.ts"),
    ],
    assetsGenerated: [path.join(repoRoot, "packages/uns-cli/templates/default/src/uns/uns-assets.ts")],
  };
}

function buildProjectTarget(projectRoot: string): SyncTarget {
  return {
    rootDir: projectRoot,
    label: "generated microservice project",
    topicsGenerated: [path.join(projectRoot, "src/uns/uns-topics.ts")],
    tagsGenerated: [path.join(projectRoot, "src/uns/uns-tags.ts")],
    assetsGenerated: [path.join(projectRoot, "src/uns/uns-assets.ts")],
  };
}

async function looksLikeGeneratedProjectRoot(rootDir: string): Promise<boolean> {
  const [hasPackageJson, hasConfigJson, hasUnsDir] = await Promise.all([
    pathExists(path.join(rootDir, "package.json")),
    pathExists(path.join(rootDir, "config.json")),
    pathExists(path.join(rootDir, "src/uns")),
  ]);

  return hasPackageJson && hasConfigJson && hasUnsDir;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch (error) {
    return false;
  }
}

function buildControllerUrl(controllerUrl: string, relativePath: string): URL {
  const base = new URL(controllerUrl);
  if (!base.pathname.endsWith("/")) {
    base.pathname = `${base.pathname}/`;
  }
  return new URL(relativePath, base);
}

async function fetchMetadataDocument(controllerUrl: string, token: string): Promise<MetadataDocument> {
  const url = buildControllerUrl(controllerUrl, "api/schema/export/uns-metadata");
  const document = await fetchJson(url, token, "UNS metadata");
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`Controller returned an invalid UNS metadata document from ${url.toString()}.`);
  }
  return document as MetadataDocument;
}

async function fetchJson(url: URL, token: string, label: string): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    throw new Error(`Network failure while fetching ${label} export from ${url.toString()}: ${(error as Error).message}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new Error(formatHttpError(response, url, label, text));
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Controller returned invalid JSON for the ${label} export from ${url.toString()}.`);
  }
}

function formatHttpError(response: Response, url: URL, label: string, body: string): string {
  if (response.status === 401) {
    return "Token is invalid or expired (401). Provide a valid token via --token, UNS_CONTROLLER_TOKEN, or the interactive prompt.";
  }
  if (response.status === 403) {
    return `Forbidden (403) while fetching ${label} export from ${url.toString()}. The token must be admin or include export:uns-reference.`;
  }

  const detail = extractErrorDetail(body);
  return `Failed to fetch ${label} export from ${url.toString()}: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`;
}

function extractErrorDetail(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch (error) {
    // Fall through to plain text handling.
  }

  return trimmed.replace(/\s+/g, " ").slice(0, 200);
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`UNS metadata export is missing a valid ${label} array.`);
  }
  return Array.from(
    new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map(entry => entry.trim())),
  ).sort((left, right) => left.localeCompare(right));
}

function readAssetEntries(value: unknown): Array<{ name: string; description: string | null }> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("UNS metadata export is missing a valid assets object.");
  }

  return Object.entries(value as Record<string, AssetMetadata>)
    .map(([name, metadata]) => ({
      name: name.trim(),
      description: typeof metadata?.description === "string" && metadata.description.trim()
        ? metadata.description.trim()
        : null,
    }))
    .filter(entry => entry.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function readAssetNames(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.keys(value as Record<string, unknown>)
    .map(name => normalizeTopicPath(name).replace(/\/$/, ""))
    .filter(Boolean)
    .sort((left, right) => right.split("/").length - left.split("/").length || left.localeCompare(right));
}

function normalizeTopicPath(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, "");
  return normalized ? `${normalized}/` : "";
}

export function extractBaseTopicPath(value: string, assetNames: string[]): string {
  const normalized = normalizeTopicPath(value);
  if (!normalized || assetNames.length === 0) {
    return normalized;
  }

  const topicSegments = normalized.replace(/\/$/, "").split("/");
  for (const assetName of assetNames) {
    const assetSegments = assetName.split("/");
    const matchIndex = findLastIdentityAssetIndex(topicSegments, assetSegments);
    if (matchIndex >= 0) {
      return normalizeTopicPath(topicSegments.slice(0, matchIndex).join("/"));
    }
  }

  return normalized;
}

function findLastIdentityAssetIndex(haystack: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) {
    return -1;
  }

  for (let index = haystack.length - needle.length; index >= 0; index -= 1) {
    const remainingTailSegments = haystack.length - index - needle.length;
    if (remainingTailSegments < 3) {
      continue;
    }
    if (needle.every((segment, offset) => haystack[index + offset] === segment)) {
      return index;
    }
  }

  return -1;
}

export function renderUnsTopicsTs(topics: string[]): string {
  const uniqueTopics = Array.from(new Set(topics.map(normalizeTopicPath).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
  const members = uniqueTopics.map(topic => `  | ${JSON.stringify(topic)}`).join("\n");
  return `// Generated UNS topic union. Run \`pnpm run sync-uns-metadata\` to update.\nexport type UnsTopics =\n${members ? `${members}\n` : ""}  | (string & {});\n`;
}

export function renderUnsTagsTs(tags: string[]): string {
  const uniqueTags = Array.from(new Set(tags.map(tag => tag.trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right));
  const members = uniqueTags.map(tag => `  | ${JSON.stringify(tag)}`).join("\n");
  return `// Generated UNS tag union. Run \`pnpm run sync-uns-metadata\` to update.\nexport type UnsTags =\n${members ? `${members}\n` : ""}  | (string & {});\n`;
}

export function renderUnsAssetsTs(assets: Array<{ name: string; description: string | null }>): string {
  const entries = assets.length
    ? assets.map((entry) => {
        const comment = entry.description ? `  /** ${sanitizeComment(entry.description)} */\n` : "";
        return `${comment}  ${JSON.stringify(entry.name)}: ${JSON.stringify(entry.name)},`;
      }).join("\n")
    : `  "asset": "asset",`;

  const helpers = `
export function resolveGeneratedAsset(name: keyof typeof GeneratedAssets): (typeof GeneratedAssets)[keyof typeof GeneratedAssets];
export function resolveGeneratedAsset<T extends string>(name: T): (typeof GeneratedAssets)[keyof typeof GeneratedAssets] | T;
export function resolveGeneratedAsset(name: string): string {
  return (GeneratedAssets as Record<string, string>)[name] ?? name;
}
`;

  return `// Generated UNS asset list. Run \`pnpm run sync-uns-metadata\` to update.\nexport const GeneratedAssets = {\n${entries}\n} as const;\nexport type GeneratedAssetName = typeof GeneratedAssets[keyof typeof GeneratedAssets];\n${helpers}`;
}

function sanitizeComment(text: string): string {
  return text.replace(/\*\//g, "*\\/");
}

async function updateGeneratedFiles(
  filePaths: string[],
  content: string,
  rootDir: string,
  dryRun: boolean,
): Promise<FileChangeResult[]> {
  return Promise.all(filePaths.map((filePath) => updateFile(filePath, content, rootDir, dryRun)));
}

async function updateFile(
  filePath: string,
  content: string,
  rootDir: string,
  dryRun: boolean,
): Promise<FileChangeResult> {
  const current = await readTextFileIfExists(filePath);
  const changed = current !== content;
  const relativePath = path.relative(rootDir, filePath);

  if (dryRun) {
    console.log(`${changed ? "Would update" : "No change"} ${relativePath}`);
    return { changed, relativePath };
  }

  if (!changed) {
    console.log(`Unchanged ${relativePath}`);
    return { changed: false, relativePath };
  }

  await writeTextFileIfChanged(filePath, content);
  console.log(`Updated ${relativePath}`);
  return { changed: true, relativePath };
}

function printSummary(summary: {
  controllerUrl: string;
  targetLabel: string;
  targetRoot: string;
  dryRun: boolean;
  results: { label: string; results: FileChangeResult[] }[];
}): void {
  console.log("");
  console.log(summary.dryRun ? "Dry-run summary" : "Sync summary");
  console.log(`  Controller: ${summary.controllerUrl}`);
  console.log(`  Target: ${summary.targetLabel}`);
  console.log(`  Root: ${summary.targetRoot}`);
  for (const entry of summary.results) {
    console.log(`  ${entry.label}: ${renderGeneratedSummary(entry.results)}`);
  }
}

function renderGeneratedSummary(results: FileChangeResult[]): string {
  if (!results.length) return "none";
  const changedCount = results.filter((result) => result.changed).length;
  return `${changedCount}/${results.length} file${results.length === 1 ? "" : "s"} changed`;
}

if (isDirectExecution) {
  main().catch((error) => {
    console.error("Failed to sync UNS metadata:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
