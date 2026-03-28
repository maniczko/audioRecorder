/**
 * New Relic APM Configuration
 *
 * Usage:
 * 1. Set NEW_RELIC_LICENSE_KEY environment variable
 * 2. Import this file at the very beginning of your application
 * 3. Run with: NEW_RELIC_LICENSE_KEY=your_key node dist-server/index.js
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

exports.config = {
  // Application identification
  app_name: [process.env.NEW_RELIC_APP_NAME || 'voicelog-server'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,

  // Logging configuration
  logging: {
    level: isDevelopment ? 'debug' : 'info',
    filepath: 'logs/newrelic_agent.log',
  },

  // Application logging
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: isProduction,
      max_samples_stored: 10000,
    },
    metrics: {
      enabled: true,
    },
    local_decorating: {
      enabled: false,
    },
  },

  // Distributed tracing
  distributed_tracing: {
    enabled: true,
  },

  // Transaction tracer
  transaction_tracer: {
    enabled: true,
    transaction_threshold: 'apdex_f',
    record_sql: 'obfuscated', // Security: don't log raw SQL
    stack_trace_threshold: 500, // ms
  },

  // Error collector
  error_collector: {
    enabled: true,
    ignore_status_codes: [404, 400], // Don't track client errors
    ignore_classes: ['ValidationError', 'NotFoundError'],
  },

  // Browser monitoring
  browser_monitoring: {
    enabled: false, // Disable for API server
  },

  // Custom attributes
  attributes: {
    enabled: true,
    include: ['http.statusCode', 'http.method', 'request.uri'],
  },

  // Rules for ignoring certain paths
  rules: {
    ignore: [/^\/health$/, /^\/ready$/, /^\/metrics$/],
  },

  // Slow SQL queries
  slow_sql: {
    enabled: true,
    max_samples: 10,
  },

  // Custom insights
  custom_insights_events: {
    enabled: true,
    max_samples: 1000,
  },

  // Span events
  span_events: {
    enabled: true,
  },

  // Infinite tracing (for high volume)
  infinite_tracing: {
    trace_observer: {
      host: '', // Set for infinite tracing
      port: 443,
    },
  },

  // Labels for filtering
  labels: {
    environment: process.env.NODE_ENV || 'production',
    service: 'voicelog-server',
  },
};
