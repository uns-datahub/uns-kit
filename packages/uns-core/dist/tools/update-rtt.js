import { basePath } from "./base-path.js";
import readline from "node:readline";
import * as path from "path";
import chalk from "chalk";
import { readFile } from "fs/promises";
import fs from "fs-extra";
import * as prettier from "prettier";
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const packageJsonPath = path.join(basePath, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
// Flags
const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has("--dry-run") || process.env.DRY_RUN === "1";
function logAction(action) {
    if (DRY_RUN)
        console.log(`[dry-run] ${action}`);
    else
        console.log(action);
}
function writeJson(file, obj) {
    return prettier.format(JSON.stringify(obj), { parser: "json" }).then((s) => {
        if (DRY_RUN) {
            console.log(`[dry-run] write ${file} (${s.length} bytes)`);
        }
        else {
            fs.writeFileSync(file, s, "utf8");
        }
    });
}
function copyDir(src, dest, options) {
    if (DRY_RUN) {
        console.log(`[dry-run] copy ${src} -> ${dest}`);
        return;
    }
    fs.copySync(src, dest, { overwrite: true, ...options });
}
function removePath(p, opts) {
    if (DRY_RUN) {
        console.log(`[dry-run] rm ${p}`);
        return;
    }
    fs.rmSync(p, { force: true, recursive: true, ...opts });
}
try {
    await main();
    rl.close();
}
catch (error) {
    console.log(chalk.red.bold(`\n${error}`));
    rl.close();
}
async function main() {
    const tmpRtt = path.join(basePath, "/tmp-rtt");
    try {
        logAction(`Overwrite examples`);
        copyDir(path.join(tmpRtt, "/src/examples"), path.join(basePath, "/src/examples"));
        logAction(`Overwrite uns`);
        copyDir(path.join(tmpRtt, "/src/uns"), path.join(basePath, "/src/uns"));
        logAction(`Overwrite uns-config`);
        copyDir(path.join(tmpRtt, "/src/uns-config"), path.join(basePath, "/src/uns-config"));
        // Python: copy template but preserve local project area(s) and environments
        // Preserved by default: python/rtt, python/venv, python/.venv, python/__pycache__
        const pythonSrc = path.join(tmpRtt, "/python");
        const pythonDst = path.join(basePath, "/python");
        logAction(`Overwrite python (preserve local, rtt, venv/.venv, __pycache__)`);
        copyDir(pythonSrc, pythonDst, {
            filter: (src) => {
                // Only filter relative to template python root
                const rel = path.relative(pythonSrc, src);
                if (!rel || rel === "")
                    return true;
                const top = rel.split(path.sep)[0];
                const preserved = new Set(["local", "rtt", "venv", ".venv", "__pycache__"]);
                return !preserved.has(top);
            },
        });
        logAction(`Overwrite uns-grpc`);
        copyDir(path.join(tmpRtt, "/src/uns-grpc"), path.join(basePath, "/packages/uns-core/src/uns-grpc"));
        logAction(`Overwrite uns-cron`);
        copyDir(path.join(tmpRtt, "/src/uns-cron"), path.join(basePath, "/packages/uns-cron/src"));
        logAction(`Overwrite uns-api`);
        copyDir(path.join(tmpRtt, "/src/uns-api"), path.join(basePath, "/packages/uns-api/src"));
        logAction(`Overwrite uns-mqtt`);
        copyDir(path.join(tmpRtt, "/src/uns-mqtt"), path.join(basePath, "/packages/uns-core/src/uns-mqtt"));
        logAction(`Overwrite uns-temporal`);
        copyDir(path.join(tmpRtt, "/src/uns-temporal"), path.join(basePath, "/packages/uns-temporal/src"));
        logAction(`Overwrite eslint.config.mjs`);
        copyDir(path.join(tmpRtt, "/eslint.config.mjs"), path.join(basePath, "/eslint.config.mjs"));
        logAction(`Overwrite schema.ts`);
        copyDir(path.join(tmpRtt, "/src/graphql/schema.ts"), path.join(basePath, "/src/graphql/schema.ts"));
        logAction(`Overwrite config-template.json`);
        copyDir(path.join(tmpRtt, "/config-template.json"), path.join(basePath, "/config-template.json"));
        logAction(`Overwrite vite.config.js`);
        copyDir(path.join(tmpRtt, "/vite.config.js"), path.join(basePath, "/vite.config.js"));
        logAction(`Overwrite codegen.ts`);
        copyDir(path.join(tmpRtt, "/codegen.ts"), path.join(basePath, "/codegen.ts"));
        logAction(`Overwrite logger.ts`);
        copyDir(path.join(tmpRtt, "/src/logger.ts"), path.join(basePath, "/src/logger.ts"));
    }
    catch (error) {
        console.error(chalk.red.bold(`exec error: ${error}`));
        return;
    }
    try {
        logAction(`Merge package.json scripts (template overrides existing keys, preserves extras)`);
        const tmpPackageJson = JSON.parse(await readFile(path.join(tmpRtt, 'package.json'), "utf8"));
        const currentScripts = packageJson.scripts || {};
        const templateScripts = tmpPackageJson.scripts || {};
        packageJson.scripts = { ...currentScripts, ...templateScripts };
        await writeJson('package.json', packageJson);
    }
    catch (error) {
        console.error(chalk.red.bold(`exec error: ${error}`));
        return;
    }
    try {
        console.log(chalk.red(`Update devDependencies: overwrite versions for existing, add missing; preserve extras.`));
        const tmpPackageJson = JSON.parse(await readFile(path.join(tmpRtt, 'package.json'), "utf8"));
        packageJson.devDependencies = packageJson.devDependencies || {};
        for (const [dep, version] of Object.entries(tmpPackageJson.devDependencies || {})) {
            packageJson.devDependencies[dep] = version;
        }
        await writeJson('package.json', packageJson);
    }
    catch (error) {
        console.error(chalk.red.bold(`exec error: ${error}`));
        return;
    }
    try {
        console.log(chalk.red(`Update dependencies: keep existing versions; add missing from template.`));
        const tmpPackageJson = JSON.parse(await readFile(path.join(tmpRtt, 'package.json'), "utf8"));
        packageJson.dependencies = packageJson.dependencies || {};
        for (const [dep, version] of Object.entries(tmpPackageJson.dependencies || {})) {
            if (!(dep in packageJson.dependencies)) {
                packageJson.dependencies[dep] = version;
            }
        }
        await writeJson('package.json', packageJson);
    }
    catch (error) {
        console.error(chalk.red.bold(`exec error: ${error}`));
        return;
    }
    try {
        logAction(`Remove obsolete directories and files`);
        removePath(path.join(basePath, "/src/mqtt-rtt"));
        removePath(path.join(basePath, "/src/uns-rtt"));
        removePath(path.join(basePath, "/.eslintignore"));
        removePath(path.join(basePath, "/.eslintrc.json"));
        removePath(path.join(basePath, "/src/update-rtt.ts"));
        removePath(path.join(basePath, "/src/demo"));
    }
    catch (error) {
        console.error(chalk.red.bold(`exec error: ${error}`));
        return;
    }
    try {
        logAction(`Remove tmp-rtt`);
        removePath(tmpRtt);
    }
    catch (error) {
        console.error(chalk.red.bold(`exec error: ${error}`));
        return;
    }
    console.log(chalk.green.bold("\nRun npm run build to rebuild the project, and remove obsolete directories and files."));
}
//# sourceMappingURL=update-rtt.js.map