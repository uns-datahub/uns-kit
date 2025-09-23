import fs from "fs-extra";
import { basePath } from "./base-path";
import * as path from "path";
import { execSync } from 'child_process';
const binDir = path.join(basePath, 'bin/');
try {
    const ua = process.env.npm_config_user_agent || "";
    const pm = ua.startsWith("pnpm") ? "pnpm" : ua.startsWith("yarn") ? "yarn" : "npm";
    execSync(`${pm} run build`, { stdio: 'inherit' });
    fs.rmSync(binDir, {
        recursive: true,
        force: true,
    });
    fs.mkdirSync(binDir, { recursive: true });
    fs.copyFileSync(path.join(basePath, 'LICENSE'), path.join(binDir, 'LICENSE'));
    fs.copyFileSync(path.join(basePath, 'package.json'), path.join(binDir, 'package.json'));
    fs.copySync(path.join(basePath, 'dist'), path.join(binDir, 'dist/'));
    // After all files are copied, check for ../local-tools/make.js and run it if exists
    const localToolsDir = path.resolve(basePath, 'dist/local-tools');
    const makeJsPath = path.join(localToolsDir, 'make.js');
    if (fs.existsSync(makeJsPath)) {
        execSync(`node "${makeJsPath}"`, { stdio: 'inherit' });
    }
}
catch (error) {
    console.log(`error: ${error}`);
}
