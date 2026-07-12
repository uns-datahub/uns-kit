import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

for (const relativePath of ["../dist", "../tsconfig.tsbuildinfo"]) {
  rmSync(fileURLToPath(new URL(relativePath, import.meta.url)), {
    recursive: true,
    force: true,
  });
}
