import type { Context } from 'hono';
import type { ZodIssue, ZodSchema } from 'zod';

type ValidationTarget = 'body' | 'query' | 'headers';

function normalizePath(issue: ZodIssue, target: ValidationTarget) {
  return issue.path.length ? issue.path.map(String).join('.') : target;
}

export function validationErrorPayload(issues: ZodIssue[], target: ValidationTarget = 'body') {
  return {
    code: 'validation_failed',
    message: 'Nieprawidlowy payload zadania.',
    stage: 'validation',
    details: issues.map((issue) => ({
      path: normalizePath(issue, target),
      code: issue.code,
      message: issue.message,
    })),
  };
}

export function validationFailure(
  c: Context,
  issues: ZodIssue[],
  target: ValidationTarget = 'body'
) {
  return c.json(validationErrorPayload(issues, target), 422);
}

export function validatePayload<T>(
  c: Context,
  schema: ZodSchema<T>,
  payload: unknown,
  target: ValidationTarget = 'body'
): { ok: true; data: T } | { ok: false; response: Response } {
  const result = schema.safeParse(payload);
  if (!result.success) {
    return { ok: false, response: validationFailure(c, result.error.issues, target) };
  }
  return { ok: true, data: result.data };
}

export async function validateJsonBody<T>(
  c: Context,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  const body = await c.req.json().catch(() => ({}));
  return validatePayload(c, schema, body, 'body');
}
