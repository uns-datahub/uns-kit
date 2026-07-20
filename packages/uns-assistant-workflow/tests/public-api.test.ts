import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = findPackageRoot();
const CORE_SOURCE_ROOT = join(PACKAGE_ROOT, "src");

describe("assistant workflow public API", () => {
  it("keeps root exports explicit and free of duplicates", () => {
    const indexSource = readFileSync(join(CORE_SOURCE_ROOT, "index.ts"), "utf8");
    const exportedModules = [...indexSource.matchAll(/export \* from "\.\/(.+)\.js";/g)]
      .map((match) => match[1]);

    expect(exportedModules.length).toBeGreaterThan(0);
    expect(new Set(exportedModules).size).toBe(exportedModules.length);
  });

  it("keeps the standalone package as an ESM artifact with explicit subpath exports", () => {
    const indexSource = readFileSync(join(CORE_SOURCE_ROOT, "index.ts"), "utf8");
    const publicModules = [...indexSource.matchAll(/export \* from "\.\/(.+)\.js";/g)]
      .map((match) => match[1])
      .sort();
    const packageJson = JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as {
      type?: string;
      main?: string;
      types?: string;
      sideEffects?: boolean;
      engines?: Record<string, string>;
      exports?: unknown;
      files?: string[];
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(packageJson).toMatchObject({
      type: "module",
      sideEffects: false,
      engines: { node: ">=22" },
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      files: ["dist", "README.md", "API_STABILITY.md"],
    });
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        default: "./dist/index.js",
      },
      ...Object.fromEntries(
        publicModules.map((moduleName) => [
          `./${moduleName}`,
          {
            types: `./dist/${moduleName}.d.ts`,
            default: `./dist/${moduleName}.js`,
          },
        ]),
      ),
    });
    expect(packageJson.dependencies ?? {}).toEqual({});
    expect(packageJson.peerDependencies ?? {}).toEqual({});
  });
});

function findPackageRoot(): string {
  const cwd = process.cwd();
  const cwdPackageJson = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8")) as { name?: string };
  if (cwdPackageJson.name === "@uns-kit/assistant-workflow") return cwd;
  throw new Error("Public API tests must run from the assistant workflow package directory.");
}
