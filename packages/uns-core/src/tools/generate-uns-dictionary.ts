#!/usr/bin/env node
/**
 * Generate a TypeScript dictionary of object types and attributes (with descriptions)
 * from a JSON file or by fetching from GraphQL. The output is meant for IntelliSense
 * and metadata enrichment (e.g., emitting descriptions alongside topics).
 *
 * JSON shape (example):
 * {
 *   "objectTypes": {
 *     "energy-resource": { "description": "Energy carriers (electricity/steam/gas)" },
 *     "custom-type": { "description": "Tenant-specific thing" }
 *   },
 *   "attributes": {
 *     "cumulative-active-energy-delivered": { "description": "kWh total" },
 *     "status": { "description": "Generic status" }
 *   }
 * }
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GraphQLClient, ClientError, gql } from "graphql-request";
import { ConfigFile } from "../config-file.js";
import { AuthClient } from "./auth/index.js";

type DictionaryEntry = {
  description?: string | null;
  descriptions?: Record<string, string | null | undefined>;
};
type UnsDictionary = {
  objectTypes?: Record<string, DictionaryEntry>;
  attributes?: Record<string, DictionaryEntry>;
};

type CliArgs = {
  input: string;
  output: string;
  jsonOut: string;
  fromGraphql: boolean;
  queryFile?: string;
  writeMergedJson: boolean;
  priority: "overlay" | "base";
  lang: string;
};

const DEFAULT_INPUT = "uns-dictionary.json";
const DEFAULT_OUTPUT = path.resolve(process.cwd(), "src/uns/uns-dictionary.generated.ts");
const DEFAULT_JSON_OUT = path.resolve(process.cwd(), DEFAULT_INPUT);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const baseDictionary = await readDictionaryIfExists(args.input);
  const overlayDictionary = args.fromGraphql
    ? await fetchDictionaryFromGraphql(args.queryFile)
    : {};

  const { merged, differences } = mergeDictionaries(baseDictionary, overlayDictionary, args.priority, args.lang);

  if (differences.length) {
    console.log("Overlay changes applied:");
    for (const diff of differences) {
      console.log(`  [${diff.section}] ${diff.key}: "${diff.from ?? ""}" -> "${diff.to ?? ""}"`);
    }
  } else {
    console.log("No overlay changes applied.");
  }

  // Persist the merged JSON only when explicitly requested.
  if (args.writeMergedJson) {
    await writeJson(merged, args.jsonOut);
  }

  await writeDictionaryTs(merged, args.output, args.lang);
  console.log(`Generated dictionary -> ${args.output}`);
}

function parseArgs(argv: string[]): CliArgs {
  let input = DEFAULT_INPUT;
  let output = DEFAULT_OUTPUT;
  let jsonOut = DEFAULT_JSON_OUT;
  let fromGraphql = false;
  let queryFile: string | undefined;
  let writeMergedJson = false;
  let priority: "overlay" | "base" = "overlay";
  let lang = "sl";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      input = argv[++i];
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      output = argv[++i];
      continue;
    }
    if (arg === "--json-out" && argv[i + 1]) {
      jsonOut = argv[++i];
      continue;
    }
    if (arg === "--write-merged-json") {
      writeMergedJson = true;
      continue;
    }
    if (arg === "--from-graphql") {
      fromGraphql = true;
      continue;
    }
    if (arg === "--query-file" && argv[i + 1]) {
      queryFile = argv[++i];
      continue;
    }
    if (arg === "--priority" && argv[i + 1]) {
      const val = argv[++i];
      if (val !== "overlay" && val !== "base") {
        throw new Error(`Invalid priority "${val}". Use "overlay" or "base".`);
      }
      priority = val;
      continue;
    }
    if (arg === "--lang" && argv[i + 1]) {
      lang = argv[++i];
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { input, output, jsonOut, fromGraphql, queryFile, writeMergedJson, priority, lang };
}

function printHelp(): void {
  console.log(`Usage: tsx packages/uns-core/src/tools/generate-uns-dictionary.ts [options]

Options:
  --input <file>        Path to uns-dictionary.json (default: ${DEFAULT_INPUT})
  --output <file>       Path to generated TS file (default: src/uns/uns-dictionary.generated.ts)
  --json-out <file>     Where to write merged JSON (default: ${DEFAULT_JSON_OUT})
  --write-merged-json   Persist the merged JSON (otherwise JSON is left untouched)
  --from-graphql        Fetch dictionary from GraphQL instead of reading local JSON
  --query-file <file>   Optional .graphql/.gql file to override the default query
  --priority <p>        Merge priority: "overlay" (default) or "base" (keep base descriptions)
  --lang <code>         Preferred description language code (default: "sl")
  --help, -h            Show this help
`);
}

async function readDictionaryFromJson(filePath: string): Promise<UnsDictionary> {
  const absolute = path.resolve(process.cwd(), filePath);
  const raw = await readFile(absolute, "utf8");
  return JSON.parse(raw) as UnsDictionary;
}

async function readDictionaryIfExists(filePath: string): Promise<UnsDictionary> {
  try {
    return await readDictionaryFromJson(filePath);
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function fetchDictionaryFromGraphql(queryFile?: string): Promise<UnsDictionary> {
  const config = await ConfigFile.loadConfig();
  const auth = await AuthClient.create();
  let accessToken = await auth.getAccessToken();

  const client = new GraphQLClient(config.uns.graphql, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const querySource = queryFile
    ? await readFile(path.resolve(process.cwd(), queryFile), "utf8")
    : DEFAULT_DICTIONARY_QUERY;

  const document = gql`${querySource}`;

  async function requestWithAuth<T>(documentToRun: any): Promise<T> {
    try {
      return await client.request<T>(documentToRun);
    } catch (err: any) {
      const isAuthErr = err instanceof ClientError && (err.response.status === 401 || err.response.status === 403);
      if (isAuthErr) {
        accessToken = await auth.getAccessToken();
        client.setHeader("Authorization", `Bearer ${accessToken}`);
        return await client.request<T>(documentToRun);
      }
      throw err;
    }
  }

  const data: any = await requestWithAuth(document);

  const objectTypeArray =
    data?.GetObjectTypes ??
    data?.objectTypes ??
    data?.unsDictionary?.objectTypes ??
    [];

  const attributeArray =
    data?.GetAttributes ??
    data?.attributes ??
    data?.unsDictionary?.attributes ??
    [];

  const objectTypes: Record<string, DictionaryEntry> = {};
  for (const item of objectTypeArray) {
    if (item?.name) {
      objectTypes[item.name] = { description: item.description ?? undefined };
    }
  }

  const attributes: Record<string, DictionaryEntry> = {};
  for (const item of attributeArray) {
    if (item?.name) {
      attributes[item.name] = { description: item.description ?? undefined };
    }
  }

  return { objectTypes, attributes };
}

async function writeJson(dictionary: UnsDictionary, filePath: string): Promise<void> {
  const absolute = path.resolve(process.cwd(), filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, JSON.stringify(dictionary, null, 2) + "\n", "utf8");
  console.log(`Wrote dictionary JSON -> ${absolute}`);
}

type Diff = { section: "objectTypes" | "attributes"; key: string; from?: string; to?: string };

const resolveDescription = (entry: DictionaryEntry | undefined, lang: string): string | undefined => {
  if (!entry) return undefined;
  const byLang = entry.descriptions?.[lang];
  if (byLang && byLang.length > 0) return byLang;
  if (entry.description && entry.description.length > 0) return entry.description;
  return undefined;
};

function mergeDictionaries(base: UnsDictionary, overlay: UnsDictionary, priority: "overlay" | "base", lang: string): { merged: UnsDictionary; differences: Diff[] } {
  const differences: Diff[] = [];

  const mergeSection = (
    baseSection: Record<string, DictionaryEntry> = {},
    overlaySection: Record<string, DictionaryEntry> = {},
    section: Diff["section"],
  ) => {
    const result: Record<string, DictionaryEntry> = { ...baseSection };
    for (const [key, value] of Object.entries(overlaySection)) {
      const baseEntry = result[key];
      const mergedEntry: DictionaryEntry = {
        ...(baseEntry ?? {}),
        descriptions: { ...(baseEntry?.descriptions ?? {}), ...(value.descriptions ?? {}) },
      };

      if (value.description !== undefined) {
        mergedEntry.description = value.description ?? undefined;
      }

      if (!baseEntry) {
        result[key] = mergedEntry;
        const toDesc = resolveDescription(mergedEntry, lang) ?? "";
        differences.push({ section, key, from: undefined, to: toDesc });
        continue;
      }

      const baseDesc = resolveDescription(baseEntry, lang);
      const overlayDesc = resolveDescription(value, lang);
      const shouldOverride = priority === "overlay" && overlayDesc && overlayDesc.length > 0;

      if (shouldOverride && overlayDesc !== baseDesc) {
        differences.push({ section, key, from: baseDesc ?? "", to: overlayDesc });
        // mergedEntry already contains overlay descriptions; resolved value will pick it up.
      }

      result[key] = mergedEntry;
    }
    return result;
  };

  const merged = {
    objectTypes: mergeSection(base.objectTypes, overlay.objectTypes, "objectTypes"),
    attributes: mergeSection(base.attributes, overlay.attributes, "attributes"),
  };

  return { merged, differences };
}

async function writeDictionaryTs(dictionary: UnsDictionary, filePath: string, lang: string): Promise<void> {
  const objectTypeEntries = Object.entries(dictionary.objectTypes ?? {});
  const attributeEntries = Object.entries(dictionary.attributes ?? {});

  const renderRecord = (entries: [string, DictionaryEntry][]) =>
    entries
      .map(([name]) => `  "${name}": "${name}",`)
      .join("\n");

  const renderDescriptions = (entries: [string, DictionaryEntry][]) =>
    entries
      .map(([name, value]) => `  "${name}": ${JSON.stringify(resolveDescription(value, lang) ?? "")},`)
      .join("\n");

  const objectTypeConst = `export const GeneratedObjectTypes = {\n${renderRecord(objectTypeEntries)}\n} as const;`;
  const objectTypeDescConst = `export const GeneratedObjectTypeDescriptions: Record<keyof typeof GeneratedObjectTypes, string> = {\n${renderDescriptions(objectTypeEntries)}\n};`;

  const attributeConst = `export const GeneratedAttributes = {\n${renderRecord(attributeEntries)}\n} as const;`;
  const attributeDescConst = `export const GeneratedAttributeDescriptions: Record<keyof typeof GeneratedAttributes, string> = {\n${renderDescriptions(attributeEntries)}\n};`;

  const content = `/* Auto-generated by generate-uns-dictionary.ts. Do not edit by hand. */\n${objectTypeConst}\n\n${objectTypeDescConst}\n\nexport type GeneratedObjectTypeName = keyof typeof GeneratedObjectTypes;\n\nexport function getGeneratedObjectTypeDescription(name: string): string | undefined {\n  return (GeneratedObjectTypeDescriptions as Record<string, string | undefined>)[name];\n}\n\n${attributeConst}\n\n${attributeDescConst}\n\nexport type GeneratedAttributeName = keyof typeof GeneratedAttributes;\n\nexport function getGeneratedAttributeDescription(name: string): string | undefined {\n  return (GeneratedAttributeDescriptions as Record<string, string | undefined>)[name];\n}\n`;

  const absolute = path.resolve(process.cwd(), filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

const DEFAULT_DICTIONARY_QUERY = /* GraphQL */ `
  query GetUnsDictionary {
    GetObjectTypes {
      name
      description
    }
    GetAttributes {
      name
      description
    }
  }
`;

main().catch((error) => {
  console.error("Failed to generate UNS dictionary:", error);
  process.exitCode = 1;
});
