import { readFile } from "node:fs/promises";

export type SupportedBundleStack = "ts" | "python";

export type ServiceBundle = {
  schemaVersion: 1;
  kind: "uns-service-bundle";
  metadata: {
    name: string;
    displayName?: string;
    serviceType?: string;
    summary?: string;
    description?: string;
    owner?: string;
    tags: string[];
  };
  scaffold: {
    stack: SupportedBundleStack | string;
    template: string;
    features: string[];
  };
  repository?: {
    provider?: string;
    organization?: string;
    project?: string;
    repository?: string;
    defaultBranch?: string;
  };
  domain?: {
    inputs: unknown[];
    outputs: unknown[];
  };
  docs: {
    serviceSpec: {
      goals: string[];
      nonGoals: string[];
      acceptanceCriteria: string[];
    };
    agents: {
      projectContext: string[];
      guardrails: string[];
      firstTasks: string[];
      verification: string[];
    };
  };
};

type JsonRecord = Record<string, unknown>;

type ReadBundleOptions = {
  expectedStack: SupportedBundleStack;
  cliName: string;
  counterpartCliName: string;
};

export async function readAndValidateServiceBundle(
  bundlePath: string,
  options: ReadBundleOptions,
): Promise<{ bundle: ServiceBundle; raw: string }> {
  const raw = await readFile(bundlePath, "utf8");
  const parsed = parseJsonObject(raw, bundlePath);
  const bundle = validateServiceBundle(parsed, options);
  return { bundle, raw };
}

export function generateServiceSpecMarkdown(bundle: ServiceBundle): string {
  const lines = [
    "# SERVICE_SPEC",
    "",
    "> Generated from `service.bundle.json`. Update the bundle as the source of truth.",
    "",
    "## Service Identity",
    ...renderKeyValueList([
      ["Name", bundle.metadata.name],
      ["Display Name", bundle.metadata.displayName],
      ["Service Type", bundle.metadata.serviceType],
      ["Owner", bundle.metadata.owner],
      ["Tags", bundle.metadata.tags.length ? bundle.metadata.tags.join(", ") : "None"],
    ]),
    "",
    "## Summary",
    "",
    bundle.metadata.summary?.trim() || "Not provided.",
    "",
    "## Description",
    "",
    bundle.metadata.description?.trim() || "Not provided.",
    "",
    "## Scaffold",
    ...renderKeyValueList([
      ["Stack", bundle.scaffold.stack],
      ["Template", bundle.scaffold.template],
      ["Features", bundle.scaffold.features.length ? bundle.scaffold.features.join(", ") : "None"],
    ]),
  ];

  if (bundle.repository) {
    lines.push(
      "",
      "## Repository",
      ...renderKeyValueList([
        ["Provider", bundle.repository.provider],
        ["Organization", bundle.repository.organization],
        ["Project", bundle.repository.project],
        ["Repository", bundle.repository.repository],
        ["Default Branch", bundle.repository.defaultBranch],
      ]),
    );
  }

  if (bundle.domain) {
    lines.push(
      "",
      "## Domain Inputs",
      ...renderUnknownList(bundle.domain.inputs),
      "",
      "## Domain Outputs",
      ...renderUnknownList(bundle.domain.outputs),
    );
  }

  lines.push(
    "",
    "## Goals",
    ...renderStringList(bundle.docs.serviceSpec.goals),
    "",
    "## Non-Goals",
    ...renderStringList(bundle.docs.serviceSpec.nonGoals),
    "",
    "## Acceptance Criteria",
    ...renderStringList(bundle.docs.serviceSpec.acceptanceCriteria),
    "",
  );

  return lines.join("\n");
}

export function generateAgentsMarkdown(bundle: ServiceBundle): string {
  const lines = [
    "# AGENTS",
    "",
    "> This repository was bootstrapped from `service.bundle.json`. Regenerate derived docs from the bundle instead of treating this file as the source of truth.",
    "",
    "## Service",
    ...renderKeyValueList([
      ["Name", bundle.metadata.name],
      ["Display Name", bundle.metadata.displayName],
      ["Stack", bundle.scaffold.stack],
      ["Template", bundle.scaffold.template],
    ]),
    "",
    "## Project Context",
    ...renderStringList(bundle.docs.agents.projectContext),
    "",
    "## Guardrails",
    ...renderStringList(bundle.docs.agents.guardrails),
    "",
    "## First Tasks",
    ...renderStringList(bundle.docs.agents.firstTasks),
    "",
    "## Verification",
    ...renderStringList(bundle.docs.agents.verification),
    "",
  ];

  return lines.join("\n");
}

function validateServiceBundle(value: JsonRecord, options: ReadBundleOptions): ServiceBundle {
  const schemaVersion = value.schemaVersion;
  if (schemaVersion !== 1) {
    throw new Error(`service bundle schemaVersion must be 1. Received ${JSON.stringify(schemaVersion)}.`);
  }

  const kind = value.kind;
  if (kind !== "uns-service-bundle") {
    throw new Error(`service bundle kind must be "uns-service-bundle". Received ${JSON.stringify(kind)}.`);
  }

  const metadata = requireObject(value.metadata, "metadata");
  const scaffold = requireObject(value.scaffold, "scaffold");
  const repository = optionalObject(value.repository, "repository");
  const domain = optionalObject(value.domain, "domain");
  const docs = optionalObject(value.docs, "docs");
  optionalObject(value.provenance, "provenance");

  const normalized: ServiceBundle = {
    schemaVersion: 1,
    kind: "uns-service-bundle",
    metadata: {
      name: requireNonEmptyString(metadata.name, "metadata.name"),
      displayName: optionalNonEmptyString(metadata.displayName, "metadata.displayName"),
      serviceType: optionalNonEmptyString(metadata.serviceType, "metadata.serviceType"),
      summary: optionalNonEmptyString(metadata.summary, "metadata.summary"),
      description: optionalNonEmptyString(metadata.description, "metadata.description"),
      owner: optionalNonEmptyString(metadata.owner, "metadata.owner"),
      tags: optionalStringArray(metadata.tags, "metadata.tags"),
    },
    scaffold: {
      stack: requireNonEmptyString(scaffold.stack, "scaffold.stack"),
      template: requireNonEmptyString(scaffold.template, "scaffold.template"),
      features: dedupeStrings(optionalStringArray(scaffold.features, "scaffold.features")),
    },
    repository: repository
      ? {
          provider: optionalNonEmptyString(repository.provider, "repository.provider"),
          organization: optionalNonEmptyString(repository.organization, "repository.organization"),
          project: optionalNonEmptyString(repository.project, "repository.project"),
          repository: optionalNonEmptyString(repository.repository, "repository.repository"),
          defaultBranch: optionalNonEmptyString(repository.defaultBranch, "repository.defaultBranch"),
        }
      : undefined,
    domain: domain
      ? {
          inputs: optionalUnknownArray(domain.inputs, "domain.inputs"),
          outputs: optionalUnknownArray(domain.outputs, "domain.outputs"),
        }
      : undefined,
    docs: {
      serviceSpec: normalizeServiceSpecDocs(optionalObject(docs?.serviceSpec, "docs.serviceSpec")),
      agents: normalizeAgentsDocs(optionalObject(docs?.agents, "docs.agents")),
    },
  };

  if (normalized.scaffold.stack !== options.expectedStack) {
    throw new Error(
      `Bundle scaffold.stack is "${normalized.scaffold.stack}". Use ${options.counterpartCliName} create --bundle <path> instead of ${options.cliName}.`,
    );
  }

  if (normalized.scaffold.template !== "default") {
    throw new Error(
      `Bundle scaffold.template must be "default" for this MVP. Received "${normalized.scaffold.template}".`,
    );
  }

  return normalized;
}

function normalizeServiceSpecDocs(value?: JsonRecord): ServiceBundle["docs"]["serviceSpec"] {
  return {
    goals: optionalStringArray(value?.goals, "docs.serviceSpec.goals"),
    nonGoals: optionalStringArray(value?.nonGoals, "docs.serviceSpec.nonGoals"),
    acceptanceCriteria: optionalStringArray(value?.acceptanceCriteria, "docs.serviceSpec.acceptanceCriteria"),
  };
}

function normalizeAgentsDocs(value?: JsonRecord): ServiceBundle["docs"]["agents"] {
  return {
    projectContext: optionalStringArray(value?.projectContext, "docs.agents.projectContext"),
    guardrails: optionalStringArray(value?.guardrails, "docs.agents.guardrails"),
    firstTasks: optionalStringArray(value?.firstTasks, "docs.agents.firstTasks"),
    verification: optionalStringArray(value?.verification, "docs.agents.verification"),
  };
}

function parseJsonObject(raw: string, bundlePath: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse bundle JSON at ${bundlePath}: ${(error as Error).message}`);
  }

  return requireObject(parsed, "bundle");
}

function requireObject(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${path} must be an object.`);
  }
  return value as JsonRecord;
}

function optionalObject(value: unknown, path: string): JsonRecord | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireObject(value, path);
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${path} is required and must be a non-empty string.`);
  }
  return value.trim();
}

function optionalNonEmptyString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return requireNonEmptyString(value, path);
}

function optionalStringArray(value: unknown, path: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array of strings.`);
  }
  return value.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
}

function optionalUnknownArray(value: unknown, path: string): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }
  return value;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }
  return deduped;
}

function renderKeyValueList(entries: Array<[string, string | undefined]>): string[] {
  return entries.map(([label, value]) => `- ${label}: ${value && value.trim() ? value : "Not specified"}`);
}

function renderStringList(items: string[]): string[] {
  if (!items.length) {
    return ["- None specified."];
  }
  return items.map((item) => `- ${item}`);
}

function renderUnknownList(items: unknown[]): string[] {
  if (!items.length) {
    return ["- None specified."];
  }

  return items.map((item) => {
    if (typeof item === "string" && item.trim()) {
      return `- ${item}`;
    }
    return `- \`${JSON.stringify(item)}\``;
  });
}
