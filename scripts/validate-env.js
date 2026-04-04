#!/usr/bin/env node
/**
 * VoiceLog OS - API Configuration Validator
 *
 * Run: node scripts/validate-env.js
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

try {
  config({ path: path.join(rootDir, '.env') });
} catch (error) {
  console.error('Failed to load .env:', error.message);
  process.exit(1);
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const STATUS_OK = 'ok';
const STATUS_MISSING = 'missing';
const STATUS_INVALID = 'invalid';

const OPENAI_KEY_PATTERN = /^sk-/;
const GROQ_KEY_PATTERN = /^gsk_/;
const ANTHROPIC_KEY_PATTERN = /^sk-ant-/;
const GEMINI_KEY_PATTERN = /^AIza[0-9A-Za-z_-]+$/;
const HF_KEY_PATTERN = /^hf_/;
const LANGCHAIN_KEY_PATTERN = /^ls(v2)?_/;
const GITHUB_TOKEN_PATTERN = /^(github_pat_|gh[pousr]_|ghs_)/;

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function isPlaceholderValue(value) {
  if (!value) return false;
  return ['xxxx', 'TWOJ_', 'PLACEHOLDER'].some((token) => value.includes(token));
}

function evaluateVariable(name, description, value, pattern, severity = 'error') {
  if (!value) {
    return { name, description, severity, status: STATUS_MISSING };
  }

  if (isPlaceholderValue(value)) {
    return { name, description, severity, status: STATUS_INVALID, preview: value };
  }

  if (pattern && !pattern.test(value)) {
    return {
      name,
      description,
      severity,
      status: STATUS_INVALID,
      preview: `${value.slice(0, 20)}...`,
    };
  }

  return { name, description, severity, status: STATUS_OK };
}

function canUseLocalWhisper(env) {
  return env.USE_LOCAL_WHISPER === 'true' && Boolean(env.WHISPER_CPP_PATH);
}

export function validateEnvironmentSnapshot(env = process.env) {
  const checks = [];

  checks.push(
    evaluateVariable(
      'VITE_DATA_PROVIDER',
      'Provider danych',
      env.VITE_DATA_PROVIDER,
      /^(local|remote)$/
    )
  );
  checks.push(
    evaluateVariable(
      'VITE_MEDIA_PROVIDER',
      'Provider mediow',
      env.VITE_MEDIA_PROVIDER,
      /^(local|remote)$/
    )
  );
  checks.push(
    evaluateVariable('VITE_API_BASE_URL', 'Backend API URL', env.VITE_API_BASE_URL, /^https?:\/\//)
  );
  checks.push(evaluateVariable('VOICELOG_API_PORT', 'Port API', env.VOICELOG_API_PORT, /^\d+$/));

  checks.push(
    evaluateVariable(
      'VITE_GOOGLE_CLIENT_ID',
      'Google OAuth Client ID',
      env.VITE_GOOGLE_CLIENT_ID,
      /(\.apps\.googleusercontent\.com$|^demo$)/,
      'warning'
    )
  );

  const openAiCheck = evaluateVariable(
    'OPENAI_API_KEY',
    'OpenAI API Key',
    env.OPENAI_API_KEY,
    OPENAI_KEY_PATTERN,
    'warning'
  );
  const groqCheck = evaluateVariable(
    'GROQ_API_KEY',
    'Groq API Key',
    env.GROQ_API_KEY,
    GROQ_KEY_PATTERN,
    'warning'
  );

  checks.push(openAiCheck, groqCheck);

  if (
    openAiCheck.status !== STATUS_OK &&
    groqCheck.status !== STATUS_OK &&
    !canUseLocalWhisper(env)
  ) {
    checks.push({
      name: 'STT_PROVIDER',
      description: 'At least one speech-to-text provider or local Whisper',
      severity: 'error',
      status: STATUS_MISSING,
    });
  }

  checks.push(
    evaluateVariable(
      'DATABASE_URL',
      'Postgres database URL',
      env.DATABASE_URL || env.VOICELOG_DATABASE_URL,
      /^postgres(ql)?:\/\//,
      'warning'
    )
  );
  checks.push(
    evaluateVariable(
      'SUPABASE_URL',
      'Supabase URL',
      env.SUPABASE_URL,
      /^https:\/\/.*\.supabase\.co$/,
      'warning'
    )
  );
  checks.push(
    evaluateVariable(
      'SUPABASE_SERVICE_ROLE_KEY',
      'Supabase service role key',
      env.SUPABASE_SERVICE_ROLE_KEY,
      /^eyJ/,
      'warning'
    )
  );
  checks.push(
    evaluateVariable(
      'ANTHROPIC_API_KEY',
      'Anthropic API Key',
      env.ANTHROPIC_API_KEY,
      ANTHROPIC_KEY_PATTERN,
      'warning'
    )
  );
  checks.push(
    evaluateVariable(
      'GEMINI_API_KEY',
      'Google Gemini API Key',
      env.GEMINI_API_KEY,
      GEMINI_KEY_PATTERN,
      'warning'
    )
  );
  checks.push(
    evaluateVariable('HF_TOKEN', 'HuggingFace token', env.HF_TOKEN, HF_KEY_PATTERN, 'warning')
  );
  checks.push(
    evaluateVariable(
      'LANGCHAIN_API_KEY',
      'LangSmith API Key',
      env.LANGCHAIN_API_KEY || env.LANGSMITH_API_KEY,
      LANGCHAIN_KEY_PATTERN,
      'warning'
    )
  );
  checks.push(
    evaluateVariable(
      'GITHUB_TOKEN',
      'GitHub token',
      env.GITHUB_TOKEN,
      GITHUB_TOKEN_PATTERN,
      'warning'
    )
  );

  const errors = checks.filter((check) => check.severity === 'error' && check.status !== STATUS_OK);
  const warnings = checks.filter(
    (check) => check.severity === 'warning' && check.status !== STATUS_OK
  );

  return {
    checks,
    errors,
    warnings,
    blocking: errors.length > 0,
  };
}

function printCheck(check) {
  if (check.status === STATUS_OK) {
    log(colors.green, `OK ${check.name}: ${check.description}`);
    return;
  }

  const color = check.severity === 'error' ? colors.red : colors.yellow;
  const prefix = check.severity === 'error' ? 'ERROR' : 'WARN';
  const label = check.status === STATUS_INVALID ? 'INVALID' : 'MISSING';
  log(color, `${prefix} ${check.name}: ${label} (${check.description})`);
  if (check.preview) {
    log(colors.yellow, `   Value: ${check.preview}`);
  }
}

async function testAPI(name, url, headers = {}) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok || response.status === 401) {
      log(colors.green, `OK ${name}: connection works`);
      return true;
    }

    log(colors.yellow, `WARN ${name}: status ${response.status}`);
    return false;
  } catch (error) {
    const message = error.name === 'AbortError' ? 'timeout (5s)' : error.message;
    log(colors.yellow, `WARN ${name}: ${message}`);
    return false;
  }
}

function canCallExternalApi(value) {
  return Boolean(value) && !isPlaceholderValue(value) && !value.includes('dummy');
}

async function runConnectionChecks(env = process.env) {
  log(colors.blue, 'Connection checks');

  if (canCallExternalApi(env.OPENAI_API_KEY)) {
    await testAPI('OpenAI API', 'https://api.openai.com/v1/models', {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    });
  }

  if (canCallExternalApi(env.GROQ_API_KEY)) {
    await testAPI('Groq API', 'https://api.groq.com/openai/v1/models', {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    });
  }

  if (canCallExternalApi(env.SUPABASE_URL) && canCallExternalApi(env.SUPABASE_SERVICE_ROLE_KEY)) {
    await testAPI('Supabase API', `${env.SUPABASE_URL}/rest/v1/`, {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'count=exact',
    });
  }

  if (canCallExternalApi(env.LANGCHAIN_API_KEY || env.LANGSMITH_API_KEY)) {
    await testAPI('LangSmith API', 'https://api.smith.langchain.com/api/v1/info', {
      'x-api-key': env.LANGCHAIN_API_KEY || env.LANGSMITH_API_KEY,
    });
  }
}

async function main() {
  log(colors.cyan, 'VoiceLog OS - API Configuration Validator');
  log(colors.reset, '');

  const report = validateEnvironmentSnapshot(process.env);

  report.checks.forEach(printCheck);
  log(colors.reset, '');

  await runConnectionChecks(process.env);
  log(colors.reset, '');

  if (report.blocking) {
    log(colors.red, 'Validation failed due to blocking configuration errors.');
    process.exit(1);
  }

  if (report.warnings.length > 0) {
    log(colors.yellow, 'Validation finished with warnings.');
    process.exit(0);
  }

  log(colors.green, 'Validation succeeded.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
