export const RAILWAY_DEPLOYMENTS_QUERY = `
  query Deployments($input: DeploymentListInput!) {
    deployments(first: 10, input: $input) {
      edges {
        node {
          id
          meta
          createdAt
          updatedAt
          status
          url
          staticUrl
          diagnosis
          environment {
            id
            name
          }
          service {
            id
            name
          }
        }
      }
    }
  }
`;

function normalizeRailwayApiError(message) {
  if (!message) {
    return 'Railway API error while listing deployments.';
  }

  if (/not authorized/i.test(message)) {
    return 'Railway deployment list is not authorized for the configured token/project.';
  }

  return `Railway API error: ${message}`;
}

export function parseRailwayDeploymentsPayload(payload) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];

  if (errors.length > 0) {
    const firstMessage = typeof errors[0]?.message === 'string' ? errors[0].message : '';

    return {
      deployments: [],
      lastDeployment: null,
      note: normalizeRailwayApiError(firstMessage),
      apiError: firstMessage || 'Unknown Railway API error',
    };
  }

  const deployments = (payload?.data?.deployments?.edges || []).map(({ node }) => ({
    id: node.id,
    meta: node.meta,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    status: node.status,
    url: node.url || node.staticUrl || null,
    diagnosis: node.diagnosis || null,
    environment: node.environment || null,
    service: node.service || null,
  }));

  return {
    deployments,
    lastDeployment: deployments[0] || null,
    note: deployments.length > 0 ? undefined : 'No recent deployments returned for this Railway project.',
    apiError: null,
  };
}
