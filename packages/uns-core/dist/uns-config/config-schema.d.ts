import { z } from "zod";
export declare const baseSchema: z.ZodObject<any, "strict", any, {
    [x: string]: any;
}, {
    [x: string]: any;
}>;
export type AppConfigFromZod = z.infer<typeof baseSchema>;
//# sourceMappingURL=config-schema.d.ts.map