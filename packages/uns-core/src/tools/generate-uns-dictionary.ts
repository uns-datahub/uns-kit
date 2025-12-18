#!/usr/bin/env node
/**
 * Generate a TypeScript dictionary of object types and attributes (with descriptions)
 * from a JSON file. The output is meant for IntelliSense and metadata enrichment
 * (e.g., emitting descriptions alongside topics). No GraphQL calls are performed.
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

type DictionaryEntry = {
  description?: string | null;
  descriptions?: Record<string, string | null | undefined>;
};
type ObjectTypeEntry = DictionaryEntry & {
  attributes?: string[] | null;
};
type UnsDictionary = {
  objectTypes?: Record<string, ObjectTypeEntry>;
  attributes?: Record<string, DictionaryEntry>;
};

type CliArgs = {
  input: string;
  output: string;
  lang: string;
};

const DEFAULT_INPUT = "uns-dictionary.json";
const DEFAULT_OUTPUT = path.resolve(process.cwd(), "src/uns/uns-dictionary.generated.ts");

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await generateUnsDictionary(args);
}

function parseArgs(argv: string[]): CliArgs {
  let input = DEFAULT_INPUT;
  let output = DEFAULT_OUTPUT;
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

  return { input, output, lang };
}

function printHelp(): void {
  console.log(`Usage: tsx packages/uns-core/src/tools/generate-uns-dictionary.ts [options]

Options:
  --input <file>        Path to uns-dictionary.json (default: ${DEFAULT_INPUT})
  --output <file>       Path to generated TS file (default: src/uns/uns-dictionary.generated.ts)
  --lang <code>         Preferred description language code (default: "sl")
  --help, -h            Show this help
`);
}

async function readDictionaryFromJson(filePath: string): Promise<UnsDictionary> {
  const absolute = path.resolve(process.cwd(), filePath);
  const raw = await readFile(absolute, "utf8");
  return JSON.parse(raw) as UnsDictionary;
}

export async function generateUnsDictionary(args: Partial<CliArgs>): Promise<void> {
  const effective: CliArgs = {
    input: args.input ?? DEFAULT_INPUT,
    output: args.output ?? DEFAULT_OUTPUT,
    lang: args.lang ?? "sl",
  };

  const dictionary = await readDictionaryFromJson(effective.input);
  await writeDictionaryTs(dictionary, effective.output, effective.lang);
  console.log(`Generated dictionary -> ${effective.output}`);
}

const resolveDescription = (entry: DictionaryEntry | undefined, lang: string): string | undefined => {
  if (!entry) return undefined;
  const byLang = entry.descriptions?.[lang];
  if (byLang && byLang.length > 0) return byLang;
  if (entry.description && entry.description.length > 0) return entry.description;
  return undefined;
};

async function writeDictionaryTs(dictionary: UnsDictionary, filePath: string, lang: string): Promise<void> {
  const objectTypeEntries = Object.entries(dictionary.objectTypes ?? {});
  const attributeEntries = Object.entries(dictionary.attributes ?? {});
  const attributesByType: Record<string, string[]> = {};
  for (const [name, entry] of objectTypeEntries) {
    if (Array.isArray(entry.attributes) && entry.attributes.length > 0) {
      attributesByType[name] = entry.attributes.filter(Boolean) as string[];
    }
  }

  const renderRecord = (entries: [string, DictionaryEntry][]) =>
    entries
      .map(([name, entry]) => {
        const desc = resolveDescription(entry, lang);
        const doc = desc ? `  /** ${desc} */\n` : "";
        return `${doc}  "${name}": "${name}",`;
      })
      .join("\n");

  const renderDescriptions = (entries: [string, DictionaryEntry][]) =>
    entries
      .map(([name, value]) => `  "${name}": ${JSON.stringify(resolveDescription(value, lang) ?? "")},`)
      .join("\n");

  const objectTypeConst = `export const GeneratedObjectTypes = {\n${renderRecord(objectTypeEntries)}\n} as const;`;
  const objectTypeDescConst = `export const GeneratedObjectTypeDescriptions: Record<keyof typeof GeneratedObjectTypes, string> = {\n${renderDescriptions(objectTypeEntries)}\n};`;

  const attributeConst = `export const GeneratedAttributes = {\n${renderRecord(attributeEntries)}\n} as const;`;
  const attributeDescConst = `export const GeneratedAttributeDescriptions: Record<keyof typeof GeneratedAttributes, string> = {\n${renderDescriptions(attributeEntries)}\n};`;

  const renderAttributesByType = () => {
    const blocks: string[] = [];
    for (const [objectType, attrs] of Object.entries(attributesByType)) {
      if (!attrs.length) continue;
      const lines = attrs
        .map((attr) => {
          const desc = resolveDescription(dictionary.attributes?.[attr], lang);
          const doc = desc ? `    /** ${desc} */\n` : "";
          return `${doc}    "${attr}": "${attr}",`;
        })
        .join("\n");
      blocks.push(`  "${objectType}": {\n${lines}\n  },`);
    }
    return blocks.join("\n");
  };

  const attributesByTypeConst = `const GeneratedAttributesByTypeBase = {\n${renderAttributesByType()}\n} as const;\n\nexport const GeneratedAttributesByType = GeneratedAttributesByTypeBase;`;

  const content = `/* Auto-generated by generate-uns-dictionary.ts. Do not edit by hand. */\n${objectTypeConst}\n\n${objectTypeDescConst}\n\nexport type GeneratedObjectTypeName = keyof typeof GeneratedObjectTypes;\n\nexport function getGeneratedObjectTypeDescription(name: string): string | undefined {\n  return (GeneratedObjectTypeDescriptions as Record<string, string | undefined>)[name];\n}\n\n${attributeConst}\n\n${attributeDescConst}\n\n${attributesByTypeConst}\n\nexport type GeneratedAttributeName = keyof typeof GeneratedAttributes;\n\nexport type GeneratedAttributesFor<T extends keyof typeof GeneratedAttributesByType> = keyof typeof GeneratedAttributesByType[T];\n\nexport function getGeneratedAttributeDescription(name: string): string | undefined {\n  return (GeneratedAttributeDescriptions as Record<string, string | undefined>)[name];\n}\n`;

  const absolute = path.resolve(process.cwd(), filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content, "utf8");
}

main().catch((error) => {
  console.error("Failed to generate UNS dictionary:", error);
  process.exitCode = 1;
});
