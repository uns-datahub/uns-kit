import { z } from "zod";
export declare const projectExtrasSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type ProjectExtras = z.infer<typeof projectExtrasSchema>;
