import { z } from "zod";

export type ConfigObjectSchema = z.ZodObject<z.ZodRawShape>;

type SchemaShape<TSchema extends ConfigObjectSchema> = TSchema extends z.ZodObject<infer TShape> ? TShape : never;

type MergedExtraShapes<
  TSchemas extends readonly ConfigObjectSchema[],
  TShape extends z.ZodRawShape = Record<never, never>,
> = TSchemas extends readonly [infer THead extends ConfigObjectSchema, ...infer TTail extends readonly ConfigObjectSchema[]]
  ? MergedExtraShapes<TTail, TShape & SchemaShape<THead>>
  : TShape;

function shapeKeys(schema: ConfigObjectSchema): string[] {
  return Object.keys(schema.shape);
}

export function composeConfigSchema(core: ConfigObjectSchema): ConfigObjectSchema;
export function composeConfigSchema<TCore extends ConfigObjectSchema, TExtras extends readonly ConfigObjectSchema[]>(
  core: TCore,
  ...extras: TExtras
): z.ZodObject<SchemaShape<TCore> & MergedExtraShapes<TExtras>>;
export function composeConfigSchema(core: ConfigObjectSchema, ...extras: ConfigObjectSchema[]): ConfigObjectSchema {
  const coreKeys = new Set(shapeKeys(core));
  let composed = core;

  for (const ext of extras) {
    const keys = shapeKeys(ext);
    const overlaps = keys.filter((k) => coreKeys.has(k));
    if (overlaps.length) {
      throw new Error(`Project extras overlap UNS core keys: ${overlaps.join(", ")}`);
    }
    keys.forEach((k) => coreKeys.add(k));
    composed = composed.extend(ext.shape);
  }

  return composed;
}
