import { z } from "zod";
export declare function composeConfigSchema<A extends z.AnyZodObject, B extends z.AnyZodObject>(a: A, b: B): z.ZodObject<A["shape"] & B["shape"]>;
//# sourceMappingURL=schema-tolls.d.ts.map