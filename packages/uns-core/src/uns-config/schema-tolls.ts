import { z } from "zod";

// Shallow merge of two ZodObjects into one ZodObject
export function composeConfigSchema<
  A extends z.AnyZodObject,
  B extends z.AnyZodObject
>(a: A, b: B): z.ZodObject<A["shape"] & B["shape"]> {
  return a.merge(b) as any;
}
