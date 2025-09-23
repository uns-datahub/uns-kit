import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { packageDirectorySync } from "pkg-dir";

const resolveFrom = (start?: string): string | undefined => {
  if (!start) return undefined;
  const directory = resolve(start);
  return packageDirectorySync({cwd:directory}) ?? directory;
};

const moduleDir = dirname(fileURLToPath(import.meta.url));

const envRoot = resolveFrom(process.env.UNS_BASE_PATH);
const cwdRoot = resolveFrom(process.cwd());
const packageRoot = resolveFrom(moduleDir) ?? resolve(moduleDir, "..");

export const basePath = envRoot ?? cwdRoot ?? packageRoot;
