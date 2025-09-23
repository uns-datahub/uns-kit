import os from "node:os";
import type { NetworkInterfaceInfo } from "node:os";
import type { AppConfig } from "../app-config";
import {
  isSecretPlaceholder,
  type EnvSecretPlaceholder,
  type InfisicalSecretPlaceholder,
  type SecretPlaceholder,
} from "./secret-placeholders";
import {
  isHostPlaceholder,
  type HostPlaceholder,
  type SystemHostPlaceholder,
} from "./host-placeholders";

export type SecretValueResolved = string | undefined;
export type HostValueResolved = string | undefined;

type SecretPlaceholderCandidate =
  | { provider: "env"; key: string }
  | { provider: "infisical"; key: string; path: string };

type HostPlaceholderCandidate = HostPlaceholder;

export type ResolvedConfig<T> = T extends SecretPlaceholderCandidate
  ? SecretValueResolved
  : T extends HostPlaceholderCandidate
    ? HostValueResolved
  : T extends (infer U)[]
    ? ResolvedConfig<U>[]
    : T extends Record<string, unknown>
      ? { [K in keyof T]: ResolvedConfig<T[K]> }
      : T;

export type ResolvedAppConfig = ResolvedConfig<AppConfig>;

export interface InfisicalFetchRequest {
  path: string;
  key: string;
  environment?: string;
  projectId?: string;
  type?: "shared" | "personal";
}

export type InfisicalFetcher = (
  request: InfisicalFetchRequest
) => Promise<string | undefined>;

export interface InfisicalResolverOptions {
  /**
   * Provide a custom fetcher. If omitted, the resolver tries to lazily instantiate
   * an Infisical client using @infisical/sdk based on the supplied token/siteUrl/options.
   */
  fetchSecret?: InfisicalFetcher;
  /**
   * Machine token or personal token used when creating the default Infisical client.
   * Falls back to the INFISICAL_TOKEN or INFISICAL_PERSONAL_TOKEN environment variables.
   */
  token?: string;
  /** Optional Infisical site URL override. Defaults to INFISICAL_SITE_URL when present. */
  siteUrl?: string;
  /** Default environment used when a placeholder does not specify one explicitly. */
  environment?: string;
  /** Default project id used when a placeholder does not provide one. */
  projectId?: string;
  /** Default secret type. Shared secrets are used by default. */
  type?: "shared" | "personal";
  /** Disable in-memory caching when set to false. Enabled by default. */
  cache?: boolean;
}

export interface SecretResolverOptions {
  /** Environment map used for `env` placeholders. Defaults to process.env. */
  env?: NodeJS.ProcessEnv;
  /** Configuration for resolving Infisical placeholders. */
  infisical?: InfisicalResolverOptions;
  /** Callback invoked before throwing when a required secret cannot be resolved. */
  onMissingSecret?: (placeholder: SecretPlaceholder, source: "env" | "infisical") => void;
  /** Configuration for resolving host placeholders. */
  hosts?: HostResolverOptions;
}

export interface HostResolverOptions {
  /** Optional environment map used when falling back to process.env lookups. */
  env?: NodeJS.ProcessEnv;
  /** Static mapping of external host keys to concrete host strings. */
  externalHosts?: Record<string, string | undefined>;
  /**
   * Custom resolver invoked when an external host needs to be resolved.
   * It can return synchronously or asynchronously.
   */
  resolveExternal?: (key: string) => string | undefined | Promise<string | undefined>;
  /** Override for os.networkInterfaces (handy for tests). */
  networkInterfaces?: () => Record<string, NetworkInterfaceInfo[] | undefined>;
  /** Callback invoked before throwing when a required host cannot be resolved. */
  onMissingHost?: (placeholder: HostPlaceholder) => void;
}

const envCache = new Map<string, string | undefined>();
const infisicalCache = new Map<string, Promise<string | undefined>>();

const structuredCloneFallback = <T>(value: T): T =>
  typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);

export async function resolveConfigSecrets(
  config: AppConfig,
  options: SecretResolverOptions = {}
): Promise<ResolvedAppConfig> {
  const working = structuredCloneFallback(config);
  await resolveNode(working, options);
  return working as ResolvedAppConfig;
}

export function clearSecretResolverCaches(): void {
  envCache.clear();
  infisicalCache.clear();
  defaultInfisicalFetcherCache.clear();
}

async function resolveNode(node: unknown, options: SecretResolverOptions): Promise<unknown> {
  if (isSecretPlaceholder(node)) {
    return resolveSecretValue(node, options);
  }

  if (isHostPlaceholder(node)) {
    return resolveHostValue(node, options.hosts);
  }

  if (Array.isArray(node)) {
    const resolvedArray = await Promise.all(node.map(item => resolveNode(item, options)));
    return resolvedArray;
  }

  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;

    for (const key of Object.keys(obj)) {
      const current = obj[key];

      if (isSecretPlaceholder(current)) {
        const resolved = await resolveSecretValue(current, options);
        if (resolved === undefined) {
          delete obj[key];
        } else {
          obj[key] = resolved;
        }
        continue;
      }

      if (isHostPlaceholder(current)) {
        const resolved = await resolveHostValue(current, options.hosts);
        if (resolved === undefined) {
          delete obj[key];
        } else {
          obj[key] = resolved;
        }
        continue;
      }

      const resolvedChild = await resolveNode(current, options);
      obj[key] = resolvedChild as unknown;
    }

    return obj;
  }

  return node;
}

async function resolveSecretValue(
  placeholder: SecretPlaceholder,
  options: SecretResolverOptions
): Promise<SecretValueResolved> {
  switch (placeholder.provider) {
    case "env":
      return resolveEnvSecret(placeholder, options);
    case "infisical":
      return resolveInfisicalSecret(placeholder, options);
    default:
      // Exhaustive check to guard future provider additions.
      return assertNeverProvider(placeholder);
  }
}

function assertNeverProvider(x: never): never {
  throw new Error(`Unsupported secret provider: ${JSON.stringify(x)}`);
}

async function resolveHostValue(
  placeholder: HostPlaceholder,
  options?: HostResolverOptions
): Promise<HostValueResolved> {
  const effectiveOptions = options ?? {};

  switch (placeholder.provider) {
    case "inline":
      return placeholder.value;
    case "external": {
      const envMap = effectiveOptions.env ?? process.env;

      let resolved = await maybeResolveExternal(
        placeholder.key,
        effectiveOptions.resolveExternal
      );

      if (resolved === undefined) {
        resolved = effectiveOptions.externalHosts?.[placeholder.key];
      }

      if (resolved === undefined) {
        resolved = envMap?.[placeholder.key];
      }

      if (resolved === undefined) {
        if (placeholder.default !== undefined) {
          return placeholder.default;
        }
        if (placeholder.optional) {
          return undefined;
        }

        effectiveOptions.onMissingHost?.(placeholder);
        throw new Error(`External host '${placeholder.key}' could not be resolved.`);
      }

      return resolved;
    }
    case "system":
      return resolveSystemHost(placeholder, effectiveOptions);
    default:
      return assertNeverHostProvider(placeholder);
  }
}

async function maybeResolveExternal(
  key: string,
  resolver?: (key: string) => string | undefined | Promise<string | undefined>
): Promise<string | undefined> {
  if (!resolver) {
    return undefined;
  }

  try {
    return await resolver(key);
  } catch (error) {
    throw new Error(
      `Failed to resolve external host '${key}' via custom resolver: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
}

function assertNeverHostProvider(x: never): never {
  throw new Error(`Unsupported host provider: ${JSON.stringify(x)}`);
}

function resolveSystemHost(
  placeholder: SystemHostPlaceholder,
  options: HostResolverOptions
): HostValueResolved {
  const getInterfaces = options.networkInterfaces ?? os.networkInterfaces;
  const interfaces = getInterfaces();
  const family = placeholder.family ?? "IPv4";
  const targetName = placeholder.interfaceName;

  const interfaceEntries: Array<readonly [string, NetworkInterfaceInfo[] | undefined]> = targetName
    ? [[targetName, interfaces[targetName]]]
    : Object.entries(interfaces);

  for (const [name, ifaceList] of interfaceEntries) {
    if (!ifaceList) {
      continue;
    }
    for (const iface of ifaceList) {
      if (
        iface &&
        iface.family === family &&
        iface.internal !== true &&
        typeof iface.address === "string" &&
        iface.address.length > 0
      ) {
        return iface.address;
      }
    }

    if (targetName) {
      break;
    }
  }

  if (placeholder.default !== undefined) {
    return placeholder.default;
  }

  if (placeholder.optional) {
    return undefined;
  }

  options.onMissingHost?.(placeholder);
  const targetDescription = targetName ? `interface '${targetName}'` : "available interfaces";
  throw new Error(
    `System host lookup failed for ${targetDescription} (family ${family}).`
  );
}

async function resolveEnvSecret(
  placeholder: EnvSecretPlaceholder,
  options: SecretResolverOptions
): Promise<SecretValueResolved> {
  const envMap = options.env ?? process.env;
  const cacheKey = placeholder.key;

  if (envCache.has(cacheKey)) {
    return envCache.get(cacheKey) ?? undefined;
  }

  const value = envMap[cacheKey];

  if (value === undefined || value === null) {
    if (placeholder.default !== undefined) {
      envCache.set(cacheKey, placeholder.default);
      return placeholder.default;
    }
    if (placeholder.optional) {
      envCache.set(cacheKey, undefined);
      return undefined;
    }

    options.onMissingSecret?.(placeholder, "env");
    throw new Error(`Required environment variable '${cacheKey}' is not set.`);
  }

  envCache.set(cacheKey, value);
  return value;
}

async function resolveInfisicalSecret(
  placeholder: InfisicalSecretPlaceholder,
  options: SecretResolverOptions
): Promise<SecretValueResolved> {
  const infisicalOptions = options.infisical;
  const fetcher = await getInfisicalFetcher(infisicalOptions);

  if (!fetcher) {
    options.onMissingSecret?.(placeholder, "infisical");
    throw new Error(
      "Infisical secret requested but no resolver is configured. Provide SecretResolverOptions.infisical."
    );
  }

  const environment = placeholder.environment ?? infisicalOptions?.environment ?? process.env.INFISICAL_ENVIRONMENT;
  const projectId = placeholder.projectId ?? infisicalOptions?.projectId ?? process.env.INFISICAL_PROJECT_ID;
  const type = infisicalOptions?.type ?? "shared";

  if (!environment) {
    throw new Error(
      `Infisical secret '${placeholder.path}:${placeholder.key}' is missing an environment. ` +
      "Set it on the placeholder, pass SecretResolverOptions.infisical.environment, or define INFISICAL_ENVIRONMENT."
    );
  }

  if (!projectId) {
    throw new Error(
      `Infisical secret '${placeholder.path}:${placeholder.key}' is missing a project id. ` +
      "Set it on the placeholder, pass SecretResolverOptions.infisical.projectId, or define INFISICAL_PROJECT_ID."
    );
  }

  const cacheKey = JSON.stringify({
    path: placeholder.path,
    key: placeholder.key,
    environment,
    projectId,
    type,
  });

  if (infisicalOptions?.cache !== false && infisicalCache.has(cacheKey)) {
    return infisicalCache.get(cacheKey) ?? undefined;
  }

  const fetchPromise = fetcher({
    path: placeholder.path,
    key: placeholder.key,
    environment,
    projectId,
    type,
  }).then(secret => {
    if (secret === undefined || secret === null) {
      if (placeholder.default !== undefined) {
        return placeholder.default;
      }
      if (placeholder.optional) {
        return undefined;
      }
      options.onMissingSecret?.(placeholder, "infisical");
      throw new Error(
        `Secret '${placeholder.path}:${placeholder.key}' not found in Infisical.`
      );
    }
    return secret;
  });

  if (infisicalOptions?.cache !== false) {
    infisicalCache.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

async function getInfisicalFetcher(
  options?: InfisicalResolverOptions
): Promise<InfisicalFetcher | undefined> {
  if (!options) {
    return undefined;
  }

  if (options.fetchSecret) {
    return options.fetchSecret;
  }

  const token =
    options.token ??
    process.env.INFISICAL_TOKEN ??
    process.env.INFISICAL_PERSONAL_TOKEN ??
    "";

  if (!token) {
    return undefined;
  }

  const siteUrlKey = options.siteUrl ?? process.env.INFISICAL_SITE_URL ?? "";
  const cacheKey = `${token}::${siteUrlKey}`;

  if (!defaultInfisicalFetcherCache.has(cacheKey)) {
    defaultInfisicalFetcherCache.set(
      cacheKey,
      createDefaultInfisicalFetcher(token, options.siteUrl)
    );
  }

  const baseFetcher = await defaultInfisicalFetcherCache.get(cacheKey)!;
  return baseFetcher;
}

const defaultInfisicalFetcherCache = new Map<string, Promise<InfisicalFetcher>>();

async function createDefaultInfisicalFetcher(
  token: string,
  siteUrl?: string
): Promise<InfisicalFetcher> {
  try {
    const sdkModule: typeof import("@infisical/sdk") = await import("@infisical/sdk");
    const { InfisicalSDK, SecretType } = sdkModule;
    if (!InfisicalSDK) {
      throw new Error("@infisical/sdk does not export InfisicalSDK");
    }

    const sdkInstance = new InfisicalSDK({ siteUrl });
    const authenticatedSdk = sdkInstance.auth().accessToken(token);

    return async ({ path, key, environment, projectId, type = "shared" }: InfisicalFetchRequest) => {
      if (!environment) {
        throw new Error(
          `Infisical secret '${path}:${key}' is missing an environment.`
        );
      }
      if (!projectId) {
        throw new Error(
          `Infisical secret '${path}:${key}' is missing a project id.`
        );
      }

      const secret = await authenticatedSdk
        .secrets()
        .getSecret({
          secretName: key,
          secretPath: path,
          environment,
          projectId,
          viewSecretValue: true,
          type: type === "personal" ? SecretType.Personal : SecretType.Shared,
        });

      return secret?.secretValue ?? undefined;
    };
  } catch (error) {
    throw new Error(
      "Failed to initialize @infisical/sdk. Install the package or provide SecretResolverOptions.infisical.fetchSecret.",
      { cause: error as Error }
    );
  }
}
