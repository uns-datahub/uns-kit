import { GraphQLClient, gql, ClientError } from "graphql-request";
import * as path from "path";
import * as fs from 'fs';
import { mkdir } from "fs/promises";
import { ConfigFile } from "../config-file.js";
import { AuthClient } from "./auth/index.js";
const config = await ConfigFile.loadConfig();
// Helper function to write content to a file
async function writeToFile(filePath, content) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, content, (error) => {
            if (error) {
                console.error('Error writing file:', error);
                return reject(error);
            }
            console.log(`${path.basename(filePath)} updated.`);
            resolve();
        });
    });
}
// Function to process tree structure recursively
function generateUnsTopics(tree, currentPath) {
    return tree
        .map(element => {
        const newPath = `${currentPath}${element.unsNode}/`;
        const childrenTopics = element.children?.length
            ? generateUnsTopics(element.children, newPath)
            : '';
        return `"${newPath}" |${childrenTopics}`;
    })
        .join('');
}
// Prepare GraphQL client with Authorization from auth library
const auth = await AuthClient.create();
let accessToken = await auth.getAccessToken();
let client = new GraphQLClient(config.uns.graphql, {
    headers: { Authorization: `Bearer ${accessToken}` },
});
async function requestWithAuth(document) {
    try {
        return await client.request(document);
    }
    catch (err) {
        const isAuthErr = err instanceof ClientError && (err.response.status === 401 || err.response.status === 403);
        if (isAuthErr) {
            // Attempt to get a fresh token (will try refresh, then prompt)
            accessToken = await auth.getAccessToken();
            client.setHeader('Authorization', `Bearer ${accessToken}`);
            return await client.request(document);
        }
        throw err;
    }
}
// Fetch and generate UnsTopics
async function refreshUnsTopics() {
    const document = gql `
  query GetTreeStructure {
    GetTreeStructure {
      id
      parent
      unsNode
      children {
        id
        parent
        unsNode
        children {
          id
          parent
          unsNode
          children {
            id
            parent
            unsNode
            children {
              id
              parent
              unsNode
              children {
                id
                parent
                unsNode
              }
            }
          }
        }
      }
    }
  }`;
    const query = await requestWithAuth(document);
    const tree = query.GetTreeStructure;
    const vsebina = `export type UnsTopics = ${generateUnsTopics(tree, '')}\n(string & {});`;
    const outputPath = path.resolve(process.cwd(), "src/uns/uns-topics.ts");
    await ensureDirectory(path.dirname(outputPath));
    await writeToFile(outputPath, vsebina);
}
// Fetch and generate UnsTags
async function refreshUnsTags() {
    const document = gql `
  query Query {
    GetTags
  }`;
    const query = await requestWithAuth(document);
    const tags = query.GetTags;
    const vsebina = `export type UnsTags = ${tags.map(tag => `"${tag}" |`).join('')}\n(string & {});`;
    const outputPath = path.resolve(process.cwd(), "src/uns/uns-tags.ts");
    await ensureDirectory(path.dirname(outputPath));
    await writeToFile(outputPath, vsebina);
}
function normalizeAttributePath(pathValue) {
    if (!pathValue)
        return "";
    return pathValue.replace(/\/+$/, "");
}
function buildAttributeEntries(attributes) {
    const deduped = new Map();
    for (const attr of attributes) {
        if (!attr)
            continue;
        const path = normalizeAttributePath(typeof attr.path === "string" ? attr.path : null);
        if (!path)
            continue;
        deduped.set(path, {
            path,
            description: typeof attr.description === "string" ? attr.description : null,
            attributeType: typeof attr.attributeType === "string" ? attr.attributeType : null,
            dataGroup: typeof attr.dataGroup === "string" ? attr.dataGroup : null,
            objectType: typeof attr.objectType === "string" ? attr.objectType : null,
            objectId: typeof attr.objectId === "string" ? attr.objectId : null,
        });
    }
    return Array.from(deduped.values()).sort((a, b) => a.path.localeCompare(b.path));
}
function buildAssetEntries(assets) {
    const deduped = new Map();
    for (const entry of assets) {
        if (!entry)
            continue;
        const assetName = typeof entry.asset === "string" ? entry.asset.trim() : "";
        if (!assetName)
            continue;
        const description = typeof entry.description === "string" ? entry.description : null;
        if (!deduped.has(assetName)) {
            deduped.set(assetName, { asset: assetName, description });
        }
    }
    return Array.from(deduped.values()).sort((a, b) => a.asset.localeCompare(b.asset));
}
// Fetch and generate UnsAssets
async function refreshUnsAssets() {
    const document = gql `
  query GetAssets {
    GetAssets {
      path
      description
      asset
      objectType
      objectId
    }
  }`;
    const query = await requestWithAuth(document);
    let assets = buildAssetEntries(Array.isArray(query.GetAssets) ? query.GetAssets : []);
    if (!assets.length) {
        assets = [{ asset: "asset", description: null }];
    }
    const header = `// Generated UNS asset list. Run \`pnpm run refresh-uns\` to update.\n`;
    const entries = assets
        .map((entry) => {
        const comment = entry.description ? `  /** ${sanitizeComment(entry.description)} */\n` : "";
        return `${comment}  "${entry.asset}": "${entry.asset}",`;
    })
        .join("\n");
    const helpers = `
export function resolveGeneratedAsset(name: keyof typeof GeneratedAssets): (typeof GeneratedAssets)[keyof typeof GeneratedAssets];
export function resolveGeneratedAsset<T extends string>(name: T): (typeof GeneratedAssets)[keyof typeof GeneratedAssets] | T;
export function resolveGeneratedAsset(name: string): string {
  return (GeneratedAssets as Record<string, string>)[name] ?? name;
}
`;
    const vsebina = `${header}export const GeneratedAssets = {\n${entries}\n} as const;\nexport type GeneratedAssetName = typeof GeneratedAssets[keyof typeof GeneratedAssets];\n${helpers}`;
    const outputPath = path.resolve(process.cwd(), "src/uns/uns-assets.ts");
    await ensureDirectory(path.dirname(outputPath));
    await writeToFile(outputPath, vsebina);
}
// Execute the refresh processes
async function refresh() {
    await Promise.all([refreshUnsTopics(), refreshUnsTags(), refreshUnsAssets()]);
}
refresh().catch(error => console.error('Error during refresh:', error));
async function ensureDirectory(dirPath) {
    await mkdir(dirPath, { recursive: true });
}
function sanitizeComment(text) {
    return text.replace(/\*\//g, "*\\/");
}
//# sourceMappingURL=refresh-uns.js.map