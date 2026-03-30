# Load Testing Guide — VoiceLog OS

## Overview

VoiceLog OS uses **k6** for load testing to ensure the application can handle production traffic patterns and identify performance bottlenecks before they affect users.

## Installation

### Windows (PowerShell)
```powershell
choco install k6
```

### macOS (Homebrew)
```bash
brew install k6
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get install k6
```

### Docker
```bash
docker run --rm -v "${PWD}:/scripts" grafana/k6 run /scripts/tests/load/api-load-test.js
```

## Test Scenarios

### 1. Standard Load Test
**Purpose:** Validate performance under normal and peak traffic conditions.

```bash
k6 run tests/load/api-load-test.js
```

**Configuration:**
- **Normal Load:** 10 VUs for 3 minutes
- **Peak Load:** 50 VUs for 5 minutes
- **Duration:** ~15 minutes total

**Success Criteria:**
- Error rate < 1%
- p95 response time < 1.5s
- p99 response time < 3s

### 2. Stress Test
**Purpose:** Find the breaking point of the system.

```bash
k6 run tests/load/api-stress-test.js
```

**Configuration:**
- Ramp from 0 to 500 VUs over 20 minutes
- Sustains peak load for 10 minutes
- Tests system recovery

**Success Criteria:**
- System recovers after load removal
- No data corruption
- Error rate < 15% under extreme load

### 3. Soak Test (Endurance)
**Purpose:** Detect memory leaks and performance degradation over time.

```bash
k6 run --duration 1h tests/load/api-load-test.js
```

**Configuration:**
- Constant load (20-30 VUs) for 1+ hour
- Monitors memory usage and response times

**Success Criteria:**
- No memory leaks
- Response times remain stable
- No increase in error rate over time

### 4. Spike Test
**Purpose:** Test system behavior under sudden traffic spikes.

```bash
k6 run tests/load/api-spike-test.js
```

**Configuration:**
- Sudden jump from 10 to 100 VUs
- Tests auto-scaling response

**Success Criteria:**
- System handles spike without crashing
- Recovers to normal operation quickly

## Performance Budgets

| Endpoint | p50 | p90 | p95 | p99 | Error Rate |
|----------|-----|-----|-----|-----|------------|
| `/health` | 50ms | 100ms | 150ms | 200ms | < 0.1% |
| `/auth/*` | 100ms | 200ms | 300ms | 500ms | < 1% |
| `/media/*` | 200ms | 500ms | 800ms | 1200ms | < 2% |
| `/state/*` | 150ms | 400ms | 600ms | 1000ms | < 1% |
| `/ai/*` | 800ms | 1500ms | 2000ms | 3000ms | < 5% |

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install k6
        run: |
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Start test server
        run: pnpm start:server &
        env:
          NODE_ENV: test
          VOICELOG_API_PORT: 4000
      
      - name: Wait for server
        run: sleep 10
      
      - name: Run load tests
        run: k6 run tests/load/api-load-test.js
        env:
          BASE_URL: http://localhost:4000
      
      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: reports/load-test-*.json
```

## Local Development Server

Before running load tests, start the server in production mode:

```bash
# Set environment
export NODE_ENV=production
export VOICELOG_API_PORT=4000

# Start server
pnpm start:server
```

## Interpreting Results

### Key Metrics

1. **HTTP Request Duration**
   - `p(50)`: Median response time (typical user experience)
   - `p(90)`: 90th percentile (most users)
   - `p(95)`: 95th percentile (SLA target)
   - `p(99)`: 99th percentile (worst cases)

2. **Error Rate**
   - `http_req_failed`: Percentage of failed requests
   - Target: < 1% for normal load

3. **Throughput**
   - `iterations`: Total completed test iterations
   - `http_reqs`: Total HTTP requests per second

4. **Virtual Users (VUs)**
   - `vus`: Current number of active users
   - `vus_max`: Maximum concurrent users

### Grafana Dashboard (Optional)

For real-time monitoring:

```bash
# Start InfluxDB
docker run -d -p 8086:8086 influxdb:1.8

# Run k6 with InfluxDB output
k6 run --out influxdb=http://localhost:8086/k6 tests/load/api-load-test.js

# Start Grafana
docker run -d -p 3000:3000 grafana/grafana
```

Configure Grafana:
1. Add InfluxDB data source (http://localhost:8086, database: k6)
2. Import k6 dashboard (ID: 2587)

## Troubleshooting

### High Error Rates

1. **Check server logs** for specific errors
2. **Reduce load** to identify threshold
3. **Monitor resources** (CPU, memory, disk I/O)

### Slow Response Times

1. **Profile the application** (0x, clinic.js)
2. **Check database queries** (slow query log)
3. **Monitor external API calls** (OpenAI, Anthropic)

### Connection Refused

1. **Verify server is running**: `curl http://localhost:4000/health`
2. **Check port configuration**: `echo $VOICELOG_API_PORT`
3. **Increase file descriptor limit**: `ulimit -n 65536`

## Best Practices

1. **Run load tests in isolated environment** (not production)
2. **Use realistic test data** (anonymized production data)
3. **Monitor system resources** during tests
4. **Document baseline metrics** for comparison
5. **Run tests regularly** (daily/weekly)
6. **Automate in CI/CD** for regression detection

## Related Documentation

- [Performance Regression Tests](../../server/tests/performance/README.md)
- [APM Integration](../../APM_INTEGRATION.md)
- [Production Deployment Guide](../../DEPLOYMENT.md)

## Support

For issues or questions:
- Check k6 documentation: https://k6.io/docs/
- Review test scripts: `tests/load/*.js`
- Contact: Performance Team (performance@voicelog.local)
