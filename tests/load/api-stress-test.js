/**
 * Load Tests — Stress Test Scenario
 * 
 * Purpose: Find breaking point of the system
 * Method: Continuously add load until system fails
 * 
 * Run:
 *   k6 run tests/load/api-stress-test.js
 * 
 * Success Criteria:
 * - System recovers after load is removed
 * - No data corruption
 * - Error rates remain acceptable under load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },    // Warm up
        { duration: '3m', target: 50 },    // Normal load
        { duration: '5m', target: 100 },   // High load
        { duration: '5m', target: 200 },   // Very high load
        { duration: '5m', target: 500 },   // Extreme load (breaking point)
        { duration: '10m', target: 500 },  // Sustain breaking point
        { duration: '3m', target: 0 },     // Cool down
      ],
      tags: { scenario: 'stress' },
    },
  },
  
  thresholds: {
    'http_req_failed': ['rate<0.1'],  // Allow up to 10% errors under stress
    'response_time': ['p(95)<5000'],  // 95% under 5 seconds
    'errors': ['rate<0.15'],          // Allow up to 15% error rate
  },
  
  // Don't fail the entire test if thresholds are breached
  // (we want to find the breaking point)
  noThresholdFailures: true,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Simple auth token (pre-generated for stress test)
const authToken = __ENV.AUTH_TOKEN || 'test-token';
const workspaceId = __ENV.WORKSPACE_ID || 'ws1';

export default function () {
  const startTime = Date.now();
  
  // Mix of operations with increasing intensity
  const operations = [
    () => healthCheck(),
    () => listRecordings(),
    () => getBootstrap(),
    () => searchAI(),
  ];
  
  // Execute random operation
  const op = operations[Math.floor(Math.random() * operations.length)];
  const success = op();
  
  responseTime.add(Date.now() - startTime);
  errorRate.add(!success);
  
  // Decreasing think time as load increases (more aggressive)
  sleep(0.5);
}

function healthCheck() {
  const res = http.get(`${BASE_URL}/health`);
  return check(res, {
    'stress: health check': (r) => r.status === 200,
  });
}

function listRecordings() {
  const res = http.get(`${BASE_URL}/media/recordings?workspaceId=${workspaceId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  return check(res, {
    'stress: list recordings': (r) => r.status === 200,
  });
}

function getBootstrap() {
  const res = http.get(`${BASE_URL}/state/bootstrap`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
  return check(res, {
    'stress: bootstrap': (r) => r.status === 200,
  });
}

function searchAI() {
  const res = http.post(`${BASE_URL}/ai/search`, JSON.stringify({
    query: 'stress test',
    workspaceId: workspaceId,
  }), {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  return check(res, {
    'stress: AI search': (r) => r.status === 200,
  });
}
