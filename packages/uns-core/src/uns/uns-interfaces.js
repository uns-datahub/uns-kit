export function isIOS8601Type(value) {
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return iso8601Regex.test(value);
}
export const valueTypes = ["string", "number"];
