import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { zodToTs, printNode } from "zod-to-ts";
import { z } from "zod";

import { composeConfigSchema } from "../uns-config/schema-tools.js";
import { unsCoreSchema } from "../uns-config/uns-core-schema.js";
import { projectExtrasSchema as coreProjectExtrasSchema } from "../config/project.config.extension.js";

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

  return coreProjectExtrasSchema as z.AnyZodObject;
}

const projectExtrasSchema = await loadProjectExtrasSchema();
const baseSchema = composeConfigSchema(unsCoreSchema, projectExtrasSchema).strict();

// 1) JSON Schema for VS Code $schema
const jsonSchema = zodToJsonSchema(baseSchema, "AppConfig");
write(path.resolve("config.schema.json"), JSON.stringify(jsonSchema, null, 2));

// 2) TypeScript `export type AppConfig = {...}`
const { node } = zodToTs(baseSchema, "AppConfig");
const tsContent =
  "/* Auto-generated. Do not edit by hand. */\n" +
  "export type AppConfig = " +
  printNode(node) +
  "\n";

write(path.resolve("./src/config/app-config.ts"), tsContent);

try {
  const corePackageDir = path.dirname(require.resolve("@uns-kit/core/package.json", {
    paths: [process.cwd()]
  }));

  const coreDistConfigDir = path.join(corePackageDir, "dist", "config");
  write(path.join(coreDistConfigDir, "app-config.d.ts"), tsContent);

  const coreSrcConfigPath = path.join(corePackageDir, "src", "config", "app-config.ts");
  if (fs.existsSync(path.dirname(coreSrcConfigPath))) {
    write(coreSrcConfigPath, tsContent);
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(`Warning: unable to update @uns-kit/core app-config types: ${reason}`);
}

console.log("Generated config.schema.json and propagated app-config types");
