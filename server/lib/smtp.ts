import type { Transporter } from 'nodemailer';

const DEFAULT_SMTP_PORT = 587;
const SMTP_CONFIG_KEYS = ['VOICELOG_SMTP_HOST', 'VOICELOG_SMTP_USER', 'VOICELOG_SMTP_PASS'];

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromAddress: string;
}

export interface SmtpMailer {
  sendMail: (message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) => Promise<{ messageId?: string }>;
}

function normalizeBoolean(value: unknown): boolean {
  return String(value || '').toLowerCase() === 'true';
}

export function parseSmtpPort(value: string | undefined): number {
  const candidate = Number(value);
  return Number.isFinite(candidate) && candidate > 0 ? Math.floor(candidate) : DEFAULT_SMTP_PORT;
}

export function resolveSmtpSettings(env: NodeJS.ProcessEnv = process.env): SmtpSettings | null {
  const host = String(env.VOICELOG_SMTP_HOST || '').trim();
  const user = String(env.VOICELOG_SMTP_USER || '').trim();
  const pass = String(env.VOICELOG_SMTP_PASS || '').trim();

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port: parseSmtpPort(String(env.VOICELOG_SMTP_PORT || '').trim()),
    user,
    pass,
    secure: normalizeBoolean(env.VOICELOG_SMTP_SECURE),
    fromAddress: String(env.VOICELOG_SMTP_FROM || user || 'no-reply@voicelog.local').trim(),
  };
}

export function isSmtpConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveSmtpSettings(env) !== null;
}

export function getMissingSmtpKeyMessage(env: NodeJS.ProcessEnv = process.env): string | null {
  const missing = SMTP_CONFIG_KEYS.filter((key) => !String(env[key] || '').trim());
  if (missing.length === 0) {
    return null;
  }
  return `Missing SMTP settings: ${missing.join(', ')}.`;
}

export async function createSmtpTransport(
  env: NodeJS.ProcessEnv = process.env
): Promise<SmtpMailer | null> {
  const settings = resolveSmtpSettings(env);
  if (!settings) {
    return null;
  }

  const { createTransport } = await import('nodemailer');
  return createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.pass,
    },
  }) as Transporter & SmtpMailer;
}

export function renderPasswordResetEmail({
  to,
  code,
  expiresAtIso,
}: {
  to: string;
  code: string;
  expiresAtIso: string;
}) {
  return {
    to,
    subject: 'Kod resetu hasła',
    text: `Cześć,\n\nTwój kod do resetu hasła to: ${code}\n\nKod wygasa: ${expiresAtIso}.\n\nJeśli to nie Ty, zignoruj tę wiadomość.\n`,
    html: `<p>Cześć,</p><p>Twój kod do resetu hasła to: <strong>${code}</strong></p><p>Kod wygasa: <strong>${expiresAtIso}</strong>.</p><p>Jeśli to nie Ty, zignoruj tę wiadomość.</p>`,
  };
}
