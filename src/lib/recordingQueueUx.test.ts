import { describe, expect, test, vi } from 'vitest';
import { getRecordingQueueStatusView, getRecordingStartView } from './recordingQueueUx';

describe('recordingQueueUx', () => {
  test.each([
    ['uploading', 'Wysyłanie...', 'Wysyłanie audio...', ['refresh']],
    ['queued', 'W kolejce', 'Nagranie czeka na przetwarzanie.', ['refresh', 'delete']],
    ['processing', 'Przetwarzanie...', 'Transkrypcja w toku...', ['refresh']],
    ['diarization', 'Rozpoznawanie mówców...', 'Rozpoznajemy mówców...', ['refresh']],
    [
      'review',
      'Oczekuje na weryfikację',
      'Nagranie czeka na krótką weryfikację.',
      ['refresh', 'export'],
    ],
    ['done', 'Transkrypcja gotowa', 'Nagranie jest gotowe.', ['export']],
    ['empty', 'Brak mowy', 'Nie wykryto wypowiedzi w nagraniu.', ['retry', 'reimport', 'delete']],
    [
      'no_audio',
      'Brak audio',
      'Plik nie zawiera użytecznej ścieżki audio.',
      ['reimport', 'delete'],
    ],
    [
      'failed_permanent',
      'Wymaga ponownego importu',
      'To nagranie wymaga ponownego importu.',
      ['reimport', 'delete', 'contact_admin'],
    ],
  ])('maps %s to clear copy and actions', (status, label, summary, actions) => {
    const view = getRecordingQueueStatusView({ status });

    expect(view.label).toBe(label);
    expect(view.summary).toBe(summary);
    expect(view.description.length).toBeGreaterThan(20);
    expect(view.actions).toEqual(actions);
  });

  test('marks active queue states as polite busy live regions', () => {
    for (const status of ['uploading', 'queued', 'processing', 'diarization']) {
      const view = getRecordingQueueStatusView({ status });
      expect(view.role).toBe('status');
      expect(view.live).toBe('polite');
      expect(view.busy).toBe(true);
    }
  });

  test('marks failed states as assertive alerts with recovery guidance', () => {
    const retryable = getRecordingQueueStatusView({
      status: 'failed',
      errorMessage: 'Upload failed',
    });
    const permanent = getRecordingQueueStatusView({
      status: 'failed_permanent',
      errorMessage: 'Audio nie jest dostepne na serwerze.',
    });

    expect(retryable).toMatchObject({
      role: 'alert',
      live: 'assertive',
      retryable: true,
      actions: ['retry', 'contact_admin'],
    });
    expect(permanent).toMatchObject({
      role: 'alert',
      live: 'assertive',
      retryable: false,
      actions: ['reimport', 'delete', 'contact_admin'],
    });
  });

  test('explains background processing after reload with queue position and elapsed age', () => {
    const queued = getRecordingQueueStatusView({ status: 'queued', queuedPosition: 3 });
    const processing = getRecordingQueueStatusView({
      status: 'processing',
      processingAgeMs: 125000,
    });

    expect(queued.description).toContain('3. w kolejce');
    expect(processing.description).toContain('Po odświeżeniu strony status zostanie zachowany');
    expect(processing.summary).toContain('około 2 min');
  });

  test('classifies offline, backend, and quota failures into user-facing recovery states', () => {
    expect(
      getRecordingQueueStatusView({ status: 'failed', errorMessage: 'Browser offline' })
    ).toMatchObject({
      status: 'offline',
      label: 'Brak połączenia',
      actions: ['refresh', 'retry'],
    });
    expect(
      getRecordingQueueStatusView({ status: 'failed', errorMessage: 'backend unavailable 503' })
    ).toMatchObject({
      status: 'backend_unavailable',
      label: 'Backend niedostępny',
      actions: ['refresh', 'retry', 'contact_admin'],
    });
    expect(
      getRecordingQueueStatusView({ status: 'failed', errorCode: 'stt_quota_exceeded' })
    ).toMatchObject({
      status: 'storage_quota',
      label: 'Brak miejsca lub limit',
      actions: ['delete', 'export', 'contact_admin'],
      retryable: false,
    });
  });

  test('shows scheduled retry as busy but not manually required', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:00:00.000Z'));

    const view = getRecordingQueueStatusView({
      status: 'failed',
      backoffUntil: Date.parse('2026-07-04T10:01:00.000Z'),
    });

    expect(view.label).toBe('Ponowienie zaplanowane');
    expect(view.busy).toBe(true);
    expect(view.summary).toBe('System ponowi przetwarzanie za chwilę.');

    vi.useRealTimers();
  });

  test('maps recording start blockers to actionable hints', () => {
    expect(getRecordingStartView({ browserSupportsRecording: false })).toMatchObject({
      status: 'microphone_unavailable',
      actions: ['reimport'],
    });
    expect(getRecordingStartView({ canRecord: false })).toMatchObject({
      label: 'Brak uprawnień do nagrywania',
      actions: ['contact_admin'],
    });
    expect(getRecordingStartView({ recordPermission: 'denied' })).toMatchObject({
      status: 'permission_denied',
      actions: ['grant_permission'],
    });
    expect(getRecordingStartView({ speechRecognitionSupported: false })).toMatchObject({
      status: 'idle',
      summary: 'Audio trafi na serwer po zakończeniu nagrania.',
    });
  });

  test('covers AI fallback as degraded but not failed analysis', () => {
    const view = getRecordingQueueStatusView({ status: 'ai_fallback' });

    expect(view).toMatchObject({
      label: 'Tryb ograniczony AI',
      role: 'status',
      live: 'polite',
      actions: ['contact_admin'],
    });
    expect(view.description).toContain('ręcznej weryfikacji');
  });
});
