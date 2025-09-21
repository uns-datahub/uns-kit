import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const fName = fileURLToPath(import.meta.url);
const dName = dirname(fName);
export const basePath = resolve(dName, "..");
