// tests/graphql-connectivity.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { request, gql } from 'graphql-request';
import { ConfigFile } from '../src/config-file';

let endpoint: string;

beforeAll(async () => {
  const config = await ConfigFile.loadConfig();
  endpoint = config.uns.graphql;
});

describe('GraphQL Connectivity', () => {
  it('responds to an introspection query', async () => {
    const introspection = gql`
      query {
        __schema {
          queryType {
            name
          }
        }
      }
    `;
    const resp: any = await request(endpoint, introspection);
    // we should get back a __schema object and the root query type name
    expect(resp).toHaveProperty('__schema');
    expect(resp.__schema.queryType.name).toMatch(/Query/);
  });
});
