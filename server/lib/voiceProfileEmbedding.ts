export type VoiceProfileEmbeddingFailure = Error & {
  code: 'embedding_failed';
  stage: 'embedding';
  statusCode: 503;
  cause?: unknown;
};

export function normalizeVoiceProfileEmbedding(value: unknown): number[] {
  const values = Array.isArray(value)
    ? value
    : ArrayBuffer.isView(value)
      ? Array.from(value as unknown as ArrayLike<number>)
      : [];

  return values.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

export function createVoiceProfileEmbeddingFailure(cause?: unknown): VoiceProfileEmbeddingFailure {
  const error = new Error(
    'Nie udalo sie utworzyc profilu glosu. Sprobuj ponownie za chwile.'
  ) as VoiceProfileEmbeddingFailure;
  error.code = 'embedding_failed';
  error.stage = 'embedding';
  error.statusCode = 503;
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function requireVoiceProfileEmbedding(value: unknown): number[] {
  const embedding = normalizeVoiceProfileEmbedding(value);
  if (!embedding.length) {
    throw createVoiceProfileEmbeddingFailure(
      new Error('Embedding provider returned empty vector.')
    );
  }
  return embedding;
}
