# APM Integration Guide

## 🎯 Cel

Integracja Application Performance Monitoring (APM) dla monitorowania aplikacji w production.

---

## 📊 Dostępne rozwiązania

### 1. **DataDog APM** (Rekomendowane)

**Zalety:**
- Full-stack observability
- Real-time monitoring
- Automatic instrumentation
- Log aggregation
- Infrastructure monitoring
- Synthetic monitoring

**Koszty:**
- $15/host/month (APM)
- Darmowy tier: 1 host

---

### 2. **New Relic APM**

**Zalety:**
- Generous free tier (100GB/month)
- Easy setup
- Good Node.js support
- Built-in dashboards
- Alerting

**Koszty:**
- Free: 100GB/month
- Standard: $99/month
- Enterprise: Custom

---

### 3. **Open Source Alternatives**

#### Prometheus + Grafana
- Darmowe
- Self-hosted
- Wymaga więcej konfiguracji

#### Jaeger
- Distributed tracing
- Open source
- Good for microservices

---

## 🚀 DataDog Integration

### Instalacja

```bash
# Zainstaluj DataDog Agent (Docker)
docker run -d \
  --name datadog-agent \
  -e DD_API_KEY=<YOUR_API_KEY> \
  -e DD_SITE="datadoghq.com" \
  -e DD_APM_ENABLED=true \
  -e DD_APM_NON_LOCAL_TRAFFIC=true \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc/:/host/proc/:ro \
  -v /sys/fs/cgroup/:/host/sys/fs/cgroup:ro \
  datadog/agent:latest
```

### Node.js Instrumentation

```bash
# Zainstaluj DataDog tracer
pnpm add dd-trace
```

### Konfiguracja serwera

Stwórz plik `server/datadog.ts`:

```typescript
import tracer from 'dd-trace';

tracer.init({
  service: 'voicelog-server',
  env: process.env.NODE_ENV || 'development',
  version: process.env.npm_package_version || '0.1.0',
  logInjection: true,
  runtimeMetrics: true,
  profiling: true,
  // Sampling rate
  samplingRules: [
    { service: 'voicelog-server', sampleRate: 1.0 }
  ],
  // DataDog Agent URL
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: parseInt(process.env.DD_TRACE_AGENT_PORT || '8126', 10),
});

// Express/Hono instrumentation
tracer.use('hono');
tracer.use('http', {
  enabled: true,
  service: 'voicelog-http',
});

// Database instrumentation
tracer.use('pg', {
  service: 'voicelog-db',
});

export default tracer;
```

### Integracja z serwerem

```typescript
// server/index.ts
import './datadog'; // Import na samym początku!

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
// ... reszta importów

const app = new Hono();

// Middleware do trackowania błędów
app.use('*', async (c, next) => {
  const span = tracer.scope().active();
  
  try {
    await next();
    
    // Track response
    if (span) {
      span.setTag('http.status', c.res.status);
    }
  } catch (error) {
    // Track error
    if (span) {
      span.setTag('error', error);
    }
    throw error;
  }
});

// ... reszta aplikacji
```

### Environment Variables

```bash
# .env
DD_API_KEY=your_api_key_here
DD_SITE=datadoghq.com
DD_SERVICE=voicelog-server
DD_ENV=production
DD_VERSION=0.1.0
DD_AGENT_HOST=localhost
DD_TRACE_AGENT_PORT=8126
DD_LOGS_INJECTION=true
DD_APM_ENABLED=true
```

---

## 🚀 New Relic Integration

### Instalacja

```bash
pnpm add newrelic
```

### Konfiguracja

Stwórz plik `newrelic.js` w root:

```javascript
'use strict';

exports.config = {
  app_name: ['voicelog-server'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  
  logging: {
    level: 'info',
    filepath: 'logs/newrelic_agent.log',
  },
  
  application_logging: {
    forwarding: {
      enabled: true,
    },
  },
  
  distributed_tracing: {
    enabled: true,
  },
  
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
  },
  
  error_collector: {
    enabled: true,
    ignore_status_codes: [404],
  },
  
  rules: {
    ignore: [
      /^\/health$/,
      /^\/ready$/,
    ],
  },
};
```

### Integracja z serwerem

```typescript
// server/index.ts
import 'newrelic'; // Import na samym początku!

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const app = new Hono();

// Custom instrumentation
import newrelic from 'newrelic';

app.use('*', async (c, next) => {
  const transaction = newrelic.getTransaction();
  
  if (transaction) {
    transaction.addCustomAttribute('workspaceId', c.get('workspaceId'));
  }
  
  await next();
});

// Track custom metrics
app.post('/api/meetings', async (c) => {
  // ... logic
  
  newrelic.incrementMetric('Custom/Meetings/Created', 1);
  newrelic.recordMetric('Custom/Meeting/ProcessingTime', duration);
  
  return c.json({ success: true });
});
```

### Environment Variables

```bash
# .env
NEW_RELIC_LICENSE_KEY=your_license_key
NEW_RELIC_APP_NAME=voicelog-server
NEW_RELIC_ENVIRONMENT=production
NEW_RELIC_LOG=logs
NEW_RELIC_LOG_LEVEL=info
```

---

## 📊 Metryki do monitorowania

### Application Metrics

| Metryka | Opis | Alert Threshold |
|---------|------|-----------------|
| Response Time | Średni czas odpowiedzi | > 500ms |
| Error Rate | % błędnych żądań | > 1% |
| Throughput | Żądania na sekundę | Nagłe spadki |
| Apdex Score | Satisfaction score | < 0.7 |

### System Metrics

| Metryka | Opis | Alert Threshold |
|---------|------|-----------------|
| CPU Usage | Użycie procesora | > 80% |
| Memory Usage | Użycie pamięci RAM | > 85% |
| Disk I/O | Operacje dyskowe | > 90% |
| Network I/O | Ruch sieciowy | Nagłe skoki |

### Business Metrics

| Metryka | Opis |
|---------|------|
| Meetings Created | Liczba utworzonych spotkań |
| Recordings Processed | Przetworzone nagrania |
| Active Users | Aktywni użytkownicy |
| API Calls by Endpoint | Użycie poszczególnych endpointów |

---

## 🔔 Alerty

### DataDog Alert Conditions

```typescript
// Przykładowe alerty w DataDog:

// 1. High Error Rate
// Query: sum:http.request.errors{service:voicelog-server}.as_rate()
// Threshold: > 0.05 (5%)
// Notify: #slack-alerts

// 2. High Response Time
// Query: avg:http.request.duration{service:voicelog-server}
// Threshold: > 500ms
// Notify: #slack-alerts

// 3. Memory Leak Detection
// Query: avg:process.runtime.nodejs.memory.heap_used
// Threshold: > 500MB AND increasing over 1h
// Notify: #slack-alerts, @on-call

// 4. Service Down
// Query: sum:http.request.total{service:voicelog-server}
// Threshold: = 0 for 2m
// Notify: #slack-alerts, @on-call, pagerduty
```

### New Relic Alert Conditions

```json
{
  "name": "High Error Rate",
  "type": "NRQL",
  "query": "SELECT percentage(count(*), WHERE error IS NOT NULL) FROM Transaction WHERE appName = 'voicelog-server'",
  "condition": "ABOVE 5 FOR 5 MINUTES",
  "channels": ["slack-alerts", "email-team"]
}
```

---

## 📈 Dashboards

### DataDog Dashboard

Stwórz dashboard z następującymi widgetami:

1. **Timeseries**: Request rate, error rate, response time
2. **Query Value**: Current error rate, avg response time
3. **Top List**: Slowest endpoints
4. **Heatmap**: Response time distribution
5. **Log Stream**: Recent errors
6. **Service Map**: Service dependencies

### New Relic Dashboard

```json
{
  "dashboard": {
    "name": "Voicelog Server Overview",
    "widgets": [
      {
        "title": "Throughput",
        "type": "line",
        "query": "SELECT rate(count(*), 1 second) FROM Transaction"
      },
      {
        "title": "Error Rate",
        "type": "line",
        "query": "SELECT percentage(count(*), WHERE error IS NOT NULL) FROM Transaction"
      },
      {
        "title": "Response Time",
        "type": "line",
        "query": "SELECT average(duration) FROM Transaction"
      },
      {
        "title": "Slowest Endpoints",
        "type": "table",
        "query": "SELECT average(duration), count(*) FROM Transaction FACET name ORDER BY average(duration) DESC LIMIT 10"
      }
    ]
  }
}
```

---

## 🔍 Distributed Tracing

### Trace Structure

```
HTTP Request: POST /api/meetings
├─ Middleware: CORS
├─ Middleware: Authentication
├─ Middleware: Validation
├─ Handler: createMeeting
│  ├─ Query: INSERT INTO meetings
│  ├─ Service: processRecording
│  │  └─ External: Speech-to-Text API
│  └─ Query: INSERT INTO recordings
└─ Response: 201 Created
```

### Custom Spans

```typescript
import tracer from 'dd-trace';

async function processRecording(recording: Recording) {
  const span = tracer.startSpan('process.recording');
  
  try {
    return tracer.scope().activate(span, async () => {
      // Step 1: Transcribe
      const transcriptionSpan = tracer.startSpan('transcribe.audio');
      const transcript = await transcribe(recording.audioUrl);
      transcriptionSpan.finish();
      
      // Step 2: Analyze
      const analysisSpan = tracer.startSpan('analyze.sentiment');
      const sentiment = await analyzeSentiment(transcript);
      analysisSpan.finish();
      
      // Step 3: Store
      const storeSpan = tracer.startSpan('store.results');
      await storeResults(transcript, sentiment);
      storeSpan.finish();
      
      return { transcript, sentiment };
    });
  } catch (error) {
    span.setTag('error', error);
    throw error;
  } finally {
    span.finish();
  }
}
```

---

## 🧪 Testing

### Local Testing

```bash
# Test z DataDog (bez wysyłania danych)
DD_API_KEY=test DD_TRACE_AGENT_PORT=8126 pnpm start:server

# Test z New Relic (developer mode)
NEW_RELIC_DEVELOPER_MODE=true pnpm start:server
```

### Load Testing

```bash
# Zainstaluj k6
brew install k6

# Skrypt testowy: load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '5m',
};

export default function () {
  const res = http.get('http://localhost:3000/api/meetings');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}

# Uruchom test
k6 run load-test.js
```

---

## 🔐 Security

### Best Practices

1. **Nigdy nie commituj kluczy API**
   ```bash
   # Dodaj do .gitignore
   .env
   newrelic.js
   ```

2. **Używaj secrets manager**
   ```bash
   # AWS Secrets Manager
   DD_API_KEY=$(aws secretsmanager get-secret-value --secret-id datadog/api-key --query SecretString --output text)
   ```

3. **Ogranicz dane w trace**
   ```typescript
   // Nie loguj wrażliwych danych
   span.setTag('user.email', sanitize(email)); // Nie raw email
   ```

4. **Sampling w production**
   ```typescript
   // Mniejszy sampling dla wysokich ruchów
   samplingRules: [
     { service: 'voicelog-server', sampleRate: 0.1 } // 10%
   ]
   ```

---

## 📋 Deployment Checklist

### DataDog

- [ ] DD_API_KEY skonfigurowany
- [ ] Agent uruchomiony (Docker/VM)
- [ ] dd-trace zainstalowany
- [ ] Import na początku aplikacji
- [ ] Environment variables ustawione
- [ ] Alerty skonfigurowane
- [ ] Dashboard stworzony
- [ ] Test load wykonany

### New Relic

- [ ] NEW_RELIC_LICENSE_KEY skonfigurowany
- [ ] newrelic.js skonfigurowany
- [ ] Import na początku aplikacji
- [ ] Environment variables ustawione
- [ ] Alerty skonfigurowane
- [ ] Dashboard stworzony
- [ ] Test load wykonany

---

## 🔗 Przydatne linki

- [DataDog Node.js Tracer](https://docs.datadoghq.com/tracing/trace_collection/dd_libraries/nodejs/)
- [New Relic Node.js Agent](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [OpenTelemetry](https://opentelemetry.io/)
- [Clinic.js Profiling](https://clinicjs.org/)

---

## 💰 Cost Optimization

### DataDog

1. **Sampling**: Używaj sampling dla wysokich ruchów
2. **Custom Metrics**: Limit do 50 custom metrics
3. **Log Retention**: Skróć retention dla dev środowisk
4. **Host Deduplication**: Upewnij się, że nie płacisz za martwe hosty

### New Relic

1. **Data Ingest**: Monitoruj zużycie GB
2. **Retention**: Dostosuj retention do potrzeb
3. **Users**: Limituj liczbę full users
4. **NRQL Queries**: Optymalizuj drogie zapytania

---

## 📊 Przykładowy Dashboard JSON (DataDog)

```json
{
  "title": "Voicelog Server Production",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "title": "Request Rate & Error Rate",
        "requests": [
          {
            "q": "sum:http.request.total{service:voicelog-server}.as_rate()",
            "display_type": "line"
          },
          {
            "q": "sum:http.request.errors{service:voicelog-server}.as_rate()",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "title": "Response Time (p50, p95, p99)",
        "requests": [
          {
            "q": "avg:http.request.duration{service:voicelog-server}.rollup(avg, 60)"
          }
        ]
      }
    }
  ],
  "layout_type": "ordered",
  "is_read_only": false
}
```
