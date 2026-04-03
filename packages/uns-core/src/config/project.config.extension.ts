import { z } from "zod";

// Exported constant in PascalCase
export const projectExtrasSchema = z.object({});

export type ProjectExtras = z.infer<typeof projectExtrasSchema>;
