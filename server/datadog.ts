import tracer from 'dd-trace';

/**
 * DataDog APM Configuration
 *
 * Usage:
 * 1. Set DD_API_KEY environment variable
 * 2. Import this file at the very beginning of your application
 * 3. Run with: DD_API_KEY=your_key node dist-server/index.js
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Only initialize in production or when explicitly enabled
if (isProduction || process.env.DD_APM_ENABLED === 'true') {
  tracer.init({
    // Service identification
    service: process.env.DD_SERVICE || 'voicelog-server',
    env: process.env.DD_ENV || process.env.NODE_ENV || 'production',
    version: process.env.npm_package_version || '0.1.0',

    // Agent configuration
    hostname: process.env.DD_AGENT_HOST || 'localhost',
    port: parseInt(process.env.DD_TRACE_AGENT_PORT || '8126', 10),

    // Logging
    logInjection: process.env.DD_LOGS_INJECTION === 'true',

    // Runtime metrics
    runtimeMetrics: true,

    // Profiling (production only)
    profiling: isProduction,

    // Sampling - reduce in high traffic
    samplingRules: [
      {
        service: process.env.DD_SERVICE || 'voicelog-server',
        sampleRate: isProduction ? 0.1 : 1.0,
      },
    ],

    // Health endpoint - don't trace
    // @ts-ignore
    blocklist: ['/health', '/ready', '/metrics'],

    // Enable debug in development
    debug: isDevelopment,
  });

  // Instrument HTTP client
  tracer.use('http', {
    enabled: true,
    service: 'voicelog-http-client',
    blocklist: [
      // Don't trace calls to DataDog agent
      '/_health',
    ],
  });

  // Instrument PostgreSQL (if used)
  tracer.use('pg', {
    service: 'voicelog-db',
    // @ts-ignore
    queryTextEnabled: false, // Don't log full queries for security
  });

  // Instrument Hono framework
  tracer.use('hono', {
    service: 'voicelog-server',
  });

  console.log('[DataDog] APM initialized successfully');
} else {
  console.log('[DataDog] APM disabled (set DD_APM_ENABLED=true or NODE_ENV=production)');
}

export default tracer;
