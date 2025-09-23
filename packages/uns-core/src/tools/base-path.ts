import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { pkgDirSync } from "pkg-dir";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = pkgDirSync(moduleDir) ?? resolve(moduleDir, "../..");

export const basePath = packageRoot;
