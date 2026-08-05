import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { type TypeOverrideMap, createAuxiliaryTypeStore, printNode, zodToTs } from "zod-to-ts";

import { hostValueSchema } from "../uns-config/host-placeholders.js";
import { type ConfigObjectSchema, composeConfigSchema } from "../uns-config/schema-tools.js";
import { secretValueSchema } from "../uns-config/secret-placeholders.js";

function write(filePath: string, data: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

type JsonSchemaRecord = Record<string, unknown>;

function normalizeLegacyJsonSchema(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(normalizeLegacyJsonSchema);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }

  const schema = value as JsonSchemaRecord;
  Object.values(schema).forEach(normalizeLegacyJsonSchema);

  if (schema.type === "number" && schema.multipleOf === 1) {
    schema.type = "integer";
    delete schema.multipleOf;
  }
  if (schema.format === "email") {
    delete schema.pattern;
  }
  if (Array.isArray(schema.oneOf) && !schema.anyOf) {
    schema.anyOf = schema.oneOf;
    delete schema.oneOf;
  }

  if (Array.isArray(schema.anyOf)) {
    const literalOptions = schema.anyOf as JsonSchemaRecord[];
    const literalType = literalOptions[0]?.type;
    if (
      literalOptions.length > 0 &&
      typeof literalType === "string" &&
      literalOptions.every((option) => option.type === literalType && Object.hasOwn(option, "const"))
    ) {
      schema.type = literalType;
      schema.enum = literalOptions.map((option) => option.const);
      delete schema.anyOf;
    }
  }
}

let tsLoaderReady = false;

async function ensureTsLoader(): Promise<void> {
  if (tsLoaderReady) {
    return;
  }
  tsLoaderReady = true;
  try {
    await import("tsx/esm");
  } catch {
    throw new Error(
      "Unable to load TypeScript project.config.extension. Install 'tsx' (e.g. pnpm add -D tsx) or provide a compiled JavaScript file.",
    );
  }
}

async function loadProjectExtrasSchema(): Promise<ConfigObjectSchema> {
  const base = path.resolve(process.cwd(), "src/config/project.config.extension");
  const extensions = ["", ".ts", ".mts", ".tsx", ".js", ".mjs", ".cjs"];

  for (const ext of extensions) {
    const candidate = ext ? `${base}${ext}` : base;
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const lowerExt = path.extname(candidate).toLowerCase();
    try {
      if (lowerExt === ".ts" || lowerExt === ".mts" || lowerExt === ".tsx") {
        await ensureTsLoader();
      }

      const module = await import(pathToFileURL(candidate).href);
      if (module?.projectExtrasSchema) {
        return module.projectExtrasSchema as ConfigObjectSchema;
      }

      throw new Error(`Module '${candidate}' does not export projectExtrasSchema.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load project config extension at '${candidate}': ${reason}`);
    }
  }

  const coreModule = await import("../config/project.config.extension.js");
  return coreModule.projectExtrasSchema as ConfigObjectSchema;
}

// Keep placeholder-backed values as plain strings in the generated TypeScript typings so
// consuming code reflects the resolved shapes while the JSON schema still exposes full unions.
const renderAsString: TypeOverrideMap extends Map<unknown, infer TOverride> ? TOverride : never = (typescript) =>
  typescript.factory.createKeywordTypeNode(typescript.SyntaxKind.StringKeyword);

const typeOverrides: TypeOverrideMap = new Map();
typeOverrides.set(hostValueSchema, renderAsString);
typeOverrides.set(secretValueSchema, renderAsString);

const { unsCoreSchema } = await import("../uns-config/uns-core-schema.js");
const projectExtrasSchema = await loadProjectExtrasSchema();
const baseSchema = composeConfigSchema(unsCoreSchema, projectExtrasSchema).strict();

// 1) JSON Schema for VS Code $schema
const generatedJsonSchema = z.toJSONSchema(baseSchema, {
  io: "input",
  reused: "inline",
  target: "draft-07",
});
normalizeLegacyJsonSchema(generatedJsonSchema);
const { $schema, definitions: reusedDefinitions, ...appConfigDefinition } = generatedJsonSchema;
const jsonSchema = {
  $ref: "#/definitions/AppConfig",
  definitions: {
    AppConfig: appConfigDefinition,
    ...((reusedDefinitions ?? {}) as Record<string, unknown>),
  },
  $schema,
};
write(path.resolve("config.schema.json"), JSON.stringify(jsonSchema, null, 2));

// 2) TypeScript `export type AppConfig = {...}`
const auxiliaryTypeStore = createAuxiliaryTypeStore();
const { node } = zodToTs(baseSchema, {
  auxiliaryTypeStore,
  io: "input",
  overrides: typeOverrides,
});
const interfaceBody = printNode(node)
  .replace(/^\s*\[x: string\]: never;\n/gm, "")
  .replace(/\[key: string\]:/g, "[x: string]:");
const auxiliaryTypes = [...auxiliaryTypeStore.definitions.values()].map((definition) => printNode(definition.node)).join("\n");

let shouldAugment = true;
try {
  const pkgJsonPath = path.resolve(process.cwd(), "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    if (pkg?.name === "@uns-kit/core") {
      shouldAugment = false;
    }
  }
} catch {
  shouldAugment = true;
}

const augmentationBlock = shouldAugment
  ? `\n\ntype GeneratedProjectAppConfig = ProjectAppConfig;\ntype GeneratedAppConfig = AppConfig;\n\ndeclare module "@uns-kit/core/config/app-config.js" {\n  interface ProjectAppConfig extends GeneratedProjectAppConfig {}\n  interface AppConfig extends GeneratedAppConfig {}\n}\n`
  : "\n";

const auxiliaryPreamble = auxiliaryTypes ? `${auxiliaryTypes}\n\n` : "";
const tsContent = `/* Auto-generated. Do not edit by hand. */\n${auxiliaryPreamble}export interface ProjectAppConfig ${interfaceBody}\n\nexport interface AppConfig extends ProjectAppConfig {}${augmentationBlock}`;

write(path.resolve("./src/config/app-config.ts"), tsContent);

console.log("Generated config.schema.json and updated src/config/app-config.ts");
