import * as azdev from "azure-devops-node-api";
import * as ga from "azure-devops-node-api/GitApi";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import chalk from "chalk";
import { readFile } from "fs/promises";
import readline from "node:readline";
import * as path from "path";
import { CleanOptions, SimpleGit, simpleGit } from "simple-git";
import fs from "fs-extra";
import { basePath } from "./base-path.js";


const git: SimpleGit = simpleGit("./").clean(CleanOptions.FORCE);

export const packageJsonPath = path.join(basePath, "package.json");
const orgUrl = "https://example-org@dev.azure.com/example-org";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let token: string = "";
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const repoName: string = packageJson.name;

async function run() {
  let repos: GitRepository[];
  let gitApi: ga.IGitApi;
  const project = "example-project";
  try {
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    const connection = new azdev.WebApi(orgUrl, authHandler);
    gitApi = await connection.getGitApi();
    repos = await gitApi.getRepositories(project);    
  } catch (error) {
    console.error("Your AZURE_PAT environment variable has probably expired.");
    console.log("Please update your AZURE_PAT environment with a new one on.");
    console.log("You can create a new one at[https://dev.azure.com/example-org/_usersSettings/tokens]");
  }

  if (repos.filter((x) => x.name == repoName).length > 0) {
    console.log(
      chalk.red.bold(
        `Error: Repository ${repoName} in project ${project} already exists.`,
      ),
    );
  } else {
    process.stdout.write(`Create ${repoName} in project ${project}`);
    try {
      await gitApi.createRepository({ name: repoName }, project);
      console.log(chalk.green.bold(` ... OK`));
    } catch (error) {
      console.error(chalk.red.bold(`\n${error}`));
    }

    process.stdout.write(`Initialize local git repository on branch master`);
    try {
      await git.init();
      await git.checkoutLocalBranch("master");
      await git.add(".");
      await git.commit("Initial commit");
      console.log(chalk.green.bold(` ... OK`));
    } catch (error) {
      console.error(chalk.red.bold(`\n${error}`));
    }

    process.stdout.write(`Add remote origin.`);
    try {
      await git.remote([
        "add",
        "origin",
        `git@ssh.dev.azure.com:v3/example-org/example-project/${repoName}`,
      ]);
      console.log(chalk.green.bold(` ... OK`));
    } catch (error) {
      console.error(chalk.red.bold(`\n${error}`));
    }

    process.stdout.write(`Push master to remote`);
    try {
      await git.push("origin", "master");
      console.log(chalk.green.bold(` ... OK`));
    } catch (error) {
      console.error(chalk.red.bold(`\n${error}`));
    }

    process.stdout.write(`Create default config.json from config-template.json`);
    try {
      fs.copyFileSync(path.join(basePath,'config-template.json'), path.join(basePath,'config.json'));
      console.log(chalk.green.bold(` ... OK`));
    } catch (error) {
      console.error(chalk.red.bold(`\n${error}`));
    }

    console.log(
      chalk.green.bold(
        `\nNow you can add pipeline for ${repoName} in Azure DevOps pipelines for the project ${project}.`,
      ),
    );
  }
}

console.log(chalk.green.bold(`Create new RTT: ${repoName}\n`));

const envPat = process.env.AZURE_PAT;
if (envPat && envPat.length > 10) {
  rl.close();
  console.log("Using PAT from your AZURE_PAT environment");
  token = envPat;
  run();
} else {
  console.log("Could not find AZURE_PAT environment.");
  rl.question(
    `Please enter your PAT, you can create one at [https://dev.azure.com/example-org/_usersSettings/tokens]: `,
    (newToken) => {
      rl.close();
      token = newToken;
      run();
    },
  );  
}
