import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tsxCliPath = require.resolve("tsx/cli");
const cliEntry = path.resolve(process.cwd(), "packages/uns-cli/src/index.ts");
const tempDirs: string[] = [];

describe("uns-kit create --bundle", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("creates a TypeScript project from a valid bundle", async () => {
    const workdir = await makeTempDir();
    const bundlePath = await writeBundle(workdir, {
      scaffold: { stack: "ts", template: "default", features: ["vscode", "devops"] },
      repository: {
        provider: "azure-devops",
        organization: "sijit",
        project: "industry40",
        repository: "uns-example-service",
        defaultBranch: "master",
      },
    });

    const result = runTsCli(workdir, ["create", "--bundle", bundlePath]);
    expect(result.status).toBe(0);

    const targetDir = path.join(workdir, "uns-example-service");
    expect(existsSync(path.join(targetDir, "service.bundle.json"))).toBe(true);
    expect(existsSync(path.join(targetDir, "SERVICE_SPEC.md"))).toBe(true);
    expect(existsSync(path.join(targetDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(path.join(targetDir, ".vscode", "settings.json"))).toBe(true);
    expect(existsSync(path.join(targetDir, "azure-pipelines.yml"))).toBe(true);

    const copiedBundle = await readFile(path.join(targetDir, "service.bundle.json"), "utf8");
    const originalBundle = await readFile(bundlePath, "utf8");
    expect(copiedBundle).toBe(originalBundle);

    const serviceSpec = await readFile(path.join(targetDir, "SERVICE_SPEC.md"), "utf8");
    expect(serviceSpec).toContain("# SERVICE_SPEC");
    expect(serviceSpec).toContain("UNS Example Service");
    expect(serviceSpec).toContain("Goal 1");

    const agents = await readFile(path.join(targetDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("# AGENTS");
    expect(agents).toContain("bootstrapped from `service.bundle.json`");
    expect(agents).toContain("pnpm build");

    const packageJson = JSON.parse(await readFile(path.join(targetDir, "package.json"), "utf8")) as {
      name: string;
      scripts?: Record<string, string>;
    };
    expect(packageJson.name).toBe("uns-example-service");
    expect(packageJson.scripts?.["pull-request"]).toBe(
      "node ./node_modules/@uns-kit/core/dist/tools/pull-request.js",
    );

    const configJson = JSON.parse(await readFile(path.join(targetDir, "config.json"), "utf8")) as {
      devops?: Record<string, string>;
    };
    expect(configJson.devops).toMatchObject({
      provider: "azure-devops",
      organization: "sijit",
      project: "industry40",
    });
  });

  it("fails for an invalid bundle", async () => {
    const workdir = await makeTempDir();
    const bundlePath = await writeBundle(workdir, { schemaVersion: 2 });

    const result = runTsCli(workdir, ["create", "--bundle", bundlePath]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("schemaVersion must be 1");
  });

  it("fails with a clear message when the bundle stack belongs to the Python CLI", async () => {
    const workdir = await makeTempDir();
    const bundlePath = await writeBundle(workdir, {
      scaffold: { stack: "python", template: "default", features: [] },
    });

    const result = runTsCli(workdir, ["create", "--bundle", bundlePath]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Bundle scaffold.stack is "python"');
    expect(result.stderr).toContain("uns-kit-py create --bundle <path>");
  });

  it("supports --dest for bundle creation", async () => {
    const workdir = await makeTempDir();
    const bundlePath = await writeBundle(workdir, {
      scaffold: { stack: "ts", template: "default", features: [] },
    });
    const customTarget = path.join(workdir, "custom-target");

    const result = runTsCli(workdir, ["create", "--bundle", bundlePath, "--dest", customTarget]);
    expect(result.status).toBe(0);
    expect(existsSync(path.join(customTarget, "package.json"))).toBe(true);
    expect(existsSync(path.join(customTarget, "service.bundle.json"))).toBe(true);
  });

  it("requires --allow-existing for non-empty bundle destinations", async () => {
    const workdir = await makeTempDir();
    const bundlePath = await writeBundle(workdir, {
      scaffold: { stack: "ts", template: "default", features: [] },
    });
    const targetDir = path.join(workdir, "existing-target");
    await ensureDirWithFile(targetDir, "keep.txt", "keep\n");

    const result = runTsCli(workdir, ["create", "--bundle", bundlePath, "--dest", targetDir]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("is not empty");
  });

  it("allows bundle creation into a non-empty directory when --allow-existing is passed", async () => {
    const workdir = await makeTempDir();
    const bundlePath = await writeBundle(workdir, {
      scaffold: { stack: "ts", template: "default", features: [] },
    });
    const targetDir = path.join(workdir, "existing-target");
    await ensureDirWithFile(targetDir, "keep.txt", "keep\n");

    const result = runTsCli(workdir, [
      "create",
      "--bundle",
      bundlePath,
      "--dest",
      targetDir,
      "--allow-existing",
    ]);
    expect(result.status).toBe(0);
    expect(await readFile(path.join(targetDir, "keep.txt"), "utf8")).toBe("keep\n");
    expect(existsSync(path.join(targetDir, "service.bundle.json"))).toBe(true);
  });

  it("keeps legacy create <name> behavior working", async () => {
    const workdir = await makeTempDir();
    const result = runTsCli(workdir, ["create", "legacy-app"]);

    expect(result.status).toBe(0);
    expect(existsSync(path.join(workdir, "legacy-app", "package.json"))).toBe(true);
    expect(existsSync(path.join(workdir, "legacy-app", "service.bundle.json"))).toBe(false);
  });
});

function runTsCli(cwd: string, args: string[]) {
  return spawnSync(process.execPath, [tsxCliPath, cliEntry, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "uns-cli-bundle-"));
  tempDirs.push(dir);
  return dir;
}

async function ensureDirWithFile(dir: string, filename: string, contents: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), contents, "utf8");
}

async function writeBundle(workdir: string, overrides: Partial<Record<string, unknown>> = {}): Promise<string> {
  const bundle = {
    schemaVersion: 1,
    kind: "uns-service-bundle",
    metadata: {
      name: "uns-example-service",
      displayName: "UNS Example Service",
      serviceType: "microservice",
      summary: "Short summary",
      description: "Longer description",
      owner: "team-name",
      tags: ["tag1", "tag2"],
    },
    scaffold: {
      stack: "ts",
      template: "default",
      features: ["vscode"],
    },
    repository: {
      provider: "azure-devops",
      organization: "sijit",
      project: "industry40",
      repository: "uns-example-service",
      defaultBranch: "master",
    },
    domain: {
      inputs: [],
      outputs: [],
    },
    docs: {
      serviceSpec: {
        goals: ["Goal 1"],
        nonGoals: ["Non-goal 1"],
        acceptanceCriteria: ["Criterion 1"],
      },
      agents: {
        projectContext: ["Context 1"],
        guardrails: ["Guardrail 1"],
        firstTasks: ["Task 1"],
        verification: ["pnpm build"],
      },
    },
    analytics: null,
    provenance: {
      origin: "manual",
    },
    ...overrides,
  };

  const bundlePath = path.join(workdir, "service.bundle.json");
  await writeFile(bundlePath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
  return bundlePath;
}
