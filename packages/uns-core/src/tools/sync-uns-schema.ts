#!/usr/bin/env node
import { readFile } from "node:fs/promises";
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

const DEFAULT_STATUS: SchemaStatus = "active";
const GENERATOR_LANG = "sl";
const STATUS_VALUES: SchemaStatus[] = ["active", "draft", "deprecated", "all"];

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const repoRoot = await findRepoRoot();
  const files = {
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
    const jsonResult = await updateFile(files.dictionaryJson, content, repoRoot, args.dryRun);
    const generatedChanged = args.skipGenerate
      ? []
      : await updateGeneratedFiles(
          files.dictionaryGenerated,
          renderDictionaryTs(dictionaryDocument, GENERATOR_LANG),
          repoRoot,
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
    const jsonResult = await updateFile(files.measurementsJson, content, repoRoot, args.dryRun);
    const generatedChanged = args.skipGenerate
      ? []
      : await updateGeneratedFiles(
          files.measurementsGenerated,
          renderMeasurementsTs(measurementsDocument, GENERATOR_LANG),
          repoRoot,
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
    dryRun: args.dryRun,
    skipGenerate: args.skipGenerate,
    status: args.status,
    dictionary: dictionarySummary,
    measurements: measurementsSummary,
  });
}

function parseArgs(argv: string[]): CliArgs {
  let controllerUrl = process.env.UNS_CONTROLLER_URL?.trim() ?? "";
  let token = process.env.UNS_CONTROLLER_TOKEN?.trim() ?? "";
  let status = normalizeStatus(process.env.UNS_SCHEMA_STATUS, DEFAULT_STATUS);
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

  if (!help) {
    if (dictionaryOnly && measurementsOnly) {
      throw new Error("Choose either --dictionary-only or --measurements-only, not both.");
    }
    if (!controllerUrl) {
      throw new Error("Missing controller URL. Use --controller-url or set UNS_CONTROLLER_URL.");
    }
    if (!token) {
      throw new Error("Missing controller token. Use --token or set UNS_CONTROLLER_TOKEN.");
    }
    assertValidUrl(controllerUrl);
  }

  return {
    controllerUrl,
    token,
    status,
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
JSON templates plus generated TypeScript artifacts.

Options:
  --controller-url <url>   Controller base URL (env: UNS_CONTROLLER_URL)
  --token <token>          Bearer token for REST export (env: UNS_CONTROLLER_TOKEN)
  --status <value>         Dictionary status filter: ${STATUS_VALUES.join("|")} (default: ${DEFAULT_STATUS}, env: UNS_SCHEMA_STATUS)
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
    return `Unauthorized (401) while fetching ${label} export from ${url.toString()}. Check --token or UNS_CONTROLLER_TOKEN.`;
  }

  if (response.status === 403) {
    return `Forbidden (403) while fetching ${label} export from ${url.toString()}. The token must have operator or admin access.`;
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
  dryRun: boolean;
  skipGenerate: boolean;
  status: SchemaStatus;
  dictionary?: DictionarySummary;
  measurements?: MeasurementsSummary;
}): void {
  console.log("");
  console.log(summary.dryRun ? "Dry-run summary" : "Sync summary");
  console.log(`  Controller: ${summary.controllerUrl}`);
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
