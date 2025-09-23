import { fileURLToPath } from "url";
import { dirname, resolve, join, sep } from "path";
import { existsSync } from "fs";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(moduleDir, "..");

const hasPackageJson = dir => existsSync(join(dir, "package.json"));

const findNearestPackageRoot = start => {
  let current = resolve(start);

  while (true) {
    if (hasPackageJson(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
};

const envRoot = process.env.UNS_BASE_PATH ? findNearestPackageRoot(process.env.UNS_BASE_PATH) : undefined;
const cwdRoot = findNearestPackageRoot(process.cwd());

const nodeModulesIndex = packageRoot.lastIndexOf(`${sep}node_modules${sep}`);
const hostRootFromPackage = nodeModulesIndex >= 0 ? packageRoot.slice(0, nodeModulesIndex) : undefined;

export const basePath = envRoot ?? cwdRoot ?? hostRootFromPackage ?? packageRoot;
