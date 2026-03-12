import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function readTextFileIfExists(filePath: string): Promise<string | undefined> {
  const absolutePath = path.resolve(process.cwd(), filePath);

  try {
    return await readFile(absolutePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function writeTextFileIfChanged(filePath: string, content: string): Promise<boolean> {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const current = await readTextFileIfExists(absolutePath);

  if (current === content) {
    return false;
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
  return true;
}
