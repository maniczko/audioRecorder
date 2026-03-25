import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

describe('Digest routes', () => {
  let app: ReturnType<typeof createApp>;
  let mockAuthService: any;
  let mockWorkspaceService: any;
  let mockTranscriptionService: any;
  let mockSendMail: any;

  beforeEach(async () => {
    vi.resetModules();

    mockSendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    mockAuthService = {
      getSession: vi.fn(),
    };
    mockWorkspaceService = {
      db: {
        _query: vi.fn().mockResolvedValue([]),
        accessibleWorkspaces: vi.fn().mockResolvedValue([]),
      },
      getWorkspaceState: vi.fn(),
    };
    mockTranscriptionService = {};

    const { createApp } = await import('../../app.ts');
    app = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });
  }, 15000);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns preview mode when SMTP is not configured', async () => {
    vi.stubEnv('VOICELOG_SMTP_HOST', '');
    vi.stubEnv('VOICELOG_SMTP_USER', '');
    vi.stubEnv('VOICELOG_SMTP_PASS', '');

    mockWorkspaceService.db._query.mockResolvedValue([
      {
        id: 'u1',
        email: 'anna@example.com',
        name: 'Anna',
        profile_json: JSON.stringify({ notifyDailyDigest: true }),
      },
    ]);
    mockWorkspaceService.db.accessibleWorkspaces.mockResolvedValue([
      { id: 'ws1', name: 'Workspace 1' },
    ]);
    mockWorkspaceService.getWorkspaceState.mockResolvedValue({
      manualTasks: [
        { id: 't1', title: 'Zaległe zadanie', dueDate: '2026-03-20', status: 'todo' },
        {
          id: 't2',
          title: 'Dzisiejsze zadanie',
          dueDate: new Date().toISOString().slice(0, 10),
          status: 'todo',
        },
      ],
      meetings: [
        {
          id: 'm1',
          title: 'Spotkanie zespołu',
          startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    const res = await app.request('/digest/daily', { method: 'GET' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe('preview');
    expect(json.sent).toBe(0);
    expect(json.digests).toHaveLength(1);
    expect(json.digests[0].digestCount).toBe(1);
  });

  test('sends digest email when SMTP is configured', async () => {
    vi.stubEnv('VOICELOG_SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('VOICELOG_SMTP_USER', 'digest@example.com');
    vi.stubEnv('VOICELOG_SMTP_PASS', 'secret');
    vi.stubEnv('VOICELOG_SMTP_FROM', 'digest@example.com');

    vi.doMock('nodemailer', () => ({
      createTransport: vi.fn(() => ({
        sendMail: mockSendMail,
      })),
    }));

    vi.resetModules();
    const { createApp } = await import('../../app.ts');
    const appWithMailer = createApp({
      authService: mockAuthService,
      workspaceService: mockWorkspaceService,
      transcriptionService: mockTranscriptionService,
      config: { allowedOrigins: '*', trustProxy: false, uploadDir: '/tmp' },
    });

    mockWorkspaceService.db._query.mockResolvedValue([
      {
        id: 'u1',
        email: 'anna@example.com',
        name: 'Anna',
        profile_json: JSON.stringify({ notifyDailyDigest: true }),
      },
    ]);
    mockWorkspaceService.db.accessibleWorkspaces.mockResolvedValue([
      { id: 'ws1', name: 'Workspace 1' },
    ]);
    mockWorkspaceService.getWorkspaceState.mockResolvedValue({
      manualTasks: [
        {
          id: 't1',
          title: 'Zadanie',
          dueDate: new Date().toISOString().slice(0, 10),
          status: 'todo',
        },
      ],
      meetings: [],
    });

    const res = await appWithMailer.request('/digest/daily', { method: 'GET' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.mode).toBe('smtp');
    expect(json.sent).toBe(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'anna@example.com',
        subject: expect.stringContaining('Dzienny digest'),
      })
    );
  });
});
