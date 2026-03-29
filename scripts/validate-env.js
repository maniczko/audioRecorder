#!/usr/bin/env node
/**
 * VoiceLog OS - API Configuration Validator
 *
 * Skrypt sprawdza poprawność konfiguracji API w pliku .env
 * Uruchomienie: node scripts/validate-env.js
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load .env file
try {
  config({ path: join(rootDir, '.env') });
} catch (error) {
  console.error('❌ Błąd ładowania pliku .env:', error.message);
  process.exit(1);
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkVariable(name, description, pattern = null) {
  const value = process.env[name];

  if (!value) {
    log(colors.red, `❌ ${name}: BRAK (${description})`);
    return false;
  }

  if (pattern && !pattern.test(value)) {
    log(colors.red, `❌ ${name}: NIEPRAWIDŁOWY FORMAT (${description})`);
    log(colors.yellow, `   Wartość: ${value.substring(0, 20)}...`);
    return false;
  }

  // Check for placeholder patterns
  if (value.includes('xxxx') || value.includes('TWOJ_') || value.includes('PLACEHOLDER')) {
    log(colors.yellow, `⚠️  ${name}: PLACEHOLDER (${description})`);
    log(colors.yellow, `   Wartość: ${value}`);
    return false;
  }

  log(colors.green, `✅ ${name}: OK (${description})`);
  return true;
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
      log(colors.green, `✅ ${name}: POŁĄCZENIE UDANE`);
      return true;
    } else {
      log(colors.yellow, `⚠️  ${name}: STATUS ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      log(colors.red, `❌ ${name}: TIMEOUT (5s)`);
    } else {
      log(colors.red, `❌ ${name}: BŁĄD POŁĄCZENIA`);
      log(colors.yellow, `   ${error.message}`);
    }
    return false;
  }
}

async function validateOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('xxxx') || apiKey.includes('TWOJ_')) return false;

  return await testAPI('OpenAI API', 'https://api.openai.com/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });
}

async function validateGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.includes('xxxx') || apiKey.includes('TWOJ_')) return false;

  return await testAPI('Groq API', 'https://api.groq.com/openai/v1/models', {
    Authorization: `Bearer ${apiKey}`,
  });
}

async function validateSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url.includes('TWOJ_') || key.includes('TWOJ_')) return false;

  return await testAPI('Supabase API', `${url}/rest/v1/`, {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: 'count=exact',
  });
}

async function validateLangSmith() {
  const apiKey = process.env.LANGCHAIN_API_KEY;
  if (!apiKey || apiKey.includes('xxxx') || apiKey.includes('TWOJ_')) return false;

  return await testAPI('LangSmith API', 'https://api.smith.langchain.com/api/v1/info', {
    'x-api-key': apiKey,
  });
}

async function main() {
  log(colors.cyan, '╔════════════════════════════════════════════════╗');
  log(colors.cyan, '║   VoiceLog OS - API Configuration Validator    ║');
  log(colors.cyan, '╚════════════════════════════════════════════════╝');
  log(colors.reset, '');

  let allValid = true;

  // ─────────────────────────────────────────────────────────────
  // FRONTEND
  // ─────────────────────────────────────────────────────────────
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ FRONTEND (Vite)                                │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  allValid &= checkVariable('VITE_DATA_PROVIDER', 'Provider danych', /^(local|remote)$/);
  allValid &= checkVariable('VITE_MEDIA_PROVIDER', 'Provider mediów', /^(local|remote)$/);
  allValid &= checkVariable('VITE_API_BASE_URL', 'Backend API URL', /^https?:\/\//);
  allValid &= checkVariable(
    'VITE_GOOGLE_CLIENT_ID',
    'Google OAuth Client ID',
    /\.apps\.googleusercontent\.com$/
  );
  log(colors.reset, '');

  // ─────────────────────────────────────────────────────────────
  // BACKEND
  // ─────────────────────────────────────────────────────────────
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ BACKEND (Server)                               │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  allValid &= checkVariable('VOICELOG_API_PORT', 'Port API', /^\d+$/);
  allValid &= checkVariable('DATABASE_URL', 'Database URL', /^postgresql:\/\/.*@.*\.supabase\.com/);
  allValid &= checkVariable('SUPABASE_URL', 'Supabase URL', /^https:\/\/.*\.supabase\.co$/);
  allValid &= checkVariable(
    'SUPABASE_SERVICE_ROLE_KEY',
    'Supabase Service Role',
    /^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/
  );
  log(colors.reset, '');

  // ─────────────────────────────────────────────────────────────
  // AI/ML API KEYS
  // ─────────────────────────────────────────────────────────────
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ AI/ML API Keys                                 │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  allValid &= checkVariable('OPENAI_API_KEY', 'OpenAI API Key', /^sk-proj-/);
  allValid &= checkVariable('GROQ_API_KEY', 'Groq API Key', /^gsk_/);
  allValid &= checkVariable('ANTHROPIC_API_KEY', 'Anthropic API Key', /^sk-ant-api/);
  allValid &= checkVariable('GEMINI_API_KEY', 'Google Gemini API Key', /^AIzaSy/);
  allValid &= checkVariable('HF_TOKEN', 'HuggingFace Token', /^hf_/);
  log(colors.reset, '');

  // ─────────────────────────────────────────────────────────────
  // INTEGRATIONS
  // ─────────────────────────────────────────────────────────────
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ Integrations                                   │');
  log(colors.blue, '└────────────────────────────────────────────────┘');

  allValid &= checkVariable('LANGCHAIN_API_KEY', 'LangSmith API Key', /^lsv2_pt_/);
  allValid &= checkVariable('GITHUB_TOKEN', 'GitHub Token', /^github_pat_/);
  log(colors.reset, '');

  // ─────────────────────────────────────────────────────────────
  // API CONNECTION TESTS
  // ─────────────────────────────────────────────────────────────
  log(colors.blue, '┌────────────────────────────────────────────────┐');
  log(colors.blue, '│ API Connection Tests                           │');
  log(colors.blue, '└────────────────────────────────────────────────┘');
  log(colors.yellow, '⏳ Testowanie połączeń z API (może potrwać kilka sekund)...');
  log(colors.reset, '');

  await validateOpenAI();
  await validateGroq();
  await validateSupabase();
  await validateLangSmith();
  log(colors.reset, '');

  // ─────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────
  log(colors.cyan, '┌────────────────────────────────────────────────┐');
  log(colors.cyan, '│ Podsumowanie                                   │');
  log(colors.cyan, '└────────────────────────────────────────────────┘');

  if (allValid) {
    log(colors.green, '✅ Wszystkie zmienne środowiskowe są poprawnie skonfigurowane!');
  } else {
    log(colors.yellow, '⚠️  Niektóre zmienne wymagają uwagi.');
    log(colors.reset, '');
    log(colors.blue, '📖 Instrukcja konfiguracji:');
    log(colors.reset, '   1. Skopiuj .env.example do .env');
    log(colors.reset, '   2. Uzupełnij brakujące klucze API');
    log(colors.reset, '   3. Uruchom ponownie walidator');
    log(colors.reset, '');
    log(colors.cyan, '🔗 Linki do uzyskania kluczy:');
    log(colors.reset, '   • OpenAI: https://platform.openai.com/api-keys');
    log(colors.reset, '   • Groq: https://console.groq.com/keys');
    log(colors.reset, '   • Anthropic: https://console.anthropic.com/settings/keys');
    log(colors.reset, '   • Google Gemini: https://makersuite.google.com/app/apikey');
    log(colors.reset, '   • HuggingFace: https://huggingface.co/settings/tokens');
    log(colors.reset, '   • Supabase: https://supabase.com/dashboard/project/TWOJ_ID/settings/api');
    log(colors.reset, '   • LangSmith: https://smith.langchain.com/settings');
    log(colors.reset, '   • GitHub: https://github.com/settings/tokens');
  }

  log(colors.reset, '');
  process.exit(allValid ? 0 : 1);
}

main().catch(console.error);
