import { GraphQLClient, gql, ClientError } from "graphql-request";
import { TreeStructure } from "./schema.js";
import * as path from "path";
import * as fs from 'fs';
import { mkdir } from "fs/promises";
import { ConfigFile } from "../config-file.js";
import { AuthClient } from "./auth/index.js";


const config = await ConfigFile.loadConfig();

// Helper function to write content to a file
async function writeToFile(filePath: string, content: string) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filePath, content, (error: NodeJS.ErrnoException | null) => {
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
function generateUnsTopics(tree: TreeStructure[], currentPath: string): string {
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

async function requestWithAuth<T>(document: any): Promise<T> {
  try {
    return await client.request<T>(document);
  } catch (err: any) {
    const isAuthErr = err instanceof ClientError && (err.response.status === 401 || err.response.status === 403);
    if (isAuthErr) {
      // Attempt to get a fresh token (will try refresh, then prompt)
      accessToken = await auth.getAccessToken();
      client.setHeader('Authorization', `Bearer ${accessToken}`);
      return await client.request<T>(document);
    }
    throw err;
  }
}

// Fetch and generate UnsTopics
async function refreshUnsTopics() {
  const document = gql`
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

  const query: any = await requestWithAuth(document);
  const tree: TreeStructure[] = query.GetTreeStructure;

  const vsebina = `export type UnsTopics = ${generateUnsTopics(tree, '')}\n(string & {});`;
  const outputPath = path.resolve(process.cwd(), "src/uns/uns-topics.ts");
  await ensureDirectory(path.dirname(outputPath));
  await writeToFile(outputPath, vsebina);
}

// Fetch and generate UnsTags
async function refreshUnsTags() {
  const document = gql`
  query Query {
    GetTags
  }`;

  const query: any = await requestWithAuth(document);
  const tags: string[] = query.GetTags;

  const vsebina = `export type UnsTags = ${tags.map(tag => `"${tag}" |`).join('')}\n(string & {});`;
  const outputPath = path.resolve(process.cwd(), "src/uns/uns-tags.ts");
  await ensureDirectory(path.dirname(outputPath));
  await writeToFile(outputPath, vsebina);
}

// Execute the refresh processes
async function refresh() {
  await Promise.all([refreshUnsTopics(), refreshUnsTags()]);
}

refresh().catch(error => console.error('Error during refresh:', error));

async function ensureDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}
