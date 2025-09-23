import { CleanOptions, SimpleGit, simpleGit } from "simple-git";
import { basePath } from "./base-path.js";
import readline from "node:readline";
import * as path from "path";
import chalk from "chalk";
import fs from "fs-extra";
import { execSync } from "child_process";


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const git: SimpleGit = simpleGit("./").clean(CleanOptions.FORCE);

try {
  await main();
  rl.close();
} catch (error) {
  console.log(chalk.red.bold(`\n${error}`));
  rl.close();
}

async function main() {
  const tmpRtt = path.join(basePath, "/tmp-rtt");
  try {
    console.log(`Pull template-ts-nodejs into tmp-rtt`);
    await git.clone("git@ssh.dev.azure.com:v3/sijit/industry40/template-uns-rtt", tmpRtt);
  } catch (error) {
    console.error(chalk.red.bold(`exec error: ${error}`));    
    return;
  }

  try {
    console.log(`Overwrite tools`);
    fs.copySync(path.join(tmpRtt, "/src/tools"), path.join(basePath, "/src/tools"), {overwrite: true});
  } catch (error) {
    console.error(chalk.red.bold(`exec error: ${error}`));    
    return;
  }

  // Update library version JSON at repo root from template
  try {
    const srcJson = path.join(tmpRtt, 'uns-library.json');
    const dstJson = path.join(basePath, 'uns-library.json');
    if (fs.existsSync(srcJson)) {
      fs.copyFileSync(srcJson, dstJson);
      const ver = JSON.parse(fs.readFileSync(srcJson, 'utf8')).version;
      console.log(`Updated uns-library.json -> ${ver}`);
    } else {
      // Fallback for older templates: synthesize from package.json
      const tmpPackageJsonPath = path.join(tmpRtt, 'package.json');
      const tmpPackageJson = JSON.parse(fs.readFileSync(tmpPackageJsonPath, 'utf8'));
      const payload = JSON.stringify({ name: tmpPackageJson.name, version: tmpPackageJson.version }, null, 2);
      fs.writeFileSync(dstJson, payload + "\n", 'utf8');
      console.log(`Updated uns-library.json -> ${tmpPackageJson.version}`);
    }
  } catch (error) {
    console.error(chalk.red.bold(`exec error: ${error}`));
    return;
  }

  try {
    console.log(`Running update-rtt from tools`);
    // Propagate any CLI args to update-rtt (e.g., --dry-run)
    const args = process.argv.slice(2).join(" ");
    // Run the TypeScript tool directly to avoid relying on a successful build
    execSync(`tsx ./src/tools/update-rtt.ts ${args}`.trim(), { stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red.bold(`exec error: ${error}`));    
    return;    
  }
}
