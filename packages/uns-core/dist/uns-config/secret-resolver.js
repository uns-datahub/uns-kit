import os from "node:os";
import { isSecretPlaceholder, } from "./secret-placeholders";
import { isHostPlaceholder, } from "./host-placeholders";
const envCache = new Map();
const infisicalCache = new Map();
const structuredCloneFallback = (value) => typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
export async function resolveConfigSecrets(config, options = {}) {
    const working = structuredCloneFallback(config);
    await resolveNode(working, options);
    return working;
}
export function clearSecretResolverCaches() {
    envCache.clear();
    infisicalCache.clear();
    defaultInfisicalFetcherCache.clear();
}
async function resolveNode(node, options) {
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
        const obj = node;
        for (const key of Object.keys(obj)) {
            const current = obj[key];
            if (isSecretPlaceholder(current)) {
                const resolved = await resolveSecretValue(current, options);
                if (resolved === undefined) {
                    delete obj[key];
                }
                else {
                    obj[key] = resolved;
                }
                continue;
            }
            if (isHostPlaceholder(current)) {
                const resolved = await resolveHostValue(current, options.hosts);
                if (resolved === undefined) {
                    delete obj[key];
                }
                else {
                    obj[key] = resolved;
                }
                continue;
            }
            const resolvedChild = await resolveNode(current, options);
            obj[key] = resolvedChild;
        }
        return obj;
    }
    return node;
}
async function resolveSecretValue(placeholder, options) {
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
function assertNeverProvider(x) {
    throw new Error(`Unsupported secret provider: ${JSON.stringify(x)}`);
}
async function resolveHostValue(placeholder, options) {
    const effectiveOptions = options ?? {};
    switch (placeholder.provider) {
        case "inline":
            return placeholder.value;
        case "external": {
            const envMap = effectiveOptions.env ?? process.env;
            let resolved = await maybeResolveExternal(placeholder.key, effectiveOptions.resolveExternal);
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
async function maybeResolveExternal(key, resolver) {
    if (!resolver) {
        return undefined;
    }
    try {
        return await resolver(key);
    }
    catch (error) {
        throw new Error(`Failed to resolve external host '${key}' via custom resolver: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}
function assertNeverHostProvider(x) {
    throw new Error(`Unsupported host provider: ${JSON.stringify(x)}`);
}
function resolveSystemHost(placeholder, options) {
    const getInterfaces = options.networkInterfaces ?? os.networkInterfaces;
    const interfaces = getInterfaces();
    const family = placeholder.family ?? "IPv4";
    const targetName = placeholder.interfaceName;
    const interfaceEntries = targetName
        ? [[targetName, interfaces[targetName]]]
        : Object.entries(interfaces);
    for (const [name, ifaceList] of interfaceEntries) {
        if (!ifaceList) {
            continue;
        }
        for (const iface of ifaceList) {
            if (iface &&
                iface.family === family &&
                iface.internal !== true &&
                typeof iface.address === "string" &&
                iface.address.length > 0) {
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
    throw new Error(`System host lookup failed for ${targetDescription} (family ${family}).`);
}
async function resolveEnvSecret(placeholder, options) {
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
async function resolveInfisicalSecret(placeholder, options) {
    const infisicalOptions = options.infisical;
    const fetcher = await getInfisicalFetcher(infisicalOptions);
    if (!fetcher) {
        options.onMissingSecret?.(placeholder, "infisical");
        throw new Error("Infisical secret requested but no resolver is configured. Provide SecretResolverOptions.infisical.");
    }
    const environment = placeholder.environment ?? infisicalOptions?.environment ?? process.env.INFISICAL_ENVIRONMENT;
    const projectId = placeholder.projectId ?? infisicalOptions?.projectId ?? process.env.INFISICAL_PROJECT_ID;
    const type = infisicalOptions?.type ?? "shared";
    if (!environment) {
        throw new Error(`Infisical secret '${placeholder.path}:${placeholder.key}' is missing an environment. ` +
            "Set it on the placeholder, pass SecretResolverOptions.infisical.environment, or define INFISICAL_ENVIRONMENT.");
    }
    if (!projectId) {
        throw new Error(`Infisical secret '${placeholder.path}:${placeholder.key}' is missing a project id. ` +
            "Set it on the placeholder, pass SecretResolverOptions.infisical.projectId, or define INFISICAL_PROJECT_ID.");
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
            throw new Error(`Secret '${placeholder.path}:${placeholder.key}' not found in Infisical.`);
        }
        return secret;
    });
    if (infisicalOptions?.cache !== false) {
        infisicalCache.set(cacheKey, fetchPromise);
    }
    return fetchPromise;
}
async function getInfisicalFetcher(options) {
    if (!options) {
        return undefined;
    }
    if (options.fetchSecret) {
        return options.fetchSecret;
    }
    const token = options.token ??
        process.env.INFISICAL_TOKEN ??
        process.env.INFISICAL_PERSONAL_TOKEN ??
        "";
    if (!token) {
        return undefined;
    }
    const siteUrlKey = options.siteUrl ?? process.env.INFISICAL_SITE_URL ?? "";
    const cacheKey = `${token}::${siteUrlKey}`;
    if (!defaultInfisicalFetcherCache.has(cacheKey)) {
        defaultInfisicalFetcherCache.set(cacheKey, createDefaultInfisicalFetcher(token, options.siteUrl));
    }
    const baseFetcher = await defaultInfisicalFetcherCache.get(cacheKey);
    return baseFetcher;
}
const defaultInfisicalFetcherCache = new Map();
async function createDefaultInfisicalFetcher(token, siteUrl) {
    try {
        const sdkModule = await import("@infisical/sdk");
        const { InfisicalSDK, SecretType } = sdkModule;
        if (!InfisicalSDK) {
            throw new Error("@infisical/sdk does not export InfisicalSDK");
        }
        const sdkInstance = new InfisicalSDK({ siteUrl });
        const authenticatedSdk = sdkInstance.auth().accessToken(token);
        return async ({ path, key, environment, projectId, type = "shared" }) => {
            if (!environment) {
                throw new Error(`Infisical secret '${path}:${key}' is missing an environment.`);
            }
            if (!projectId) {
                throw new Error(`Infisical secret '${path}:${key}' is missing a project id.`);
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
    }
    catch (error) {
        throw new Error("Failed to initialize @infisical/sdk. Install the package or provide SecretResolverOptions.infisical.fetchSecret.", { cause: error });
    }
}
