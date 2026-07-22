import type { ConsoleMessage, Page, Response } from '@playwright/test';

export type RuntimeGuardRule = RegExp | string;

export interface RuntimeGuardOptions {
  allowedConsoleErrors?: RuntimeGuardRule[];
  allowedServerErrors?: RuntimeGuardRule[];
}

export interface RuntimeGuard {
  assertHealthy(): void;
  recordConsoleError(message: string): void;
  recordPageError(error: unknown): void;
  recordResponse(status: number, url: string): void;
  violations(): string[];
}

function matchesRule(value: string, rules: RuntimeGuardRule[]) {
  return rules.some((rule) => {
    if (typeof rule === 'string') {
      return value.includes(rule);
    }

    rule.lastIndex = 0;
    return rule.test(value);
  });
}

function sanitizeRuntimeText(value: unknown) {
  return String(value || '')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/((?:token|password|cookie|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]');
}

function sanitizeUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return String(value || '').split('?')[0];
  }
}

export function createRuntimeGuard(options: RuntimeGuardOptions = {}): RuntimeGuard {
  const allowedConsoleErrors = options.allowedConsoleErrors || [];
  const allowedServerErrors = options.allowedServerErrors || [];
  const unexpectedFailures: string[] = [];

  const addFailure = (kind: string, value: unknown, rules: RuntimeGuardRule[] = []) => {
    const sanitized = sanitizeRuntimeText(value);
    if (matchesRule(sanitized, rules)) {
      return;
    }
    unexpectedFailures.push(`${kind}: ${sanitized}`);
  };

  return {
    recordPageError(error) {
      const message =
        error instanceof Error ? error.message : String(error || 'Unknown page error');
      addFailure('pageerror', message);
    },
    recordConsoleError(message) {
      addFailure('console.error', message, allowedConsoleErrors);
    },
    recordResponse(status, url) {
      if (Number(status) < 500) {
        return;
      }
      const sanitizedUrl = sanitizeUrl(url);
      addFailure(`HTTP ${status}`, sanitizedUrl, allowedServerErrors);
    },
    assertHealthy() {
      if (unexpectedFailures.length === 0) {
        return;
      }

      throw new Error(
        `Unexpected browser runtime failures:\n${unexpectedFailures.map((failure) => `- ${failure}`).join('\n')}`
      );
    },
    violations() {
      return [...unexpectedFailures];
    },
  };
}

export function installRuntimeGuard(page: Page, options: RuntimeGuardOptions = {}) {
  const guard = createRuntimeGuard(options);
  const onPageError = (error: Error) => guard.recordPageError(error);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      guard.recordConsoleError(message.text());
    }
  };
  const onResponse = (response: Response) =>
    guard.recordResponse(response.status(), response.url());

  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  page.on('response', onResponse);

  return {
    ...guard,
    dispose() {
      page.off('pageerror', onPageError);
      page.off('console', onConsole);
      page.off('response', onResponse);
    },
  };
}
