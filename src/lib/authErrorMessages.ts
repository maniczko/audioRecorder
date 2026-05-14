import { isTransportErrorMessage } from './transportErrors';

export const AUTH_INFRASTRUCTURE_ERROR_MESSAGE =
  'Logowanie jest chwilowo niedostępne. Spróbuj ponownie za chwilę.';

export function normalizeAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (isTransportErrorMessage(message)) {
    return AUTH_INFRASTRUCTURE_ERROR_MESSAGE;
  }

  return message;
}
