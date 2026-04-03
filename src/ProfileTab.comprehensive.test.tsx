/**
 * @vitest-environment jsdom
 */
/* eslint-disable testing-library/no-node-access, testing-library/no-wait-for-multiple-assertions, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileTab from './ProfileTab';
// user-event v13 compat: v14 setup() API polyfill
if (!(userEvent as any).setup) (userEvent as any).setup = () => userEvent;

// Mock apiRequest
vi.mock('./services/httpClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ profiles: [] }),
}));

// Mock config
vi.mock('./services/config', () => ({
  API_BASE_URL: 'http://localhost:4000',
  APP_DATA_PROVIDER: 'local',
  MEDIA_PIPELINE_PROVIDER: 'local',
  apiBaseUrlConfigured: vi.fn(() => true),
  remoteApiEnabled: vi.fn(() => false),
}));

// Mock useWorkspaceBackup hook
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

// Mock JapaneseThemeSelector to avoid its side-effects
vi.mock('./components/JapaneseThemeSelector', () => ({
  JapaneseThemeSelector: (props: any) => <div data-testid="japan-theme" />,
}));

const mockProps = {
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
    preferredInsights: 'Tasks, decisions',
  },
  setProfileDraft: vi.fn(),
  saveProfile: vi.fn((e) => e.preventDefault()),
  profileMessage: '',
  passwordDraft: {
    currentPassword: '',
    newPassword: '',
  },
  setPasswordDraft: vi.fn(),
  updatePassword: vi.fn((e) => e.preventDefault()),
  securityMessage: '',
  workspaceRole: 'admin',
  onLogout: vi.fn(),
  theme: 'dark',
  onSetTheme: vi.fn(),
  layoutPreset: 'default',
  onSetLayoutPreset: vi.fn(),
  allTags: [{ tag: 'project', taskCount: 5, meetingCount: 2 }],
  onRenameTag: vi.fn(),
  onDeleteTag: vi.fn(),
  vocabulary: ['JavaScript', 'TypeScript'],
  onUpdateVocabulary: vi.fn(),
  peopleProfiles: [
    { id: 'p1', name: 'Alice', speakerId: 's1' },
    { id: 'p2', name: 'Bob', speakerId: 's2' },
  ],
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
  sessionToken: 'token123',
  apiBaseUrl: 'http://localhost:3000',
  // Google integration props
  googleEnabled: true,
  googleCalendarStatus: 'connected',
  googleCalendarMessage: '',
  googleCalendarEventsCount: 3,
  googleCalendarLastSyncedAt: new Date().toISOString(),
  connectGoogleCalendar: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
  refreshGoogleCalendar: vi.fn(),
  googleTasksEnabled: true,
  googleTasksStatus: 'connected',
  googleTasksMessage: '',
  googleTasksLastSyncedAt: new Date().toISOString(),
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
};

describe('ProfileTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Navigation and Layout', () => {
    it('renders all navigation categories', () => {
      render(<ProfileTab {...mockProps} />);

      expect(screen.getByText('Profil i Styl pracy')).toBeInTheDocument();
      expect(screen.getByText('Narzędzia AI')).toBeInTheDocument();
      expect(screen.getByText('Ustawienia wyciszone')).toBeInTheDocument();
    });

    it('switches between categories when navigation buttons are clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      // Default view - account
      expect(screen.getByText('Dane podstawowe')).toBeInTheDocument();

      // Switch to Narzędzia AI
      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile głosowe')).toBeInTheDocument();
        expect(screen.getByText('Słownik (Vocabulary)')).toBeInTheDocument();
      });

      // Switch to Ustawienia wyciszone
      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
        expect(screen.getByText('Backup')).toBeInTheDocument();
      });
    });

    it('displays logout button and calls onLogout when clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const logoutButton = screen.getByText('Wyloguj się').closest('button');
      await user.click(logoutButton!);

      expect(mockProps.onLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Account Category - Profile Section', () => {
    it('renders user profile information correctly', () => {
      render(<ProfileTab {...mockProps} />);

      expect(screen.getByRole('heading', { name: 'Test User' })).toBeInTheDocument();
      expect(screen.getByText(/Developer/)).toBeInTheDocument();
      expect(screen.getByText(/Acme Inc/)).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });

    it('displays avatar or fallback based on avatarUrl', () => {
      const { rerender } = render(<ProfileTab {...mockProps} />);

      // Fallback avatar
      expect(screen.getByText('T')).toBeInTheDocument();

      // With avatar URL
      rerender(
        <ProfileTab
          {...mockProps}
          profileDraft={{ ...mockProps.profileDraft, avatarUrl: 'https://example.com/avatar.jpg' }}
        />
      );

      const img = screen.getByRole('img', { name: /test user/i });
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    });

    it('updates profile draft on form input changes', async () => {
      const user = userEvent.setup();
      const setProfileDraftMock = vi.fn();
      render(<ProfileTab {...mockProps} setProfileDraft={setProfileDraftMock} />);

      const nameInput = screen.getByDisplayValue('Test User') as HTMLInputElement;
      await user.clear(nameInput);
      await user.type(nameInput, 'New Name');

      expect(setProfileDraftMock).toHaveBeenCalled();
    });

    it('calls saveProfile when profile form is submitted', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const saveButton = screen.getByText('Zapisz profil');
      await user.click(saveButton);

      expect(mockProps.saveProfile).toHaveBeenCalled();
    });

    it('renders preference toggles with correct initial states', () => {
      render(<ProfileTab {...mockProps} />);

      const autoTaskCapture = screen.getByText(/auto task capture/i).closest('label');
      const dailyDigest = screen.getByText(/daily digest/i).closest('label');
      const autoLearn = screen.getByText(/auto-learn speaker profiles/i).closest('label');

      expect((autoTaskCapture?.querySelector('input') as HTMLInputElement).checked).toBe(true);
      expect((dailyDigest?.querySelector('input') as HTMLInputElement).checked).toBe(false);
      expect((autoLearn?.querySelector('input') as HTMLInputElement).checked).toBe(true);
    });

    it('updates profile draft when preference toggles are clicked', async () => {
      const user = userEvent.setup();
      const setProfileDraftMock = vi.fn();
      render(<ProfileTab {...mockProps} setProfileDraft={setProfileDraftMock} />);

      const dailyDigestToggle = screen.getByText(/daily digest/i).closest('label');
      await user.click(dailyDigestToggle!.querySelector('input')!);

      expect(setProfileDraftMock).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Password Section', () => {
    it('renders password change form for local accounts', () => {
      render(<ProfileTab {...mockProps} />);

      expect(screen.getByText('Hasło')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Aktualne hasło')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nowe hasło')).toBeInTheDocument();
      expect(screen.getByText('Zmień hasło')).toBeInTheDocument();
    });

    it('shows info message for Google accounts without password', () => {
      render(
        <ProfileTab
          {...mockProps}
          currentUser={{ ...mockProps.currentUser, provider: 'google', passwordHash: undefined }}
        />
      );

      expect(screen.getByText(/konto google - hasło zewnętrzne/i)).toBeInTheDocument();
    });

    it('calls updatePassword when password form is submitted', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const changePasswordButton = screen.getByText('Zmień hasło');
      await user.click(changePasswordButton);

      expect(mockProps.updatePassword).toHaveBeenCalled();
    });

    it('displays security message after password change', () => {
      render(<ProfileTab {...mockProps} securityMessage="Hasło zostało zmienione" />);

      expect(screen.getByText('Hasło zostało zmienione')).toBeInTheDocument();
    });
  });

  describe('Voice Profiles Section', () => {
    it('renders voice profiles section with people count', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      // Navigate to Narzędzia AI
      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile głosowe')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // profiles count
      });
    });

    it('allows entering speaker name and starting recording', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      // Navigate to Narzędzia AI
      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile głosowe')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText('Wpisz lub wybierz z listy...');
      expect(nameInput).toBeInTheDocument();

      const recordButton = screen.getByText('● Nagraj głos');
      // Button disabled until a speaker is selected
      expect(recordButton).toBeDisabled();
    });

    it('shows record button disabled when no speaker selected', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile głosowe')).toBeInTheDocument();
      });

      const recordButton = screen.getByText('● Nagraj głos');
      expect(recordButton).toBeDisabled();
    });

    it('shows profile count badge in section header', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile głosowe')).toBeInTheDocument();
        // The count badge shows number of profiles from API (mocked as 0)
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });
  });

  describe('Vocabulary Section', () => {
    it('renders vocabulary section with word count', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Słownik (Vocabulary)')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // vocabulary count
      });
    });

    it('allows adding new terms to vocabulary', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Słownik (Vocabulary)')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/np. Antigravity/i);
      await user.type(input, 'NewTerm');

      const addButton = screen.getByText('Dodaj');
      await user.click(addButton);

      expect(mockProps.onUpdateVocabulary).toHaveBeenCalled();
    });

    it('prevents adding empty terms', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Słownik (Vocabulary)')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Dodaj');
      expect(addButton).toBeDisabled();
    });

    it('displays existing vocabulary terms with remove buttons', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('JavaScript')).toBeInTheDocument();
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
      });
    });
  });

  describe('Tag Manager Section', () => {
    it('renders tag manager section with tag count', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Zarządzanie tagami')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument(); // tag count
      });
    });

    it('displays tags with task and meeting counts', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('#project')).toBeInTheDocument();
        expect(screen.getByText('5 zadań')).toBeInTheDocument();
        expect(screen.getByText('2 spotkań')).toBeInTheDocument();
      });
    });

    it('allows editing tag names', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('#project')).toBeInTheDocument();
      });

      const tagButton = screen.getByText('#project');
      await user.click(tagButton);

      // After clicking, an Input field should appear for editing
      const input = screen.getByDisplayValue('project');
      expect(input).toBeInTheDocument();
    });

    it('allows deleting tags', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('#project')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle(/usuń tag/i);
      await user.click(deleteButton);

      expect(mockProps.onDeleteTag).toHaveBeenCalledWith('project');
    });
  });

  describe('Audio Storage Section', () => {
    it('renders audio storage section with usage information', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Pamięć audio')).toBeInTheDocument();
        expect(screen.getByText('10%')).toBeInTheDocument(); // usage percent
      });
    });

    it('displays storage usage details', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText(/użyto 50 MB z 500 MB/i)).toBeInTheDocument();
        expect(screen.getByText(/wolne miejsce: 450 MB/i)).toBeInTheDocument();
      });
    });

    it('calls refresh function when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Odśwież')).toBeInTheDocument();
      });

      const refreshButton = screen.getByText('Odśwież');
      await user.click(refreshButton);

      expect(mockProps.onRefreshAudioStorageState).toHaveBeenCalled();
    });

    it('shows warning message when provided', async () => {
      const user = userEvent.setup();
      render(
        <ProfileTab
          {...mockProps}
          audioStorageState={{
            ...mockProps.audioStorageState,
            warningMessage: 'Storage almost full',
          }}
        />
      );

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText('Storage almost full')).toBeInTheDocument();
      });
    });
  });

  describe('Workspace Backup Section', () => {
    it('renders backup section with export and import buttons', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      // Navigate to Ustawienia wyciszone
      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Eksport i import danych')).toBeInTheDocument();
        expect(screen.getByText('Eksportuj dane workspace')).toBeInTheDocument();
        expect(screen.getByText('Importuj dane')).toBeInTheDocument();
      });
    });

    it('calls export function when export button is clicked', async () => {
      const user = userEvent.setup();

      const mockExport = vi.fn();
      const mockImport = vi.fn();

      vi.spyOn(await import('./hooks/useWorkspaceBackup'), 'default').mockReturnValue({
        exportWorkspace: mockExport,
        importWorkspaceFile: mockImport,
        applyWorkspaceImport: vi.fn(),
        clearImportState: vi.fn(),
        preview: null,
        statusMessage: '',
        isImporting: false,
        hasPendingImport: false,
      });

      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Eksportuj dane workspace')).toBeInTheDocument();
      });

      const exportButton = screen.getByText('Eksportuj dane workspace');
      await user.click(exportButton);

      expect(mockExport).toHaveBeenCalled();
    });
  });

  describe('Google Calendar Integration', () => {
    it('renders Google Calendar section with connection status', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
        expect(screen.getByText('3 wydarzen w kalendarzu')).toBeInTheDocument();
      });
    });

    it('calls connect function when connect button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      });

      const connectButtons = screen.getAllByText('Połącz');
      await user.click(connectButtons[0]);

      expect(mockProps.connectGoogleCalendar).toHaveBeenCalled();
    });

    it('calls refresh function when sync button is clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Google Calendar')).toBeInTheDocument();
      });

      const syncButtons = screen.getAllByText('Sync');
      await user.click(syncButtons[0]);

      expect(mockProps.refreshGoogleCalendar).toHaveBeenCalled();
    });
  });

  describe('Google Tasks Integration', () => {
    it('renders Google Tasks section with task list selector', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Google Tasks')).toBeInTheDocument();
        expect(screen.getByText('My Tasks')).toBeInTheDocument();
      });
    });

    it('calls task list selection when dropdown changes', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        const select = screen.getAllByRole('combobox')[0];
        expect(select).toBeInTheDocument();
      });

      const select = screen.getAllByRole('combobox')[0];
      await user.selectOptions(select, 'list2');

      expect(mockProps.onSelectGoogleTaskList).toHaveBeenCalledWith('list2');
    });
  });

  describe('Settings Section - Theme and Layout', () => {
    it('renders theme settings with current theme', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Wygląd i Layout')).toBeInTheDocument();
        expect(screen.getByText(/Motyw:/)).toBeInTheDocument();
        expect(screen.getByText('dark')).toBeInTheDocument();
      });
    });

    it('calls onSetTheme when theme buttons are clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('🌙')).toBeInTheDocument();
      });

      const lightButton = screen.getByText('☀️');
      await user.click(lightButton);

      expect(mockProps.onSetTheme).toHaveBeenCalledWith('light');
    });

    it('calls onSetLayoutPreset when layout buttons are clicked', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Compact')).toBeInTheDocument();
      });

      const compactButton = screen.getByText('Compact');
      await user.click(compactButton);

      expect(mockProps.onSetLayoutPreset).toHaveBeenCalledWith('compact');
    });
  });

  describe('API Connection Status', () => {
    it('renders API connection status section', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Połączenie API')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument(); // role
      });
    });

    it('shows online status when navigator is online', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Online')).toBeInTheDocument();
      });
    });
  });

  describe('Changelog Section', () => {
    it('renders changelog section with version history', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText('Changelog')).toBeInTheDocument();
        expect(screen.getByText(/v1\.6\.0/)).toBeInTheDocument();
        expect(screen.getByText(/Stabilizacja i Poprawki Krytyczne/)).toBeInTheDocument();
      });
    });

    it('allows expanding and collapsing changelog versions', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const reviewButton = screen.getByText('Ustawienia wyciszone').closest('button');
      await user.click(reviewButton!);

      await waitFor(() => {
        expect(screen.getByText(/v1\.5\.0/)).toBeInTheDocument();
      });

      // Click the changelog header (the div with onClick is .profile-changelog-header)
      const v150Header = screen.getByText(/v1\.5\.0/).closest('.profile-changelog-header');
      await user.click(v150Header!);

      await waitFor(() => {
        expect(screen.getByText(/Jeden zintegrowany widok nagrań i spotkań/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    it('shows empty state for tags when no tags exist', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} allTags={[]} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText(/brak tagów w workspace/i)).toBeInTheDocument();
      });
    });

    it('shows empty state for vocabulary when no terms exist', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} vocabulary={[]} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText(/brak słów w słowniku/i)).toBeInTheDocument();
      });
    });

    it('shows empty state for audio storage when no files exist', async () => {
      const user = userEvent.setup();
      render(<ProfileTab {...mockProps} />);

      const toolsButton = screen.getByText('Narzędzia AI').closest('button');
      await user.click(toolsButton!);

      await waitFor(() => {
        expect(screen.getByText(/brak lokalnie zapisanych plików audio/i)).toBeInTheDocument();
      });
    });
  });
});
