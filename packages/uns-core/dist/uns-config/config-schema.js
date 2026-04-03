import { composeConfigSchema } from "./schema-tools.js";
import { unsCoreSchema } from "./uns-core-schema.js";
import { projectExtrasSchema } from "../config/project.config.extension.js";
// Plain strict object for generators (no Effects, no dynamic imports)
export const baseSchema = composeConfigSchema(unsCoreSchema, projectExtrasSchema).strict();
//# sourceMappingURL=config-schema.js.map