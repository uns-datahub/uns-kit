import { z } from "zod";
import { composeConfigSchema } from "./schema-tools";
import { unsCoreSchema } from "./uns-core-schema";
import { projectExtrasSchema } from "../config/project.config.extension";

// Plain strict object for generators (no Effects, no dynamic imports)
export const baseSchema = composeConfigSchema(unsCoreSchema, projectExtrasSchema).strict();

// Optional: export type from here too (handy for other libs)
export type AppConfigFromZod = z.infer<typeof baseSchema>;
