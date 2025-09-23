import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { existsSync } from "fs";
import { packageDirectorySync } from "pkg-dir";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

const packageDirectorySyncAny = packageDirectorySync as unknown as ((arg?: unknown) => string | undefined) | undefined;

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

const resolveCandidate = (candidate?: string): string | undefined => {
  if (!candidate) return undefined;

  const directory = resolve(candidate);

  if (typeof packageDirectorySyncAny === "function") {
    try {
      const result = packageDirectorySyncAny({ cwd: directory });
      if (typeof result === "string") {
        return result;
      }
    } catch {
      // ignore – fall back to alternate invocation style
    }

    try {
      const result = packageDirectorySyncAny(directory);
      if (typeof result === "string") {
        return result;
      }
    } catch {
      // ignore – fall back to manual search
    }
  }

  return fallbackFind(directory) ?? directory;
};

export interface ResolveBasePathOptions {
  start?: string;
  envBasePath?: string | null;
  cwd?: string;
}

export function resolveBasePath(options: ResolveBasePathOptions = {}): string {
  const { start, envBasePath = process.env.UNS_BASE_PATH ?? undefined, cwd = process.cwd() } = options;

  const candidates = [start, envBasePath ?? undefined, cwd, moduleDirectory];

  for (const candidate of candidates) {
    const resolved = resolveCandidate(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return resolve(moduleDirectory, "..");
}

export const basePath = resolveBasePath();
