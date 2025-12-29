import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { zodToTs, printNode, withGetType } from "zod-to-ts";
import { z } from "zod";

import { hostValueSchema } from "../uns-config/host-placeholders.js";
import { secretValueSchema } from "../uns-config/secret-placeholders.js";
import { composeConfigSchema } from "../uns-config/schema-tools.js";

function write(filePath: string, data: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

let tsLoaderReady = false;

async function ensureTsLoader(): Promise<void> {
  if (tsLoaderReady) {
    return;
  }
  tsLoaderReady = true;
  try {
    await import("tsx/esm");
  } catch (error) {
    throw new Error(
      "Unable to load TypeScript project.config.extension. Install 'tsx' (e.g. pnpm add -D tsx) or provide a compiled JavaScript file.",
    );
  }
}

async function loadProjectExtrasSchema(): Promise<z.AnyZodObject> {
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
        return module.projectExtrasSchema as z.AnyZodObject;
      }

      throw new Error(`Module '${candidate}' does not export projectExtrasSchema.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load project config extension at '${candidate}': ${reason}`);
    }
  }

  const coreModule = await import("../config/project.config.extension.js");
  return coreModule.projectExtrasSchema as z.AnyZodObject;
}

// Keep placeholder-backed values as plain strings in the generated TypeScript typings so
// consuming code reflects the resolved shapes while the JSON schema still exposes full unions.
const renderAsString = (typescript: any) =>
  typescript.factory.createKeywordTypeNode(typescript.SyntaxKind.StringKeyword);

for (const schema of [hostValueSchema, secretValueSchema]) {
  withGetType(schema, renderAsString);
}

const { unsCoreSchema } = await import("../uns-config/uns-core-schema.js");
const projectExtrasSchema = await loadProjectExtrasSchema();
const baseSchema = composeConfigSchema(unsCoreSchema, projectExtrasSchema).strict();

// 1) JSON Schema for VS Code $schema
const jsonSchema = zodToJsonSchema(baseSchema, "AppConfig");
write(path.resolve("config.schema.json"), JSON.stringify(jsonSchema, null, 2));

// 2) TypeScript `export type AppConfig = {...}`
const { node } = zodToTs(baseSchema, "AppConfig");
const interfaceBody = printNode(node);

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

const tsContent = `/* Auto-generated. Do not edit by hand. */\nexport interface ProjectAppConfig ${interfaceBody}\n\nexport interface AppConfig extends ProjectAppConfig {}${augmentationBlock}`;

write(path.resolve("./src/config/app-config.ts"), tsContent);

console.log("Generated config.schema.json and updated src/config/app-config.ts");
