import type { CodegenConfig } from '@graphql-codegen/cli';
import { ConfigFile } from '@uns-kit/core.js';

const appConfig = await ConfigFile.loadConfig();

const config: CodegenConfig = {
  schema: appConfig.uns.graphql,
  generates: {
    'src/graphql/schema.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-resolvers'],
    },
  },
};

export default config;
