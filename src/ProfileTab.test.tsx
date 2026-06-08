/**
 * @vitest-environment jsdom
 * ProfileTab Component Tests
 * Coverage Target: 60%+
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  describe('Google Calendar Integration', () => {
    it('shows Google Calendar section', async () => {
      render(<ProfileTab {...baseProps} />);

      // Google Calendar is in "Ustawienia wyciszone" (review) category
      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(
        screen.getByText((content) => content.includes('Google Calendar'))
      ).toBeInTheDocument();
    });

    it('calls connectGoogleCalendar when connect button clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      // Calendar "Połącz" is first; Tasks "Połącz" is second
      const connectBtns = screen.getAllByText('Połącz');
      await userEvent.click(connectBtns[0]);

      expect(baseProps.connectGoogleCalendar).toHaveBeenCalled();
    });

    it('calls refreshGoogleCalendar when sync button clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      // Calendar "Sync" is first; Tasks "Sync" is second
      const syncBtns = screen.getAllByText('Sync');
      await userEvent.click(syncBtns[0]);

      expect(baseProps.refreshGoogleCalendar).toHaveBeenCalled();
    });

    it('shows events count when connected', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText((content) => content.includes('wydarzen'))).toBeInTheDocument();
    });

    it('shows not connected message when calendar not connected', async () => {
      render(
        <ProfileTab {...baseProps} googleCalendarStatus="idle" googleCalendarEventsCount={0} />
      );

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(
        screen.getAllByText((content) => content.includes('Kalendarz')).length
      ).toBeGreaterThan(0);
    });
  });

  describe('Google Tasks Integration', () => {
    it('shows Google Tasks section', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText((content) => content.includes('Google Tasks'))).toBeInTheDocument();
    });

    it('renders task list selector with options', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      const select = screen.getAllByRole('combobox')[0];
      expect(select).toBeInTheDocument();
      expect(screen.getByText('My Tasks')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    it('calls onSelectGoogleTaskList when changing selection', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      const select = screen.getAllByRole('combobox')[0];
      await userEvent.selectOptions(select, 'list2');

      expect(baseProps.onSelectGoogleTaskList).toHaveBeenCalledWith('list2');
    });

    it('calls onConnectGoogleTasks when connect clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      // Tasks "Połącz": 0=Google Calendar, 1=Outlook Calendar, 2=Google Tasks, 3=Microsoft Tasks
      const connectBtns = screen.getAllByText('Połącz');
      const googleTasksConnectBtn = connectBtns.find((btn, i) => i === 2);
      await userEvent.click(googleTasksConnectBtn!);

      expect(baseProps.onConnectGoogleTasks).toHaveBeenCalled();
    });

    it('calls onRefreshGoogleTasks when sync clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      // Tasks "Sync" is second (Calendar is first)
      const syncBtns = screen.getAllByText('Sync');
      await userEvent.click(syncBtns[1]);

      expect(baseProps.onRefreshGoogleTasks).toHaveBeenCalled();
    });
  });

  describe('Workspace Backup Section', () => {
    it('shows workspace backup section', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getAllByText((content) => content.includes('Eksport')).length).toBeGreaterThan(
        0
      );
    });

    it('shows export button', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText((content) => content.includes('Eksportuj'))).toBeInTheDocument();
    });

    it('shows import button', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText((content) => content.includes('Importuj'))).toBeInTheDocument();
    });

    it('shows apply import button (disabled when no import pending)', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      const applyBtn = screen.getByText('Zastosuj import');
      expect(applyBtn).toBeInTheDocument();
      expect(applyBtn).toBeDisabled();
    });
  });

  describe('Theme & Layout Settings', () => {
    it('shows the two premium appearance choices in review category', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText('Ciemny klasyczny')).toBeInTheDocument();
      expect(screen.getByText('Jasny premium')).toBeInTheDocument();
    });

    it('calls onSetTheme fallback when appearance card is clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      const darkBtn = screen.getByText('Ciemny klasyczny');
      await userEvent.click(darkBtn);

      expect(baseProps.onSetTheme).toHaveBeenCalledWith('dark');
    });

    it('does not expose legacy theme or density buttons', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.queryByText('Default')).not.toBeInTheDocument();
      expect(screen.queryByText('Compact')).not.toBeInTheDocument();
      expect(screen.queryByText('Flat')).not.toBeInTheDocument();
    });
  });
  describe('API Status Section', () => {
    it('shows API connection status', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText('Połączenie API')).toBeInTheDocument();
      expect(screen.getByText(/localhost:3000/i)).toBeInTheDocument();
    });

    it('shows user role', async () => {
      render(<ProfileTab {...baseProps} workspaceRole="owner" />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText('owner')).toBeInTheDocument();
    });

    it('shows online status', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText('Online')).toBeInTheDocument();
    });
  });

  describe('Changelog Section', () => {
    it('shows changelog section', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getByText('Changelog')).toBeInTheDocument();
    });

    it('shows changelog versions', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      expect(screen.getAllByText(/v1\./i)[0]).toBeInTheDocument();
    });

    it('expands changelog version when clicked', async () => {
      render(<ProfileTab {...baseProps} />);

      const reviewBtn = screen.getByText('Ustawienia wyciszone');
      await userEvent.click(reviewBtn);

      const versionHeaders = screen.getAllByText(/v1\./i);
      await userEvent.click(versionHeaders[0]);

      // Changes list should appear
      const changesList = screen.getByRole('list');
      expect(changesList).toBeInTheDocument();
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

      expect(screen.getAllByText('Wybierz listę...').length).toBeGreaterThan(0);
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

      expect(screen.getByText('Tryb interfejsu')).toBeInTheDocument();
      expect(screen.getByText('Changelog')).toBeInTheDocument();
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
});
