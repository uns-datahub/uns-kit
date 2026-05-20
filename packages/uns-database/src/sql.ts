import fs from "node:fs/promises";
import path from "node:path";

export interface LoadSqlOptions {
  baseDir?: string;
}

export async function loadSqlFile(filePath: string, options: LoadSqlOptions = {}): Promise<string> {
  const resolvedPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(options.baseDir ?? process.cwd(), filePath);

  return fs.readFile(resolvedPath, "utf8");
}

export function resolveSqlFilePath(filePath: string, baseDir?: string): string {
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(baseDir ?? process.cwd(), filePath);
}
