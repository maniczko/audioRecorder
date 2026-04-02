/**
 * Load Tests — VoiceLog OS API
 *
 * Using k6 for load testing (https://k6.io/)
 *
 * Installation:
 *   brew install k6          # macOS
 *   choco install k6         # Windows
 *   sudo apt-get install k6  # Linux
 *
 * Run:
 *   k6 run tests/load/api-load-test.js              # Standard load test
 *   k6 run tests/load/api-stress-test.js            # Stress test
 *   k6 run tests/load/api-soak-test.js              # Soak test (1 hour)
 *   k6 run tests/load/api-spike-test.js             # Spike test
 *   k6 run --out influxdb=http://localhost:8086/k6  # With real-time metrics
 *
 * Following AGENTS.md §2.1:
 * - Tests define performance budgets
 * - Tests are repeatable and automated
 * - Results are documented and tracked
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// Custom Metrics
// ─────────────────────────────────────────────────────────────────────────────

// Error rate for specific endpoints
const authErrorRate = new Rate('auth_errors');
const mediaErrorRate = new Rate('media_errors');
const aiErrorRate = new Rate('ai_errors');

// Response time trends for critical paths
const authResponseTime = new Trend('auth_response_time');
const mediaResponseTime = new Trend('media_response_time');
const aiResponseTime = new Trend('ai_response_time');

// Request counters
const totalRequests = new Counter('total_requests');
const successfulRequests = new Counter('successful_requests');

// ─────────────────────────────────────────────────────────────────────────────
// Test Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  // Standard load test scenario
  scenarios: {
    // Ramp up to simulate normal daily traffic
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 10 }, // Ramp up to 10 VUs
        { duration: '3m', target: 10 }, // Stay at 10 VUs for 3 minutes
        { duration: '1m', target: 0 }, // Ramp down to 0 VUs
      ],
      tags: { scenario: 'normal' },
    },

    // Peak traffic simulation
    peak_load: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '2m', target: 50 }, // Ramp up to 50 VUs
        { duration: '5m', target: 50 }, // Stay at 50 VUs for 5 minutes
        { duration: '2m', target: 0 }, // Ramp down
      ],
      tags: { scenario: 'peak' },
      startTime: '5m',
    },
  },

  // Performance thresholds (fail test if exceeded)
  thresholds: {
    // Overall error rate must be < 1%
    http_req_failed: ['rate<0.01'],

    // Response time percentiles
    http_req_duration: [
      'p(50)<500', // 50% of requests < 500ms
      'p(90)<1000', // 90% of requests < 1000ms
      'p(95)<1500', // 95% of requests < 1500ms
      'p(99)<3000', // 99% of requests < 3000ms
    ],

    // Endpoint-specific thresholds
    auth_response_time: ['p(90)<300'],
    media_response_time: ['p(90)<800'],
    ai_response_time: ['p(90)<2500'],

    // Error rates per category
    auth_errors: ['rate<0.01'],
    media_errors: ['rate<0.02'],
    ai_errors: ['rate<0.05'],
  },

  // Global settings
  discardResponseBodies: false,
  noConnectionReuse: false,
  insecureSkipTLSVerify: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Data & Setup
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV?.BASE_URL || 'http://localhost:4000';
const TEST_EMAIL = `loadtest_${Date.now()}@example.com`;
const TEST_PASSWORD = 'LoadTest2026!';

let authToken = '';
let userId = '';
let workspaceId = '';
let recordingId = '';

export function setup() {
  console.log('🚀 Starting load test setup...');

  // Register test user
  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: 'Load Test User',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(registerRes, {
    'setup: registered user': (r) => r.status === 201,
  });

  const registerData = registerRes.json();
  userId = registerData.user?.id || '';
  workspaceId = registerData.workspace?.id || '';

  // Login to get auth token
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(loginRes, {
    'setup: logged in': (r) => r.status === 200,
  });

  const loginData = loginRes.json();
  authToken = loginData.token || '';

  console.log(`✅ Setup complete. User: ${userId}, Workspace: ${workspaceId}`);

  return { authToken, userId, workspaceId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Load Test Function
// ─────────────────────────────────────────────────────────────────────────────

export default function (data) {
  const { authToken, workspaceId } = data;

  totalRequests.add(1);

  // Simulate realistic user behavior pattern
  const scenario = Math.random();

  if (scenario < 0.3) {
    // 30% - Auth operations
    executeAuthFlow(authToken);
  } else if (scenario < 0.7) {
    // 40% - Media operations (most common)
    executeMediaFlow(authToken, workspaceId);
  } else if (scenario < 0.9) {
    // 20% - Read operations
    executeReadFlow(authToken, workspaceId);
  } else {
    // 10% - AI operations (expensive)
    executeAIFlow(authToken, workspaceId);
  }

  // Think time between requests (simulate human behavior)
  sleep(Math.random() * 2 + 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// User Flow Scenarios
// ─────────────────────────────────────────────────────────────────────────────

function executeAuthFlow(authToken) {
  const startTime = Date.now();

  // Validate session
  const res = http.get(`${BASE_URL}/auth/session`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  authResponseTime.add(Date.now() - startTime);

  const success = check(res, {
    'auth: session valid': (r) => r.status === 200,
    'auth: has user data': (r) => {
      const body = r.json();
      return body && body.user;
    },
  });

  authErrorRate.add(!success);
  if (success) successfulRequests.add(1);
}

function executeMediaFlow(authToken, workspaceId) {
  const startTime = Date.now();

  // List recordings
  const listRes = http.get(`${BASE_URL}/media/recordings?workspaceId=${workspaceId}`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const listSuccess = check(listRes, {
    'media: list recordings': (r) => r.status === 200,
  });

  // Get bootstrap state
  const bootstrapRes = http.get(`${BASE_URL}/state/bootstrap`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const bootstrapSuccess = check(bootstrapRes, {
    'media: bootstrap loaded': (r) => r.status === 200,
  });

  mediaResponseTime.add(Date.now() - startTime);

  const success = listSuccess && bootstrapSuccess;
  mediaErrorRate.add(!success);
  if (success) successfulRequests.add(1);
}

function executeReadFlow(authToken, workspaceId) {
  // Get workspace state
  const stateRes = http.get(`${BASE_URL}/state/bootstrap`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  check(stateRes, {
    'read: workspace state': (r) => r.status === 200,
  });

  // Get voice profiles
  const profilesRes = http.get(`${BASE_URL}/voice-profiles`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'X-Workspace-Id': workspaceId,
    },
  });

  check(profilesRes, {
    'read: voice profiles': (r) => r.status === 200,
  });

  successfulRequests.add(1);
}

function executeAIFlow(authToken, workspaceId) {
  const startTime = Date.now();

  // AI search (expensive operation)
  const searchRes = http.post(
    `${BASE_URL}/ai/search`,
    JSON.stringify({
      query: 'test search query',
      workspaceId: workspaceId,
    }),
    {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  aiResponseTime.add(Date.now() - startTime);

  const success = check(searchRes, {
    'ai: search completed': (r) => r.status === 200,
  });

  aiErrorRate.add(!success);
  if (success) successfulRequests.add(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown
// ─────────────────────────────────────────────────────────────────────────────

export function teardown(data) {
  const { authToken, userId } = data;

  console.log('🧹 Starting teardown...');

  // Cleanup: Delete test user
  if (authToken && userId) {
    const deleteRes = http.del(`${BASE_URL}/users/${userId}`, null, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    check(deleteRes, {
      'teardown: user deleted': (r) => r.status === 200 || r.status === 204,
    });
  }

  console.log('✅ Teardown complete');
}

// ─────────────────────────────────────────────────────────────────────────────
// Handle Summary (for custom reporting)
// ─────────────────────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    test_type: 'load',
    metrics: {
      total_requests: data.metrics.total_requests ? data.metrics.total_requests.values.count : 0,
      successful_requests: data.metrics.successful_requests
        ? data.metrics.successful_requests.values.count
        : 0,
      success_rate: data.metrics.successful_requests
        ? (
            (data.metrics.successful_requests.values.count /
              data.metrics.total_requests.values.count) *
            100
          ).toFixed(2)
        : 0,

      http_req_duration: data.metrics.http_req_duration
        ? {
            p50: data.metrics.http_req_duration.values['p(50)'],
            p90: data.metrics.http_req_duration.values['p(90)'],
            p95: data.metrics.http_req_duration.values['p(95)'],
            p99: data.metrics.http_req_duration.values['p(99)'],
          }
        : {},

      auth_errors: data.metrics.auth_errors ? data.metrics.auth_errors.values.rate * 100 : 0,
      media_errors: data.metrics.media_errors ? data.metrics.media_errors.values.rate * 100 : 0,
      ai_errors: data.metrics.ai_errors ? data.metrics.ai_errors.values.rate * 100 : 0,
    },
    thresholds: data.metrics,
  };

  return {
    stdout: textSummary(summary),
    [`reports/load-test-${Date.now()}.json`]: JSON.stringify(summary, null, 2),
  };
}

function textSummary(summary) {
  return `
╔═══════════════════════════════════════════════════════════╗
║           LOAD TEST SUMMARY                               ║
╠═══════════════════════════════════════════════════════════╣
║ Timestamp: ${summary.timestamp.padEnd(37)}║
╠═══════════════════════════════════════════════════════════╣
║ Requests:
║   Total:      ${String(summary.metrics.total_requests).padEnd(42)}║
║   Successful: ${String(summary.metrics.successful_requests).padEnd(42)}║
║   Success Rate: ${String(summary.metrics.success_rate + '%').padEnd(41)}║
╠═══════════════════════════════════════════════════════════╣
║ Response Times (ms):
║   p50: ${String(summary.metrics.http_req_duration.p50 || 'N/A').padEnd(49)}║
║   p90: ${String(summary.metrics.http_req_duration.p90 || 'N/A').padEnd(49)}║
║   p95: ${String(summary.metrics.http_req_duration.p95 || 'N/A').padEnd(49)}║
║   p99: ${String(summary.metrics.http_req_duration.p99 || 'N/A').padEnd(49)}║
╠═══════════════════════════════════════════════════════════╣
║ Error Rates:
║   Auth:  ${String(summary.metrics.auth_errors.toFixed(2) + '%').padEnd(47)}║
║   Media: ${String(summary.metrics.media_errors.toFixed(2) + '%').padEnd(47)}║
║   AI:    ${String(summary.metrics.ai_errors.toFixed(2) + '%').padEnd(47)}║
╚═══════════════════════════════════════════════════════════╝
`;
}
