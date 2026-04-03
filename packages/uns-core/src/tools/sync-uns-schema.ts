#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readTextFileIfExists, writeTextFileIfChanged } from "./file-utils.js";
import { renderDictionaryTs } from "./generate-uns-dictionary.js";
import { renderMeasurementsTs } from "./generate-uns-measurements.js";

type SchemaStatus = "active" | "draft" | "deprecated" | "all";

type DictionaryDocument = Parameters<typeof renderDictionaryTs>[0];
type MeasurementsDocument = Parameters<typeof renderMeasurementsTs>[0];

type CliArgs = {
  controllerUrl: string;
  token: string;
  status: SchemaStatus;
  projectRoot?: string;
  dryRun: boolean;
  dictionaryOnly: boolean;
  measurementsOnly: boolean;
  skipGenerate: boolean;
  help: boolean;
};

type FileChangeResult = {
  changed: boolean;
  relativePath: string;
};

type DictionarySummary = {
  objectTypeCount: number;
  attributeCount: number;
  jsonChanged: boolean;
  generatedChanged: FileChangeResult[];
};

type MeasurementsSummary = {
  categoryCount: number;
  jsonChanged: boolean;
  generatedChanged: FileChangeResult[];
};

type SyncTarget = {
  rootDir: string;
  label: string;
  dictionaryJson: string;
  measurementsJson: string;
  dictionaryGenerated: string[];
  measurementsGenerated: string[];
};

const DEFAULT_STATUS: SchemaStatus = "active";
const GENERATOR_LANG = "sl";
const STATUS_VALUES: SchemaStatus[] = ["active", "draft", "deprecated", "all"];

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]).endsWith(path.basename(fileURLToPath(import.meta.url)))
  : false;

async function main(): Promise<void> {
  const args = await parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const target = await resolveSyncTarget(args);

  const shouldSyncDictionary = !args.measurementsOnly;
  const shouldSyncMeasurements = !args.dictionaryOnly;

  const [dictionaryDocument, measurementsDocument] = await Promise.all([
    shouldSyncDictionary ? fetchDictionaryDocument(args.controllerUrl, args.token, args.status) : Promise.resolve(undefined),
    shouldSyncMeasurements ? fetchMeasurementsDocument(args.controllerUrl, args.token) : Promise.resolve(undefined),
  ]);

  let dictionarySummary: DictionarySummary | undefined;
  let measurementsSummary: MeasurementsSummary | undefined;

  if (dictionaryDocument) {
    const content = formatJsonDocument(dictionaryDocument);
    const jsonResult = await updateFile(target.dictionaryJson, content, target.rootDir, args.dryRun);
    const generatedChanged = args.skipGenerate
      ? []
      : await updateGeneratedFiles(
          target.dictionaryGenerated,
          renderDictionaryTs(dictionaryDocument, GENERATOR_LANG),
          target.rootDir,
          args.dryRun,
        );

    dictionarySummary = {
      objectTypeCount: Object.keys(dictionaryDocument.objectTypes ?? {}).length,
      attributeCount: Object.keys(dictionaryDocument.attributes ?? {}).length,
      jsonChanged: jsonResult.changed,
      generatedChanged,
    };
  }

  if (measurementsDocument) {
    const content = formatJsonDocument(measurementsDocument);
    const jsonResult = await updateFile(target.measurementsJson, content, target.rootDir, args.dryRun);
    const generatedChanged = args.skipGenerate
      ? []
      : await updateGeneratedFiles(
          target.measurementsGenerated,
          renderMeasurementsTs(measurementsDocument, GENERATOR_LANG),
          target.rootDir,
          args.dryRun,
        );

    measurementsSummary = {
      categoryCount: countMeasurementCategories(measurementsDocument),
      jsonChanged: jsonResult.changed,
      generatedChanged,
    };
  }

  printSummary({
    controllerUrl: args.controllerUrl,
    targetLabel: target.label,
    targetRoot: target.rootDir,
    dryRun: args.dryRun,
    skipGenerate: args.skipGenerate,
    status: args.status,
    dictionary: dictionarySummary,
    measurements: measurementsSummary,
  });
}

async function getControllerUrlFromConfig(): Promise<string | undefined> {
  const currentDir = process.cwd();
  const configPath = path.join(currentDir, "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    const config = JSON.parse(raw) as Record<string, unknown>;
    const unsConfig = config.uns as Record<string, unknown> | undefined;
    const restUrl = unsConfig?.rest as string | undefined;
    if (restUrl && typeof restUrl === "string") {
      // Remove trailing /api from the rest URL to get the base controller URL
      return restUrl.endsWith("/api") ? restUrl.slice(0, -4) : restUrl;
    }
  } catch (error) {
    // Ignore missing or invalid config.json
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
      // Enter (13) or newline (10) — done
      if (code === 13 || code === 10) {
        stdin.removeListener("data", onChar);
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        process.stderr.write("\n");
        resolve(token);
        return;
      }
      // Ctrl+C — abort
      if (code === 3) {
        stdin.removeListener("data", onChar);
        stdin.setRawMode(wasRaw ?? false);
        process.stderr.write("\n");
        process.exit(1);
      }
      // Backspace (127) or Delete (8)
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
  let status = normalizeStatus(process.env.UNS_SCHEMA_STATUS, DEFAULT_STATUS);
  let projectRoot = process.env.UNS_SCHEMA_PROJECT_ROOT?.trim() || undefined;
  let dryRun = false;
  let dictionaryOnly = false;
  let measurementsOnly = false;
  let skipGenerate = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--dictionary-only") {
      dictionaryOnly = true;
      continue;
    }

    if (arg === "--measurements-only") {
      measurementsOnly = true;
      continue;
    }

    if (arg === "--skip-generate") {
      skipGenerate = true;
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

    if (arg === "--status") {
      status = normalizeStatus(readRequiredValue(argv, ++index, "--status"), DEFAULT_STATUS);
      continue;
    }

    if (arg.startsWith("--status=")) {
      status = normalizeStatus(arg.slice("--status=".length), DEFAULT_STATUS);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  // Try to load controller URL from config.json if not provided
  if (!controllerUrl) {
    const configUrl = await getControllerUrlFromConfig();
    if (configUrl) {
      controllerUrl = configUrl;
    }
  }

  if (!help) {
    if (dictionaryOnly && measurementsOnly) {
      throw new Error("Choose either --dictionary-only or --measurements-only, not both.");
    }
    if (!controllerUrl) {
      throw new Error("Missing controller URL. Use --controller-url, set UNS_CONTROLLER_URL, or provide config.json with uns.rest.");
    }
    if (!token) {
      // Prompt for token if stdin is a TTY (interactive terminal)
      if (process.stdin.isTTY) {
        token = await promptForToken();
      }
      if (!token) {
        throw new Error("Missing controller token. Use --token, set UNS_CONTROLLER_TOKEN, or provide it interactively.");
      }
    }
    // Strip "Bearer " prefix if the user included it
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.slice(7).trim();
    }
    assertValidUrl(controllerUrl);
  }

  return {
    controllerUrl,
    token,
    status,
    projectRoot,
    dryRun,
    dictionaryOnly,
    measurementsOnly,
    skipGenerate,
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

function normalizeStatus(value: string | undefined, fallback: SchemaStatus): SchemaStatus {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (STATUS_VALUES.includes(normalized as SchemaStatus)) {
    return normalized as SchemaStatus;
  }
  throw new Error(`Invalid --status value "${value}". Expected one of: ${STATUS_VALUES.join(", ")}.`);
}

function assertValidUrl(value: string): void {
  try {
    new URL(value);
  } catch (error) {
    throw new Error(`Invalid controller URL "${value}". Expected an absolute URL such as http://localhost:3200.`);
  }
}

function printHelp(): void {
  console.log(`Usage: tsx packages/uns-core/src/tools/sync-uns-schema.ts [options]

Pull the canonical UNS schema export from a controller and refresh the local
JSON files plus generated TypeScript artifacts.

Options:
  --controller-url <url>   Controller base URL (env: UNS_CONTROLLER_URL, or config.json > uns.rest)
  --token <token>          Bearer token for REST export (env: UNS_CONTROLLER_TOKEN)
  --status <value>         Dictionary status filter: ${STATUS_VALUES.join("|")} (default: ${DEFAULT_STATUS}, env: UNS_SCHEMA_STATUS)
  --project-root <dir>     Write into a generated microservice project root (env: UNS_SCHEMA_PROJECT_ROOT).
                           When omitted, the tool auto-detects a generated project from the current working directory
                           and otherwise updates the uns-kit repo templates.
  --dry-run                Report file changes without writing anything
  --dictionary-only        Sync only the UNS dictionary export
  --measurements-only      Sync only the UNS measurements export
  --skip-generate          Skip generated TypeScript refresh
  --help, -h               Show this help
`);
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
    if (parentDir === probeDir) {
      break;
    }
    probeDir = parentDir;
  }

  throw new Error("Could not locate the @uns-kit/core package directory from sync-uns-schema.ts.");
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

function buildRepoTarget(repoRoot: string): SyncTarget {
  return {
    rootDir: repoRoot,
    label: "uns-kit repo templates",
    dictionaryJson: path.join(repoRoot, "packages/uns-cli/templates/uns-dictionary/uns-dictionary.json"),
    measurementsJson: path.join(repoRoot, "packages/uns-cli/templates/uns-measurements/uns-measurements.json"),
    dictionaryGenerated: [
      path.join(repoRoot, "packages/uns-core/src/uns/uns-dictionary.generated.ts"),
      path.join(repoRoot, "packages/uns-cli/templates/default/src/uns/uns-dictionary.generated.ts"),
    ],
    measurementsGenerated: [
      path.join(repoRoot, "packages/uns-core/src/uns/uns-measurements.generated.ts"),
      path.join(repoRoot, "packages/uns-cli/templates/default/src/uns/uns-measurements.generated.ts"),
    ],
  };
}

function buildProjectTarget(projectRoot: string): SyncTarget {
  return {
    rootDir: projectRoot,
    label: "generated microservice project",
    dictionaryJson: path.join(projectRoot, "uns-dictionary.json"),
    measurementsJson: path.join(projectRoot, "uns-measurements.json"),
    dictionaryGenerated: [path.join(projectRoot, "src/uns/uns-dictionary.generated.ts")],
    measurementsGenerated: [path.join(projectRoot, "src/uns/uns-measurements.generated.ts")],
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

async function fetchDictionaryDocument(
  controllerUrl: string,
  token: string,
  status: SchemaStatus,
): Promise<DictionaryDocument> {
  const url = buildControllerUrl(controllerUrl, `api/schema/export/uns-dictionary?status=${encodeURIComponent(status)}`);
  const document = await fetchJson(url, token, "UNS dictionary");
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`Controller returned an invalid UNS dictionary document from ${url.toString()}.`);
  }
  return document as DictionaryDocument;
}

async function fetchMeasurementsDocument(controllerUrl: string, token: string): Promise<MeasurementsDocument> {
  const url = buildControllerUrl(controllerUrl, "api/schema/export/uns-measurements");
  const document = await fetchJson(url, token, "UNS measurements");
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error(`Controller returned an invalid UNS measurements document from ${url.toString()}.`);
  }
  return document as MeasurementsDocument;
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
    return `Token is invalid or expired (401). Provide a valid token via --token, UNS_CONTROLLER_TOKEN, or the interactive prompt.`;
  }

  if (response.status === 403) {
    return `Forbidden (403) while fetching ${label} export from ${url.toString()}. The token must have admin access.`;
  }

  const detail = extractErrorDetail(body);
  return `Failed to fetch ${label} export from ${url.toString()}: HTTP ${response.status}${detail ? ` - ${detail}` : ""}`;
}

function extractErrorDetail(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim().length > 0) {
      return parsed.error.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
      return parsed.message.trim();
    }
  } catch (error) {
    // Fall back to plain text handling below.
  }

  return trimmed.replace(/\s+/g, " ").slice(0, 200);
}

function formatJsonDocument(document: unknown): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

async function updateGeneratedFiles(
  filePaths: string[],
  content: string,
  repoRoot: string,
  dryRun: boolean,
): Promise<FileChangeResult[]> {
  return Promise.all(filePaths.map((filePath) => updateFile(filePath, content, repoRoot, dryRun)));
}

async function updateFile(
  filePath: string,
  content: string,
  repoRoot: string,
  dryRun: boolean,
): Promise<FileChangeResult> {
  const current = await readTextFileIfExists(filePath);
  const changed = current !== content;
  const relativePath = path.relative(repoRoot, filePath);

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

function countMeasurementCategories(document: MeasurementsDocument): number {
  return Object.entries(document).filter(([key, value]) => {
    if (key === "schemaVersion") return false;
    return !!value && typeof value === "object" && !Array.isArray(value);
  }).length;
}

function printSummary(summary: {
  controllerUrl: string;
  targetLabel: string;
  targetRoot: string;
  dryRun: boolean;
  skipGenerate: boolean;
  status: SchemaStatus;
  dictionary?: DictionarySummary;
  measurements?: MeasurementsSummary;
}): void {
  console.log("");
  console.log(summary.dryRun ? "Dry-run summary" : "Sync summary");
  console.log(`  Controller: ${summary.controllerUrl}`);
  console.log(`  Target: ${summary.targetLabel}`);
  console.log(`  Root: ${summary.targetRoot}`);
  console.log(`  Dictionary status: ${summary.status}`);

  if (summary.dictionary) {
    console.log(
      `  Dictionary: ${summary.dictionary.objectTypeCount} object types, ${summary.dictionary.attributeCount} attributes, JSON ${summary.dictionary.jsonChanged ? "changed" : "unchanged"}`,
    );
    if (summary.skipGenerate) {
      console.log("  Dictionary TS: skipped");
    } else {
      console.log(`  Dictionary TS: ${renderGeneratedSummary(summary.dictionary.generatedChanged)}`);
    }
  }

  if (summary.measurements) {
    console.log(
      `  Measurements: ${summary.measurements.categoryCount} categories, JSON ${summary.measurements.jsonChanged ? "changed" : "unchanged"}`,
    );
    if (summary.skipGenerate) {
      console.log("  Measurements TS: skipped");
    } else {
      console.log(`  Measurements TS: ${renderGeneratedSummary(summary.measurements.generatedChanged)}`);
    }
  }
}

function renderGeneratedSummary(results: FileChangeResult[]): string {
  if (!results.length) return "none";
  const changedCount = results.filter((result) => result.changed).length;
  return `${changedCount}/${results.length} file${results.length === 1 ? "" : "s"} changed`;
}

if (isDirectExecution) {
  main().catch((error) => {
    console.error("Failed to sync UNS schema:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
