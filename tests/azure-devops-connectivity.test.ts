// tests/azure-devops-connectivity.test.ts
import { describe, it, expect } from 'vitest';
import * as azdev from 'azure-devops-node-api';
import * as CoreApi from 'azure-devops-node-api/CoreApi';

const orgUrl = 'https://dev.azure.com/example-org';
const pat = process.env.AZURE_PAT;

if (!pat) {
  console.warn(
    'AZURE_PAT environment variable is not set. ' +
    'To generate a PAT, go to [https://dev.azure.com/example-org/_usersSettings/tokens] and create one with appropriate scopes, ' +
    'then run:\n\n' +
    '  export AZURE_PAT=<your-token>\n'
  );
}

(pat ? describe : describe.skip)('Azure DevOps Connectivity', () => {
  it('authenticates and lists at least one project', async () => {
    const authHandler = azdev.getPersonalAccessTokenHandler(pat!);
    const connection = new azdev.WebApi(orgUrl, authHandler);
    await connection.connect();

    const coreApi: CoreApi.ICoreApi = await connection.getCoreApi();
    const projects = await coreApi.getProjects();

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects[0]).toHaveProperty('name');
    expect(typeof projects[0].name).toBe('string');
  });
});
