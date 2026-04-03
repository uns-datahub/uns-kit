export function isIOS8601Type(value) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return iso8601Regex.test(value);
}
export const valueTypes = ["string", "number"];
export const questDbPrimitiveTypes = [
    "boolean",
    "ipv4",
    "byte",
    "short",
    "char",
    "int",
    "float",
    "symbol",
    "varchar",
    "string",
    "long",
    "date",
    "timestamp",
    "timestamp_ns",
    "double",
    "uuid",
    "binary",
    "long256",
];
const questDbPrimitiveTypeSet = new Set(questDbPrimitiveTypes);
const questDbGeohashRegex = /^geohash\(\d+[bc]\)$/;
const questDbDecimalRegex = /^decimal\(\d+,\d+\)$/;
const questDbArrayRegex = /^array<[^>]+>$/;
export function isQuestDbType(value) {
    if (typeof value !== "string") {
        return false;
    }
    if (questDbPrimitiveTypeSet.has(value)) {
        return true;
    }
    return (questDbGeohashRegex.test(value) ||
        questDbDecimalRegex.test(value) ||
        questDbArrayRegex.test(value));
}
//# sourceMappingURL=uns-interfaces.js.map