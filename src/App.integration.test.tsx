import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { registerUser } from './lib/auth';
import { STORAGE_KEYS } from './lib/storage';

vi.mock('./services/config', () => ({
  __esModule: true,
  APP_DATA_PROVIDER: 'local',
  MEDIA_PIPELINE_PROVIDER: 'local',
  API_BASE_URL: '',
  MEDIA_API_BASE_URL: '',
  remoteApiEnabled: () => false,
}));

const originalNotification = window.Notification;

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function seedWorkspaceAppState({ manualTasks = [], selectedMeetingId = 'meeting_1' } = {}) {
  const user = {
    id: 'user_1',
    name: 'Anna Nowak',
    email: 'anna@example.com',
    role: 'PM',
    provider: 'local',
    workspaceIds: ['workspace_1', 'workspace_2'],
    defaultWorkspaceId: 'workspace_1',
    preferredTaskView: 'list',
  };
  const workspaces = [
    {
      id: 'workspace_1',
      name: 'Workspace One',
      memberIds: ['user_1'],
      inviteCode: 'ONE123',
      memberRoles: { user_1: 'admin' },
    },
    {
      id: 'workspace_2',
      name: 'Workspace Two',
      memberIds: ['user_1'],
      inviteCode: 'TWO456',
      memberRoles: { user_1: 'admin' },
    },
  ];
  const meetings = [
    {
      id: 'meeting_1',
      userId: 'user_1',
      workspaceId: 'workspace_1',
      createdByUserId: 'user_1',
      title: 'Spotkanie A',
      context: '',
      startsAt: '2026-03-14T09:00:00.000Z',
      durationMinutes: 30,
      attendees: [],
      tags: [],
      needs: ['Potrzeba 1'],
      concerns: ['Obawa 1'],
      desiredOutputs: [],
      location: '',
      recordings: [
        {
          id: 'rec_1',
          title: 'Recording 1',
          recordedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          duration: 120,
          transcript: [{ id: 'seg_1', speakerId: 0, text: 'Cześć w studio!' }],
          speakerNames: { '0': 'Anna Nowak' },
        },
      ],
      latestRecordingId: 'rec_1',
      analysis: null,
      speakerNames: { '0': 'Anna Nowak' },
      speakerCount: 1,
      createdAt: '2026-03-14T09:00:00.000Z',
      updatedAt: '2026-03-14T09:00:00.000Z',
    },
  ];

  writeStorage(STORAGE_KEYS.users, [user]);
  writeStorage(STORAGE_KEYS.workspaces, workspaces);
  writeStorage(STORAGE_KEYS.meetings, meetings);
  writeStorage(STORAGE_KEYS.manualTasks, manualTasks);
  writeStorage(STORAGE_KEYS.taskState, {});
  writeStorage(STORAGE_KEYS.taskBoards, {});
  writeStorage(STORAGE_KEYS.session, {
    userId: 'user_1',
    workspaceId: 'workspace_1',
  });
  writeStorage(STORAGE_KEYS.meetingDrafts, {
    workspace_1: {
      selectedMeetingId,
      draft: selectedMeetingId ? { title: 'Spotkanie A' } : { title: '' },
    },
  });
}

describe('App integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    window.Notification = originalNotification;
  });

  test('registers a user and enters app shell', async () => {
    render(<App />);

    expect(
      await screen.findByRole('button', { name: /wejd|zalog|dołącz|wejdz/i })
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Imię i nazwisko/i), 'Test User');
    await userEvent.type(screen.getByLabelText(/Adres email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/Hasło/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /wejdź do aplikacji/i }));

    expect(await screen.findByText('VoiceBóbr')).toBeInTheDocument();
  });

  test('resets password and logs in with new password', async () => {
    const registerResult = await registerUser([], [], {
      name: 'Marta',
      email: 'marta@example.com',
      password: 'starehaslo',
      workspaceMode: 'create',
      workspaceName: 'Support',
    });

    writeStorage(STORAGE_KEYS.users, registerResult.users);
    writeStorage(STORAGE_KEYS.workspaces, registerResult.workspaces);
    writeStorage(STORAGE_KEYS.session, null);

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /logowanie/i }));
    await userEvent.click(screen.getByRole('button', { name: /zapom/i }));
    await userEvent.type(screen.getByPlaceholderText('name@company.com'), 'marta@example.com');
    await userEvent.click(screen.getByRole('button', { name: /wyślij kod resetu/i }));

    const preview = await screen.findByText(/twój lokalny kod resetu/i);
    const code = preview.textContent.match(/\b\d{6}\b/)[0];

    await userEvent.type(screen.getByPlaceholderText(/wpisz 6-cyfrowy kod/i), code);
    await userEvent.type(screen.getByPlaceholderText('Minimum 6 znaków'), 'nowehaslo');
    await userEvent.type(screen.getByPlaceholderText(/powtórz|powtorz/i), 'nowehaslo');
    await userEvent.click(screen.getByRole('button', { name: /zmień hasło/i }));

    expect(await screen.findByText(/zmieni.*zalog/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /wróć do logowania/i }));

    await userEvent.type(screen.getByLabelText(/Adres email/i), 'marta@example.com');
    await userEvent.type(screen.getByLabelText(/^Hasło/i), 'nowehaslo');
    await userEvent.click(screen.getByRole('button', { name: /zaloguj się/i }));

    expect(await screen.findByText('VoiceBóbr')).toBeInTheDocument();
  });

  test('switches shared workspaces', async () => {
    seedWorkspaceAppState();
    const { container } = render(<App />);

    expect(await screen.findByText(/spotkanie a/i)).toBeInTheDocument();

    const workspaceSelect = container.querySelector('.modern-workspace-selector select');
    expect(workspaceSelect).not.toBeNull();
    await userEvent.selectOptions(workspaceSelect as HTMLSelectElement, 'workspace_2');

    expect((workspaceSelect as HTMLSelectElement).value).toBe('workspace_2');
  });

  test('opens people view and shows selected person', async () => {
    seedWorkspaceAppState();
    render(<App />);

    const peopleTab = await screen.findByRole('button', { name: 'Osoby' });
    await userEvent.click(peopleTab);

    expect(
      await screen.findByRole('heading', { name: /anna nowak/i, level: 2 })
    ).toBeInTheDocument();
  });

  test('opens studio and validates transcript visibility', async () => {
    seedWorkspaceAppState();
    render(<App />);

    const studioTab = await screen.findByRole('button', { name: 'Studio' });
    await userEvent.click(studioTab);

    expect(await screen.findByText(/Cześć w studio!/i)).toBeInTheDocument();
  });

  test('shows notification panel and keeps interaction state', async () => {
    const NotificationMock = vi.fn();
    NotificationMock.permission = 'default';
    NotificationMock.requestPermission = vi.fn().mockImplementation(async () => {
      NotificationMock.permission = 'granted';
      return 'granted';
    });
    window.Notification = NotificationMock as any;

    seedWorkspaceAppState();
    render(<App />);

    await userEvent.click(screen.getByLabelText('Powiadomienia'));
    expect(await screen.findByText(/centrum alert/i)).toBeInTheDocument();

    const permissionButton = screen.queryByRole('button', {
      name: /wl[ąa]cz w (przegladar|przeglą)?.*|włącz alerty/i,
    });
    if (permissionButton) {
      await act(async () => {
        await userEvent.click(permissionButton);
      });

      await waitFor(() => {
        expect(NotificationMock.requestPermission).toHaveBeenCalled();
      });
    }
  });

  test('shows microphone error for ad hoc recording when permission is blocked', async () => {
    seedWorkspaceAppState();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.MediaRecorder = vi.fn() as any;
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue({ name: 'NotAllowedError' }),
      },
      configurable: true,
    });

    render(<App />);

    await userEvent.click(screen.getByRole('button', { name: /rozpocznij nagrywanie/i }));
    await screen.findByText(/Dostęp do mikrofonu jest zablokowany/i);
  });
});
