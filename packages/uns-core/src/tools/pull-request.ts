import * as azdev from "azure-devops-node-api";
import * as ga from "azure-devops-node-api/GitApi";
import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces";
import chalk from "chalk";
import { execSync } from "child_process";
import fs from "fs";
import { readFile } from "fs/promises";
import { Buffer } from "node:buffer";
import readline from "node:readline";
import * as path from "path";
import * as prettier from "prettier";
import { CleanOptions, SimpleGit, simpleGit } from "simple-git";
import util from "util";

import { ConfigFile } from "../config-file.js";
import { basePath } from "../base-path.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = util.promisify(rl.question).bind(rl);

process.env.GIT_TERMINAL_PROMPT = process.env.GIT_TERMINAL_PROMPT ?? "0";
const git: SimpleGit = simpleGit("./").clean(CleanOptions.FORCE);
const packageJsonPath = path.join(basePath, "package.json");

let azureOrganization = "";
let azureProject = "";
try {
  const appConfig = ConfigFile.loadRawConfig();
  azureOrganization = appConfig.devops?.organization?.trim() || azureOrganization;
  azureProject = appConfig.devops?.project?.trim() || azureProject;
} catch (error) {
  // Use default organization when config.json is missing
}

if (!azureOrganization) {
  throw new Error(
    "Azure DevOps organization is not configured. Please set devops.organization in config.json (run `uns-kit configure-devops`).",
  );
}

if (!azureProject) {
  throw new Error(
    "Azure DevOps project is not configured. Please set devops.project in config.json (run `uns-kit configure-devops`).",
  );
}

const orgUrl = `https://${azureOrganization}@dev.azure.com/${azureOrganization}`;
const orgBaseUrl = `https://dev.azure.com/${azureOrganization}`;
const tokensUrl = `${orgBaseUrl}/_usersSettings/tokens`;

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const repoName: string = packageJson.name;
const version: string = packageJson.version;

const branches = await git.branchLocal();
const currentBranch = branches.current;

const gitStatus = await git.status();

let token: string = "";
let gitApi: ga.IGitApi | undefined;
let gitWithAuth: SimpleGit | undefined;


try {
  await main();
  rl.close();
} catch (error) {
  console.log(chalk.red.bold(`\n${error}`));
  rl.close();
}

async function main() {
  if (!gitStatus.isClean()) {
    throw new Error(`Repository needs to be clean. Please commit or stash the changes.`);
  } else {  
    const envPat = process.env.AZURE_PAT;
    while (!token) {
      if (envPat && envPat.length > 10) {
        token = envPat;
        const authHandler = azdev.getPersonalAccessTokenHandler(token);
        const connection = new azdev.WebApi(orgUrl, authHandler);
        try {
          console.log("Using PAT from your AZURE_PAT environment");
          await connection.connect();
          gitApi = await connection.getGitApi();
        } catch (error) {
          console.log(
            "The provided PAT is invalid or expired. Please provide a valid PAT.",
          );
          token = "";
        }
      }
      if (!token) {
        token = await question(
          `Please enter your PAT, you can create one at ` + chalk.green.bold(`[${tokensUrl}]: `),
        );
        const authHandler = azdev.getPersonalAccessTokenHandler(token);
        const connection = new azdev.WebApi(orgUrl, authHandler);
        try {
          await connection.connect();
          gitApi = await connection.getGitApi();
        } catch (error) {
          console.log(
            "The provided PAT is invalid or expired. Please provide a valid PAT.",
          );
          token = "";
        }
      }
    }

    const authHeader = buildGitAuthorizationHeader(token);
    gitWithAuth = simpleGit({
      baseDir: "./",
      config: [`http.extraheader=${authHeader}`],
    }).clean(CleanOptions.FORCE);

    await assertNotDefaultBranch();

    const version = await getVersion();
    await setVersion(version);
    await commitChanges(version);
    await pushChanges();
    await createPullRequest(version);
  }
}

async function getVersion(): Promise<string> {
  const authenticatedGit = requireGitWithAuth();
  let versionExists = true;
  let newVersion = version;
  while (versionExists) {
    newVersion = await question(
      `Every PR needs a unique version, please accept current version or enter a new one [${version}]: `
    ) || version;

    const remoteTags = await authenticatedGit.listRemote(["--tags"]);
    if (remoteTags.indexOf(`refs/tags/${newVersion}`) > 0) {
      console.log(chalk.bold.red(`Version ${newVersion} already exists on the server`));
    } else {
      console.log(`Using version ${newVersion}`)
      versionExists = false;
    }
  }
  return newVersion;
}

async function runMake() {
  execSync("npm run make");
}

async function commitChanges(newVersion: string) {
  process.stdout.write(`Commit changes to branch ${currentBranch} `);
  await git.add(".");
  await git.commit(`Set new production version: ${newVersion}`);
  console.log(chalk.green.bold(` ... OK`));
}

async function pushChanges() {
  const authenticatedGit = requireGitWithAuth();
  process.stdout.write(`Push changes to remote branch ${currentBranch} `);
  await authenticatedGit.push("origin", currentBranch);
  console.log(chalk.green.bold(` ... OK`));
}

async function setVersion(newVersion: string) {
  packageJson.version = newVersion;
  const docString = await prettier.format(JSON.stringify(packageJson), {
    parser: "json",
  });
  fs.writeFileSync("package.json", docString, "utf8");

}

async function createPullRequest(tag: string) {
  const title = await question(
    `Title for the pull request: `,
  );
  const description = await question(
    `Description for the pull request: `,
  );  
  process.stdout.write(`Create new pull request from ${currentBranch} to master `);
  if (!gitApi) {
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    const connection = new azdev.WebApi(orgUrl, authHandler);
    gitApi = await connection.getGitApi();
  }

  const project: string = azureProject;
  const repos: GitRepository[] = await gitApi.getRepositories(project);
  const repoId = repos.filter((x) => x.name == repoName)[0].id;
  const gitPullRequestToCreate: GitPullRequest = {
    sourceRefName: `refs/heads/${currentBranch}`,
    targetRefName: "refs/heads/master",
    title,
    description,
    labels: [{active: true, name:tag}]
  };
  gitApi.createPullRequest(gitPullRequestToCreate, repoId, project);
  console.log(chalk.green.bold(` ... OK`));
  console.log(`Pull request created at ` + chalk.green.bold(`[${orgBaseUrl}/${project}/_git/${repoName}/pullrequests]`));
}

async function assertNotDefaultBranch(): Promise<void> {
  if (!gitApi) {
    return;
  }

  const project = azureProject.trim();
  if (!project) {
    return;
  }

  try {
    const repository = await gitApi.getRepository(repoName, project);
    const defaultBranch = normalizeBranchName(repository?.defaultBranch);

    if (defaultBranch && defaultBranch === currentBranch) {
      throw new Error(
        `You can not create a pull request from the default branch (${defaultBranch}). Please create a feature branch instead.`,
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message || "";
      const protectedBranchPrefix = "You can not create a pull request from the default branch";
      if (message.startsWith(protectedBranchPrefix)) {
        throw error;
      }
      if (message) {
        console.log(`Warning: Unable to verify default branch: ${message}`);
      }
    }
  }
}

function normalizeBranchName(refName: string | undefined): string | undefined {
  if (!refName) {
    return undefined;
  }

  const prefix = "refs/heads/";
  return refName.startsWith(prefix) ? refName.slice(prefix.length) : refName;
}

function buildGitAuthorizationHeader(personalAccessToken: string): string {
  const encoded = Buffer.from(`:${personalAccessToken}`).toString("base64");
  return `Authorization: Basic ${encoded}`;
}

function requireGitWithAuth(): SimpleGit {
  if (!gitWithAuth) {
    throw new Error("Git authentication is not initialized.");
  }
  return gitWithAuth;
}
