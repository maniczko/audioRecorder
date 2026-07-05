/**
 * @vitest-environment jsdom
 * ProfileTab Component Tests
 * Coverage Target: 60%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileTab from './ProfileTab';
import { apiRequest } from './services/httpClient';

// Mock modules
vi.mock('./services/httpClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ profiles: [] }),
}));

vi.mock('./services/config', () => ({
  API_BASE_URL: 'http://localhost:4000',
  APP_DATA_PROVIDER: 'local',
  MEDIA_PIPELINE_PROVIDER: 'local',
  apiBaseUrlConfigured: vi.fn(() => true),
  remoteApiEnabled: vi.fn(() => false),
}));

vi.mock('./hooks/useWorkspaceBackup', () => ({
  default: vi.fn(() => ({
    exportWorkspace: vi.fn(),
    importWorkspaceFile: vi.fn(),
    applyWorkspaceImport: vi.fn(),
    clearImportState: vi.fn(),
    preview: null,
    statusMessage: '',
    isImporting: false,
    hasPendingImport: false,
  })),
}));

const baseProps = {
  currentUser: {
    id: 'u1',
    email: 'test@example.com',
    provider: 'local',
    passwordHash: 'hash123',
  },
  profileDraft: {
    name: 'Test User',
    role: 'Developer',
    company: 'Acme Inc',
    bio: 'Test bio',
    avatarUrl: '',
    autoTaskCapture: true,
    notifyDailyDigest: false,
    autoLearnSpeakerProfiles: true,
    preferredInsights: 'Tasks',
  },
  setProfileDraft: vi.fn(),
  saveProfile: vi.fn(),
  profileMessage: '',
  passwordDraft: {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  },
  setPasswordDraft: vi.fn(),
  updatePassword: vi.fn(),
  securityMessage: '',
  workspaceRole: 'admin',
  onLogout: vi.fn(),
  theme: 'dark',
  appearanceMode: 'dark',
  onSetTheme: vi.fn(),
  layoutPreset: 'default',
  onSetLayoutPreset: vi.fn(),
  allTags: [
    { tag: 'projekt', taskCount: 5, meetingCount: 2 },
    { tag: 'pilne', taskCount: 3, meetingCount: 0 },
  ],
  onRenameTag: vi.fn(),
  onDeleteTag: vi.fn(),
  vocabulary: ['JavaScript', 'TypeScript'],
  onUpdateVocabulary: vi.fn(),
  peopleProfiles: [
    { id: 'p1', name: 'Alice', speakerId: 's1' },
    { id: 'p2', name: 'Bob', speakerId: 's2' },
  ],
  sessionToken: 'token123',
  apiBaseUrl: 'http://localhost:3000',
  // Google
  googleEnabled: true,
  googleCalendarStatus: 'connected',
  googleCalendarMessage: '',
  googleCalendarEventsCount: 3,
  googleCalendarLastSyncedAt: new Date().toISOString(),
  connectGoogleCalendar: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
  refreshGoogleCalendar: vi.fn(),
  // Google Tasks
  googleTasksEnabled: true,
  googleTasksStatus: 'connected',
  googleTasksMessage: '',
  googleTasksLastSyncedAt: '',
  googleTaskLists: [
    { id: 'list1', title: 'My Tasks' },
    { id: 'list2', title: 'Work' },
  ],
  selectedGoogleTaskListId: 'list1',
  onSelectGoogleTaskList: vi.fn(),
  onConnectGoogleTasks: vi.fn(),
  onImportGoogleTasks: vi.fn(),
  onExportGoogleTasks: vi.fn(),
  onRefreshGoogleTasks: vi.fn(),
  // Audio storage
  audioStorageState: {
    items: [],
    usageBytes: 1024 * 1024 * 50,
    quotaBytes: 1024 * 1024 * 500,
    freeBytes: 1024 * 1024 * 450,
    usageRatio: 0.1,
    isNearQuota: false,
    warningMessage: '',
  },
  onRefreshAudioStorageState: vi.fn(),
  onDeleteStoredRecordingAudio: vi.fn(),
};

describe('ProfileTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiRequest).mockResolvedValue({ profiles: [] });
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Navigation & Layout', () => {
    it('renders all 3 navigation categories', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('Profil i Styl pracy')).toBeInTheDocument();
      expect(screen.getByText('Narzędzia AI')).toBeInTheDocument();
      expect(screen.getByText('Ustawienia wyciszone')).toBeInTheDocument();
    });

    it('shows account category by default', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('Dane podstawowe')).toBeInTheDocument();
      expect(screen.getByText('Hasło')).toBeInTheDocument();
      expect(screen.getByText('Styl pracy')).toBeInTheDocument();
    });

    it('calls onLogout when logout button clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const logoutBtn = screen.getByText(/Wyloguj/i);
      await userEvent.click(logoutBtn);

      expect(baseProps.onLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Profile Form Section', () => {
    it('renders profile form with user data', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Developer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Acme Inc')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test bio')).toBeInTheDocument();
    });

    it('calls setProfileDraft when typing in name field', async () => {
      render(<ProfileTab {...baseProps} />);

      const nameInput = screen.getByDisplayValue('Test User');
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'New Name');

      expect(baseProps.setProfileDraft).toHaveBeenCalled();
    });

    it('calls saveProfile when form submitted', async () => {
      render(<ProfileTab {...baseProps} />);

      const saveBtn = screen.getByText('Zapisz profil');
      await userEvent.click(saveBtn);

      expect(baseProps.saveProfile).toHaveBeenCalled();
    });

    it('passes the current user to saveProfile instead of the submit event', async () => {
      render(<ProfileTab {...baseProps} />);

      await userEvent.click(screen.getByRole('button', { name: /Zapisz profil/i }));

      expect(baseProps.saveProfile).toHaveBeenCalledWith(baseProps.currentUser);
      expect(baseProps.saveProfile.mock.calls[0][0]).toMatchObject({ id: 'u1' });
    });

    it('displays profile message after save', () => {
      render(<ProfileTab {...baseProps} profileMessage="Profil zapisany." />);

      expect(screen.getByText('Profil zapisany.')).toBeInTheDocument();
    });

    it('shows avatar fallback with initial', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('shows avatar image when avatarUrl provided', () => {
      render(
        <ProfileTab
          {...baseProps}
          profileDraft={{ ...baseProps.profileDraft, avatarUrl: 'https://example.com/avatar.jpg' }}
        />
      );

      const avatar = screen.getByAltText('Test User') as HTMLImageElement;
      expect(avatar).toBeInTheDocument();
      expect(avatar.src).toContain('avatar.jpg');
    });
  });

  describe('Password Section', () => {
    it('shows password form for local accounts', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('Hasło')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Aktualne hasło')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nowe hasło')).toBeInTheDocument();
    });

    it('shows info for Google accounts without password hash', () => {
      render(
        <ProfileTab
          {...baseProps}
          currentUser={{ ...baseProps.currentUser, provider: 'google', passwordHash: '' }}
        />
      );

      expect(screen.getByText(/Konto Google/i)).toBeInTheDocument();
    });

    it('calls setPasswordDraft when typing in password fields', async () => {
      render(<ProfileTab {...baseProps} />);

      const currentPassword = screen.getByPlaceholderText('Aktualne hasło');
      await userEvent.type(currentPassword, 'old123');

      expect(baseProps.setPasswordDraft).toHaveBeenCalled();
    });

    it('calls updatePassword when form submitted', async () => {
      render(<ProfileTab {...baseProps} />);

      const changeBtn = screen.getByText('Zmień hasło');
      await userEvent.click(changeBtn);

      expect(baseProps.updatePassword).toHaveBeenCalledWith(baseProps.currentUser);
    });

    it('displays security message after password change', () => {
      render(<ProfileTab {...baseProps} securityMessage="Hasło zmienione" />);

      expect(screen.getByText('Hasło zmienione')).toBeInTheDocument();
    });
  });

  describe('Work Style Preferences', () => {
    it('renders work style toggles', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('Auto task capture')).toBeInTheDocument();
      expect(screen.getByText('Daily digest')).toBeInTheDocument();
      expect(screen.getByText('Auto-learn speaker profiles')).toBeInTheDocument();
    });

    it('shows correct toggle states from profileDraft', () => {
      render(<ProfileTab {...baseProps} />);

      const autoTaskCapture = screen.getByLabelText(/Auto task capture/i);
      const dailyDigest = screen.getByLabelText(/Daily digest/i);

      expect(autoTaskCapture).toBeChecked();
      expect(dailyDigest).not.toBeChecked();
    });

    it('renders preferred insights textarea', () => {
      render(<ProfileTab {...baseProps} />);

      const insightsTextarea = screen.getByDisplayValue('Tasks');
      expect(insightsTextarea).toBeInTheDocument();
    });

    it('calls setProfileDraft when toggling preferences', async () => {
      render(<ProfileTab {...baseProps} />);

      const dailyDigestToggle = screen.getByLabelText(/Daily digest/i);
      await userEvent.click(dailyDigestToggle);

      expect(baseProps.setProfileDraft).toHaveBeenCalled();
    });

    it('calls saveProfile when preferences form submitted', async () => {
      render(<ProfileTab {...baseProps} />);

      const saveBtn = screen.getByText('Zapisz preferencje');
      await userEvent.click(saveBtn);

      expect(baseProps.saveProfile).toHaveBeenCalled();
    });
  });

  describe('Integrations reference view', () => {
    async function openIntegrationsView(props = {}) {
      render(<ProfileTab {...baseProps} {...props} />);
      await userEvent.click(screen.getByText('Ustawienia wyciszone'));
    }

    function getIntegrationCard(title: string) {
      const heading = screen.getByRole('heading', { name: title });
      const card = heading.closest('article');
      expect(card).toBeTruthy();
      return card as HTMLElement;
    }

    it('renders the screenshot-first integrations grid and info strip', async () => {
      await openIntegrationsView();

      expect(screen.getByRole('heading', { name: 'Ustawienia wyciszone' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Moje konto' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Integracje' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Google Calendar' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Outlook Calendar' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Google Tasks' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Microsoft To Do' })).toBeInTheDocument();
      expect(screen.getByLabelText('Informacje o synchronizacji')).toBeInTheDocument();
    });

    it('calls connectGoogleCalendar when disconnected Google Calendar card is connected', async () => {
      await openIntegrationsView({ googleCalendarStatus: 'idle', googleCalendarEventsCount: 0 });

      const card = getIntegrationCard('Google Calendar');
      await userEvent.click(within(card).getByRole('button', { name: 'Połącz' }));

      expect(baseProps.connectGoogleCalendar).toHaveBeenCalled();
    });

    it('calls refreshGoogleCalendar from connected Google Calendar card', async () => {
      await openIntegrationsView();

      const card = getIntegrationCard('Google Calendar');
      await userEvent.click(within(card).getByRole('button', { name: 'Synchronizuj teraz' }));

      expect(baseProps.refreshGoogleCalendar).toHaveBeenCalled();
    });

    it('shows events count when Google Calendar is connected', async () => {
      await openIntegrationsView();

      expect(screen.getByText('3 wydarzenia w kalendarzu')).toBeInTheDocument();
      expect(screen.getByText(/Ostatnia synchronizacja/i)).toBeInTheDocument();
    });

    it('shows not connected message when calendar is not connected', async () => {
      await openIntegrationsView({ googleCalendarStatus: 'idle', googleCalendarEventsCount: 0 });

      const card = getIntegrationCard('Google Calendar');
      expect(within(card).getByText('Niepołączone')).toBeInTheDocument();
      expect(within(card).getByText('Kalendarz nie jest jeszcze podłączony.')).toBeInTheDocument();
    });

    it('calls onConnectGoogleTasks from Google Tasks card', async () => {
      await openIntegrationsView();

      const card = getIntegrationCard('Google Tasks');
      await userEvent.click(within(card).getByRole('button', { name: 'Połącz' }));

      expect(baseProps.onConnectGoogleTasks).toHaveBeenCalled();
    });

    it('handles empty google task lists without rendering a legacy selector', async () => {
      await openIntegrationsView({ googleTaskLists: [] });

      expect(screen.getByRole('heading', { name: 'Google Tasks' })).toBeInTheDocument();
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('exposes review settings alongside integrations', async () => {
      await openIntegrationsView();

      expect(screen.getByText('Tryb interfejsu')).toBeInTheDocument();
      expect(screen.getByText('Changelog')).toBeInTheDocument();
      expect(screen.getByText('Połączenie API')).toBeInTheDocument();
    });
  });
  describe('Accessibility', () => {
    it('has proper labels for form fields', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByLabelText(/Imię i nazwisko/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Bio/i)).toBeInTheDocument();
    });

    it('has proper button roles', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByRole('button', { name: /Zapisz profil/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Zmień hasło/i })).toBeInTheDocument();
    });

    it('has multiple h2 headings', () => {
      render(<ProfileTab {...baseProps} />);

      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty vocabulary array', async () => {
      render(<ProfileTab {...baseProps} vocabulary={[]} />);

      const toolsBtn = screen.getByText('Narzędzia AI');
      await userEvent.click(toolsBtn);

      // Should not crash - section should render
      expect(screen.getByText((content) => content.includes('Słownik'))).toBeInTheDocument();
    });

    it('handles empty tags array', async () => {
      render(<ProfileTab {...baseProps} allTags={[]} />);

      const toolsBtn = screen.getByText('Narzędzia AI');
      await userEvent.click(toolsBtn);

      // Should not crash - section should render
      expect(screen.getByText((content) => content.includes('tagami'))).toBeInTheDocument();
    });

    it('handles empty google task lists', async () => {
      render(<ProfileTab {...baseProps} googleTaskLists={[]} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('handles null optional props', () => {
      render(
        <ProfileTab
          {...baseProps}
          peopleProfiles={undefined as any}
          vocabulary={null as any}
          allTags={null as any}
        />
      );

      // Should not crash
      expect(screen.getByText('Profil i Styl pracy')).toBeInTheDocument();
    });

    it('handles very long bio text', () => {
      const longBio = 'A'.repeat(1000);
      render(
        <ProfileTab {...baseProps} profileDraft={{ ...baseProps.profileDraft, bio: longBio }} />
      );

      expect(screen.getByDisplayValue(longBio)).toBeInTheDocument();
    });

    it('handles special characters in name', () => {
      render(
        <ProfileTab
          {...baseProps}
          profileDraft={{ ...baseProps.profileDraft, name: "O'Brien - Müller" }}
        />
      );

      expect(screen.getByDisplayValue("O'Brien - Müller")).toBeInTheDocument();
    });
  });

  describe('Category Navigation', () => {
    it('switches to tools category', async () => {
      render(<ProfileTab {...baseProps} />);

      const toolsBtn = screen.getByText('Narzędzia AI');
      await userEvent.click(toolsBtn);

      expect(screen.getByText('Profile głosowe')).toBeInTheDocument();
      expect(screen.getByText('Słownik (Vocabulary)')).toBeInTheDocument();
    });

    it('switches to review category', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByRole('heading', { name: 'Integracje' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Google Calendar' })).toBeInTheDocument();
    });

    it('returns to account category from tools', async () => {
      render(<ProfileTab {...baseProps} />);

      // Switch to tools
      const toolsBtn = screen.getByText('Narzędzia AI');
      await userEvent.click(toolsBtn);

      // Switch back to account
      const accountBtn = screen.getByText('Profil i Styl pracy');
      await userEvent.click(accountBtn);

      expect(screen.getByText('Dane podstawowe')).toBeInTheDocument();
    });
  });

  describe('Voice Profiles List', () => {
    it('shows people with and without samples including quality readiness', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        profiles: [
          {
            id: 'vp_adam',
            speakerName: 'Adam',
            userId: 'u1',
            createdAt: '2026-05-21T10:00:00.000Z',
            hasEmbedding: true,
            sampleCount: 1,
            threshold: 0.82,
          },
        ],
      });

      render(<ProfileTab {...baseProps} peopleProfiles={[{ name: 'Adam' }, { name: 'Ewa' }]} />);

      await userEvent.click(screen.getByText(/Narz/));

      const adamRow = await screen.findByTestId('voice-profile-person-adam');
      expect(within(adamRow).getByTestId('voice-profile-person-name')).toHaveTextContent('Adam');
      expect(within(adamRow).getByText('Ma próbkę')).toBeInTheDocument();
      expect(within(adamRow).getByText('1/5')).toBeInTheDocument();
      expect(within(adamRow).getByText('Niska')).toBeInTheDocument();
      expect(within(adamRow).getByText('20%')).toBeInTheDocument();
      expect(within(adamRow).getAllByText('82%').length).toBeGreaterThan(0);

      const ewaRow = screen.getByTestId('voice-profile-person-ewa');
      expect(within(ewaRow).getByTestId('voice-profile-person-name')).toHaveTextContent('Ewa');
      expect(within(ewaRow).getByText('Brak próbki')).toBeInTheDocument();
      expect(within(ewaRow).getByText('0/5')).toBeInTheDocument();
      expect(within(ewaRow).getByText('Brak')).toBeInTheDocument();
      expect(within(ewaRow).getByText('0%')).toBeInTheDocument();
    });

    it('merges people and voice profiles case-insensitively and sorts sampled people first', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        profiles: [
          {
            id: 'vp_zenon',
            speakerName: 'Zenon',
            userId: 'u1',
            createdAt: '2026-05-20T10:00:00.000Z',
            hasEmbedding: true,
            sampleCount: 3,
            threshold: 0.86,
          },
          {
            id: 'vp_adam',
            speakerName: 'adam',
            userId: 'u1',
            createdAt: '2026-05-21T10:00:00.000Z',
            hasEmbedding: true,
            sampleCount: 2,
            threshold: 0.82,
          },
        ],
      });

      render(<ProfileTab {...baseProps} peopleProfiles={[{ name: 'Ewa' }, { name: 'Adam' }]} />);

      await userEvent.click(screen.getByText(/Narz/));

      await screen.findByTestId('voice-profile-person-adam');
      const names = screen
        .getAllByTestId('voice-profile-person-row')
        .map((row) => within(row).getByTestId('voice-profile-person-name').textContent);

      expect(names).toEqual(['Adam', 'Zenon', 'Ewa']);
      expect(screen.getAllByTestId('voice-profile-person-adam')).toHaveLength(1);
    });

    it('shows an explicit empty state when there are no people or saved voice samples', async () => {
      render(<ProfileTab {...baseProps} peopleProfiles={[]} />);

      await userEvent.click(screen.getByText(/Narz/));

      expect(await screen.findByText('Brak zapisanych próbek głosu')).toBeInTheDocument();
    });
  });

  describe('Voice Profiles Management', () => {
    it('renders a management table with profile status, samples, threshold, last update, and actions', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        profiles: [
          {
            id: 'vp_adam',
            speakerName: 'Adam',
            userId: 'u1',
            createdAt: '2026-05-21T10:00:00.000Z',
            hasEmbedding: true,
            sampleCount: 2,
            threshold: 0.82,
          },
        ],
      });

      render(<ProfileTab {...baseProps} peopleProfiles={[{ name: 'Adam' }, { name: 'Ewa' }]} />);

      await userEvent.click(screen.getByText(/Narz/));

      const managementTable = await screen.findByRole('table', {
        name: /Zarzadzanie profilami glosowymi/i,
      });
      expect(within(managementTable).getByRole('columnheader', { name: 'Osoba' })).toBeVisible();
      expect(within(managementTable).getByRole('columnheader', { name: 'Probki' })).toBeVisible();
      expect(within(managementTable).getByRole('columnheader', { name: 'Prog' })).toBeVisible();
      expect(within(managementTable).getByRole('columnheader', { name: 'Status' })).toBeVisible();
      expect(
        within(managementTable).getByRole('columnheader', { name: 'Ostatnia aktualizacja' })
      ).toBeVisible();
      expect(within(managementTable).getByRole('columnheader', { name: 'Akcje' })).toBeVisible();

      const adamRow = within(managementTable).getByRole('row', { name: /Adam/i });
      expect(within(adamRow).getByText('2/5')).toBeInTheDocument();
      expect(within(adamRow).getByTestId('voice-profile-management-status')).toHaveClass('ready');
      expect(within(adamRow).getByLabelText('Prog rozpoznawania Adam')).toHaveValue('82');
      expect(
        within(adamRow).getByRole('button', { name: /Usun profil glosowy Adam/i })
      ).toBeEnabled();
    });

    it('updates the profile threshold from the management row for workspace admins', async () => {
      vi.mocked(apiRequest)
        .mockResolvedValueOnce({
          profiles: [
            {
              id: 'vp_adam',
              speakerName: 'Adam',
              userId: 'u1',
              createdAt: '2026-05-21T10:00:00.000Z',
              hasEmbedding: true,
              sampleCount: 1,
              threshold: 0.82,
            },
          ],
        })
        .mockResolvedValueOnce({ id: 'vp_adam', threshold: 0.9 });

      render(<ProfileTab {...baseProps} peopleProfiles={[{ name: 'Adam' }]} />);

      await userEvent.click(screen.getByText(/Narz/));

      const slider = await screen.findByLabelText('Prog rozpoznawania Adam');
      fireEvent.change(slider, { target: { value: '90' } });
      fireEvent.mouseUp(slider);

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/voice-profiles/vp_adam/threshold', {
          method: 'PATCH',
          body: { threshold: 0.9 },
        });
      });
    });

    it('deletes a profile from the management row for workspace admins', async () => {
      vi.mocked(apiRequest)
        .mockResolvedValueOnce({
          profiles: [
            {
              id: 'vp_adam',
              speakerName: 'Adam',
              userId: 'u1',
              createdAt: '2026-05-21T10:00:00.000Z',
              hasEmbedding: true,
              sampleCount: 1,
              threshold: 0.82,
            },
          ],
        })
        .mockResolvedValueOnce(undefined);

      render(<ProfileTab {...baseProps} peopleProfiles={[{ name: 'Adam' }]} />);

      await userEvent.click(screen.getByText(/Narz/));
      await userEvent.click(
        await screen.findByRole('button', { name: /Usun profil glosowy Adam/i })
      );

      await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith('/voice-profiles/vp_adam', {
          method: 'DELETE',
          parseAs: 'raw',
        });
      });
      expect(
        within(screen.getByTestId('voice-profile-person-adam')).getByTestId(
          'voice-profile-management-status'
        )
      ).toHaveClass('empty');
    });

    it('keeps threshold and delete controls read-only for workspace members', async () => {
      vi.mocked(apiRequest).mockResolvedValueOnce({
        profiles: [
          {
            id: 'vp_adam',
            speakerName: 'Adam',
            userId: 'u1',
            createdAt: '2026-05-21T10:00:00.000Z',
            hasEmbedding: true,
            sampleCount: 1,
            threshold: 0.82,
          },
        ],
      });

      render(
        <ProfileTab {...baseProps} workspaceRole="member" peopleProfiles={[{ name: 'Adam' }]} />
      );

      await userEvent.click(screen.getByText(/Narz/));

      expect(await screen.findByLabelText('Prog rozpoznawania Adam')).toBeDisabled();
      expect(screen.getByRole('button', { name: /Usun profil glosowy Adam/i })).toBeDisabled();
      expect(screen.getByText(/Tylko owner lub admin/i)).toBeInTheDocument();
    });
  });

  describe('User Info Display', () => {
    it('shows user email in hero section', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('shows account type (Local/Google)', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('Lokalne')).toBeInTheDocument();
    });

    it('shows Google account type for Google provider', () => {
      render(
        <ProfileTab {...baseProps} currentUser={{ ...baseProps.currentUser, provider: 'google' }} />
      );

      expect(screen.getByText('Google')).toBeInTheDocument();
    });

    it('shows role and company in profile', () => {
      render(<ProfileTab {...baseProps} />);

      expect(screen.getByText('Developer @ Acme Inc')).toBeInTheDocument();
    });
  });

  describe('Workspace RBAC actions', () => {
    const workspaceMembers = [
      { id: 'u1', name: 'Owner User', email: 'owner@example.com', workspaceMemberRole: 'owner' },
      { id: 'u2', name: 'Member User', email: 'member@example.com', workspaceMemberRole: 'member' },
    ];

    it('allows admins to change roles without showing owner-only remove actions', async () => {
      render(
        <ProfileTab
          {...baseProps}
          workspaceRole="admin"
          workspaceMembers={workspaceMembers}
          currentUser={{ ...baseProps.currentUser, id: 'u1' }}
          updateWorkspaceMemberRole={vi.fn()}
          removeWorkspaceMember={vi.fn()}
        />
      );

      await userEvent.click(screen.getByText(/Zesp/));

      expect(screen.getByRole('combobox')).toHaveValue('member');
      expect(screen.queryByTitle(/Member User z workspace/i)).not.toBeInTheDocument();
    });

    it('keeps member removal visible only for owners', async () => {
      render(
        <ProfileTab
          {...baseProps}
          workspaceRole="owner"
          workspaceMembers={workspaceMembers}
          currentUser={{ ...baseProps.currentUser, id: 'u1' }}
          updateWorkspaceMemberRole={vi.fn()}
          removeWorkspaceMember={vi.fn()}
        />
      );

      await userEvent.click(screen.getByText(/Zesp/));

      expect(screen.getByRole('combobox')).toHaveValue('member');
      expect(screen.getByTitle(/Member User z workspace/i)).toBeInTheDocument();
    });
  });
});
