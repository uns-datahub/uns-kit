import { ConfigFile } from "./src/config-file.js";
import type { CodegenConfig } from '@graphql-codegen/cli';

async function getConfig(): Promise<CodegenConfig> {
  const configFile = await ConfigFile.loadConfig();

  return {
    schema: configFile.uns.graphql,
    generates: {
      'src/graphql/schema.ts': {
        plugins: ['typescript', 'typescript-operations', 'typescript-resolvers'],
      }
    }
  };
}

export default getConfig();
