import * as azdev from "azure-devops-node-api";
import chalk from "chalk";
import { execSync } from "child_process";
import fs from "fs";
import { readFile } from "fs/promises";
import readline from "node:readline";
import * as path from "path";
import * as prettier from "prettier";
import { CleanOptions, simpleGit } from "simple-git";
import util from "util";
import { ConfigFile } from "../config-file.js";
import { basePath } from "../base-path.js";
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const question = util.promisify(rl.question).bind(rl);
const git = simpleGit("./").clean(CleanOptions.FORCE);
const packageJsonPath = path.join(basePath, "package.json");
const unsLibraryPath = path.join(basePath, "uns-library.json");
let azureOrganization = "sijit";
try {
    const appConfig = ConfigFile.loadRawConfig();
    azureOrganization = appConfig.devops?.organization?.trim() || azureOrganization;
}
catch (error) {
    // Use default organization when config.json is missing
}
const orgUrl = `https://${azureOrganization}@dev.azure.com/${azureOrganization}`;
const orgBaseUrl = `https://dev.azure.com/${azureOrganization}`;
const tokensUrl = `${orgBaseUrl}/_usersSettings/tokens`;
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const repoName = packageJson.name;
const version = packageJson.version;
const branches = await git.branchLocal();
const currentBranch = branches.current;
const gitStatus = await git.status();
let token = "";
try {
    await main();
    rl.close();
}
catch (error) {
    console.log(chalk.red.bold(`\n${error}`));
    rl.close();
}
async function main() {
    if (!gitStatus.isClean()) {
        throw new Error(`Repository needs to be clean. Please commit or stash the changes.`);
    }
    else if (currentBranch == "master") {
        throw new Error(`You can not create pull request from master to master.`);
    }
    else {
        const envPat = process.env.AZURE_PAT;
        while (!token) {
            if (envPat && envPat.length > 10) {
                token = envPat;
                const authHandler = azdev.getPersonalAccessTokenHandler(token);
                const connection = new azdev.WebApi(orgUrl, authHandler);
                try {
                    console.log("Using PAT from your AZURE_PAT environment");
                    await connection.connect();
                }
                catch (error) {
                    console.log("The provided PAT is invalid or expired. Please provide a valid PAT.");
                    token = "";
                }
            }
            if (!token) {
                token = await question(`Please enter your PAT, you can create one at [${tokensUrl}]: `);
                const authHandler = azdev.getPersonalAccessTokenHandler(token);
                const connection = new azdev.WebApi(orgUrl, authHandler);
                try {
                    await connection.connect();
                }
                catch (error) {
                    console.log("The provided PAT is invalid or expired. Please provide a valid PAT.");
                    token = "";
                }
            }
        }
        const version = await getVersion();
        await setVersion(version);
        await runMake();
        await commitChanges(version);
        await pushChanges();
        await createPullRequest(version);
    }
}
async function getVersion() {
    let versionExists = true;
    let newVersion = version;
    while (versionExists) {
        newVersion = await question(`Every PR needs a unique version, please accept current version or enter a new one [${version}]: `) || version;
        const remoteTags = await git.listRemote(["--tags"]);
        if (remoteTags.indexOf(`refs/tags/${newVersion}`) > 0) {
            console.log(chalk.bold.red(`Version ${newVersion} already exists on the server`));
        }
        else {
            console.log(`Using version ${newVersion}`);
            versionExists = false;
        }
    }
    return newVersion;
}
async function runMake() {
    execSync("npm run make");
}
async function commitChanges(newVersion) {
    process.stdout.write(`Commit changes to branch ${currentBranch} `);
    await git.add(".");
    await git.commit(`Set new production version: ${newVersion}`);
    console.log(chalk.green.bold(` ... OK`));
}
async function pushChanges() {
    process.stdout.write(`Push changes to remote branch ${currentBranch} `);
    await git.push("origin", currentBranch);
    console.log(chalk.green.bold(` ... OK`));
}
async function setVersion(newVersion) {
    packageJson.version = newVersion;
    const docString = await prettier.format(JSON.stringify(packageJson), {
        parser: "json",
    });
    fs.writeFileSync("package.json", docString, "utf8");
    if (repoName === "template-uns-rtt") {
        try {
            const unsLibraryFile = await readFile(unsLibraryPath, "utf8");
            const unsLibrary = JSON.parse(unsLibraryFile);
            unsLibrary.version = newVersion;
            const unsLibraryDoc = await prettier.format(JSON.stringify(unsLibrary), {
                parser: "json",
            });
            fs.writeFileSync(unsLibraryPath, unsLibraryDoc, "utf8");
        }
        catch (error) {
            if (error.code === "ENOENT") {
                const unsLibraryDoc = await prettier.format(JSON.stringify({ name: repoName, version: newVersion }), { parser: "json" });
                fs.writeFileSync(unsLibraryPath, unsLibraryDoc, "utf8");
            }
            else {
                throw error;
            }
        }
    }
}
async function createPullRequest(tag) {
    const title = await question(`Title for the pull request: `);
    const description = await question(`Description for the pull request: `);
    process.stdout.write(`Create new pull request from ${currentBranch} to master `);
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    const connection = new azdev.WebApi(orgUrl, authHandler);
    const gitApi = await connection.getGitApi();
    const project = "industry40";
    const repos = await gitApi.getRepositories(project);
    const repoId = repos.filter((x) => x.name == repoName)[0].id;
    const gitPullRequestToCreate = {
        sourceRefName: `refs/heads/${currentBranch}`,
        targetRefName: "refs/heads/master",
        title,
        description,
        labels: [{ active: true, name: tag }]
    };
    gitApi.createPullRequest(gitPullRequestToCreate, repoId, project);
    console.log(chalk.green.bold(` ... OK`));
    console.log(`Pull request created at ` + chalk.green.bold(`[${orgBaseUrl}/${project}/_git/${repoName}/pullrequests]`));
}
