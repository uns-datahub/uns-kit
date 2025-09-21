// scripts/generate-config-artifacts.ts
import fs from "node:fs";
import path from "node:path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { zodToTs, printNode } from "zod-to-ts";

// Import the plain ZodObject (no superRefine)
import { baseSchema } from "../uns-config/config-schema.js";

function write(filePath: string, data: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);
}

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

// Put it wherever you want. You earlier asked for root (beside config-file.ts):
write(path.resolve("./src/app-config.ts"), tsContent);

console.log("Generated config.schema.json and app-config.ts");
