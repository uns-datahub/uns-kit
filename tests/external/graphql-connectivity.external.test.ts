import { GraphQLClient, gql } from "graphql-request";
import { describe, expect, it } from "vitest";

const endpoint = process.env["UNS_KIT_TEST_GRAPHQL_URL"]?.trim();
const token = process.env["UNS_KIT_TEST_GRAPHQL_TOKEN"]?.trim();

describe.skipIf(!endpoint)("GraphQL connectivity (external)", () => {
  it("responds to an introspection query", async () => {
    if (!endpoint) {
      throw new Error("UNS_KIT_TEST_GRAPHQL_URL is required for the external GraphQL test.");
    }

    const client = new GraphQLClient(endpoint, {
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    });
    const response = await client.request<{ __schema: { queryType: { name: string } } }>(gql`
      query UnsKitExternalIntrospection {
        __schema {
          queryType {
            name
          }
        }
      }
    `);

    expect(response.__schema.queryType.name).toMatch(/Query/);
  });
});
