const SENSITIVE_QUERY_NAME_PATTERN =
  /(^|[-_.])(token|secret|password|passcode|credential|signature|authorization|apikey|api_key|api-key|key)([-_.]|$)/i;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

export function isSensitiveQueryParamName(name: string) {
  const normalized = safeDecode(String(name || '')).trim();
  if (!normalized) return false;
  const lower = normalized.toLowerCase();
  return (
    lower.includes('token') || lower.includes('secret') || SENSITIVE_QUERY_NAME_PATTERN.test(lower)
  );
}

function redactQueryString(query: string) {
  return query
    .split('&')
    .map((part) => {
      if (!part) return part;
      const separatorIndex = part.indexOf('=');
      const rawName = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
      if (!isSensitiveQueryParamName(rawName)) return part;
      return separatorIndex >= 0 ? `${rawName}=redacted` : `${rawName}=redacted`;
    })
    .join('&');
}

export function redactSensitiveRequestUrl(input: string) {
  const value = String(input || '');
  if (!value.includes('?')) return value;

  const hashIndex = value.indexOf('#');
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex < 0) return value;

  const prefix = withoutHash.slice(0, queryIndex);
  const query = withoutHash.slice(queryIndex + 1);
  return `${prefix}?${redactQueryString(query)}${hash}`;
}
