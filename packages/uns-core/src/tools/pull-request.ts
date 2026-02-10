import * as azdev from "azure-devops-node-api";
import * as ga from "azure-devops-node-api/GitApi.js";
import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces.js";
import { GitRepository } from "azure-devops-node-api/interfaces/TfvcInterfaces.js";
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

type CliArgs = {
  version?: string;
  title?: string;
  description?: string;
  help?: boolean;
};

type Prompter = {
  question: (prompt: string) => Promise<string>;
  close: () => void;
};

function parseCliArgs(argv = process.argv.slice(2)): CliArgs {
  const { values } = util.parseArgs({
    args: argv,
    options: {
      version: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      help: { type: "boolean" },
    },
    strict: false,
    allowPositionals: true,
  });

  const versionArg = typeof values.version === "string" ? values.version.trim() : "";
  const titleArg = typeof values.title === "string" ? values.title.trim() : "";
  const descriptionArg = typeof values.description === "string" ? values.description.trim() : "";

  return {
    version: versionArg || undefined,
    title: titleArg || undefined,
    description: descriptionArg || undefined,
    help: values.help === true,
  };
}

function formatUsage(): string {
  return [
    "Usage: pull-request [--version <version>] [--title <title>] [--description <description>]",
    "",
    "Non-interactive mode (stdin is not a TTY):",
    "  You must provide --version, --title, and --description (and set AZURE_PAT).",
    "",
    "Environment:",
    "  AZURE_PAT   Azure DevOps Personal Access Token (PAT)",
  ].join("\n");
}

function createPrompter(): Prompter {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = util.promisify(rl.question).bind(rl) as unknown as (prompt: string) => Promise<string>;
  return { question, close: () => rl.close() };
}

const cliArgs = parseCliArgs();

if (cliArgs.help) {
  console.log(formatUsage());
  process.exit(0);
}

let prompter: Prompter | undefined;

try {
  await main(cliArgs);
} catch (error) {
  console.log(chalk.red.bold(`\n${error}`));
} finally {
  prompter?.close();
}

async function main(cli: CliArgs) {
  const stdinIsTty = process.stdin.isTTY === true;
  const missingRequiredFlags = !cli.version || !cli.title || !cli.description;
  if (missingRequiredFlags && !stdinIsTty) {
    throw new Error(
      `Non-interactive mode detected (stdin is not a TTY). Provide --version, --title, and --description, or run interactively.\n\n${formatUsage()}`,
    );
  }

  if (!gitStatus.isClean()) {
    throw new Error(`Repository needs to be clean. Please commit or stash the changes.`);
  }

  const envPat = process.env.AZURE_PAT?.trim() || "";
  if (!envPat && !stdinIsTty) {
    throw new Error(
      `AZURE_PAT is not set and stdin is not a TTY, so an interactive prompt is not possible. Set AZURE_PAT or run interactively.`,
    );
  }

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
        console.log("The provided PAT is invalid or expired. Please provide a valid PAT.");
        token = "";
      }
    }
    if (!token) {
      prompter ??= createPrompter();
      token =
        (await prompter.question(
          `Please enter your PAT, you can create one at ` + chalk.green.bold(`[${tokensUrl}]: `),
        )) || "";
      token = token.trim();

      const authHandler = azdev.getPersonalAccessTokenHandler(token);
      const connection = new azdev.WebApi(orgUrl, authHandler);
      try {
        await connection.connect();
        gitApi = await connection.getGitApi();
      } catch (error) {
        console.log("The provided PAT is invalid or expired. Please provide a valid PAT.");
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

  const resolvedVersion = await getVersion(cli.version);
  const resolvedTitle = await getTitle(cli.title);
  const resolvedDescription = await getDescription(cli.description);

  await setVersion(resolvedVersion);
  await commitChanges(resolvedVersion);
  await pushChanges();
  await createPullRequest(resolvedVersion, resolvedTitle, resolvedDescription);
}

async function getVersion(versionArg?: string): Promise<string> {
  const authenticatedGit = requireGitWithAuth();
  let versionExists = true;
  let newVersion = versionArg ?? "";
  while (versionExists) {
    if (!newVersion) {
      prompter ??= createPrompter();
      newVersion =
        (await prompter.question(
          `Every PR needs a unique version, please accept current version or enter a new one [${version}]: `,
        )) || version;
      newVersion = newVersion.trim() || version;
    }

    const remoteTags = await authenticatedGit.listRemote(["--tags"]);
    if (remoteTags.indexOf(`refs/tags/${newVersion}`) >= 0) {
      console.log(chalk.bold.red(`Version ${newVersion} already exists on the server`));
      if (versionArg && process.stdin.isTTY !== true) {
        throw new Error(
          `Version ${newVersion} already exists on the server. Provide a unique --version or run interactively.`,
        );
      }
      newVersion = "";
    } else {
      console.log(`Using version ${newVersion}`)
      versionExists = false;
    }
  }
  return newVersion;
}

async function getTitle(titleArg?: string): Promise<string> {
  if (titleArg) {
    return titleArg;
  }
  if (process.stdin.isTTY !== true) {
    throw new Error(
      `Non-interactive mode detected (stdin is not a TTY). Provide --title, or run interactively.\n\n${formatUsage()}`,
    );
  }
  prompter ??= createPrompter();
  const title = (await prompter.question(`Title for the pull request: `)).trim();
  if (!title) {
    throw new Error("Pull request title can not be empty.");
  }
  return title;
}

async function getDescription(descriptionArg?: string): Promise<string> {
  if (descriptionArg) {
    return descriptionArg;
  }
  if (process.stdin.isTTY !== true) {
    throw new Error(
      `Non-interactive mode detected (stdin is not a TTY). Provide --description, or run interactively.\n\n${formatUsage()}`,
    );
  }
  prompter ??= createPrompter();
  const description = (await prompter.question(`Description for the pull request: `)).trim();
  if (!description) {
    throw new Error("Pull request description can not be empty.");
  }
  return description;
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

async function createPullRequest(tag: string, title: string, description: string) {
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
  await gitApi.createPullRequest(gitPullRequestToCreate, repoId, project);
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
