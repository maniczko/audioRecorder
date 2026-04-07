import {
  parseRailwayDeploymentsPayload,
  RAILWAY_DEPLOYMENTS_QUERY,
} from './railway-status.js';

describe('railway-status', () => {
  it('uses the current Railway deployments query shape with input', () => {
    expect(RAILWAY_DEPLOYMENTS_QUERY).toContain('query Deployments($input: DeploymentListInput!)');
    expect(RAILWAY_DEPLOYMENTS_QUERY).toContain('deployments(first: 10, input: $input)');
    expect(RAILWAY_DEPLOYMENTS_QUERY).not.toContain('projectId: $projectId');
    expect(RAILWAY_DEPLOYMENTS_QUERY).not.toContain('errorMessage');
  });

  it('maps successful Railway payloads into deployment entries', () => {
    const result = parseRailwayDeploymentsPayload({
      data: {
        deployments: {
          edges: [
            {
              node: {
                id: 'dep_1',
                meta: { commit: 'abc' },
                createdAt: '2026-04-07T15:00:00.000Z',
                updatedAt: '2026-04-07T15:01:00.000Z',
                status: 'SUCCESS',
                url: 'https://example.up.railway.app',
                staticUrl: null,
                diagnosis: null,
                environment: { id: 'env_1', name: 'production' },
                service: { id: 'svc_1', name: 'api' },
              },
            },
          ],
        },
      },
    });

    expect(result.apiError).toBeNull();
    expect(result.deployments).toHaveLength(1);
    expect(result.lastDeployment?.status).toBe('SUCCESS');
    expect(result.lastDeployment?.service?.name).toBe('api');
    expect(result.note).toBeUndefined();
  });

  it('reports authorization problems without pretending Railway has a deployment failure', () => {
    const result = parseRailwayDeploymentsPayload({
      errors: [
        {
          message: 'Not Authorized',
        },
      ],
    });

    expect(result.deployments).toEqual([]);
    expect(result.lastDeployment).toBeNull();
    expect(result.apiError).toBe('Not Authorized');
    expect(result.note).toContain('not authorized');
  });

  it('keeps empty responses distinct from API errors', () => {
    const result = parseRailwayDeploymentsPayload({
      data: {
        deployments: {
          edges: [],
        },
      },
    });

    expect(result.apiError).toBeNull();
    expect(result.deployments).toEqual([]);
    expect(result.note).toContain('No recent deployments returned');
  });
});
