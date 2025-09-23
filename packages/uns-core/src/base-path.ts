import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { existsSync } from "fs";
import { packageDirectorySync } from "pkg-dir";

const fallbackFind = (start: string): string | undefined => {
  let current = resolve(start);

  while (true) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
};

const packageDirectorySyncAny = packageDirectorySync as unknown as (arg?: unknown) => string | undefined;

const resolveWithPkgDir = (directory: string): string | undefined => {
  if (typeof packageDirectorySyncAny !== "function") {
    return undefined;
  }

  try {
    const result = packageDirectorySyncAny({ cwd: directory });
    if (result) return result;
  } catch {
    // ignore – fall back to alternate invocation style
  }

  try {
    const result = packageDirectorySyncAny(directory);
    if (typeof result === "string") return result;
  } catch {
    // ignore – fall back to manual search
  }

  return undefined;
};

const resolveFrom = (start?: string): string | undefined => {
  if (!start) return undefined;
  const directory = resolve(start);
  return resolveWithPkgDir(directory) ?? fallbackFind(directory) ?? directory;
};

const moduleDir = dirname(fileURLToPath(import.meta.url));

const envRoot = resolveFrom(process.env.UNS_BASE_PATH);
const cwdRoot = resolveFrom(process.cwd());
const packageRoot = resolveFrom(moduleDir) ?? resolve(moduleDir, "..");

export const basePath = envRoot ?? cwdRoot ?? packageRoot;
