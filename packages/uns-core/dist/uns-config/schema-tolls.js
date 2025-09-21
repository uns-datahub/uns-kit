// Shallow merge of two ZodObjects into one ZodObject
export function composeConfigSchema(a, b) {
    return a.merge(b);
}
