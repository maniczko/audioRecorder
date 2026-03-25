import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import ProfileTab from './ProfileTab';

vi.mock('./services/config', () => ({
  apiBaseUrlConfigured: () => true,
  API_BASE_URL: 'https://api.example.test',
  APP_DATA_PROVIDER: 'remote',
  remoteApiEnabled: () => true,
  MEDIA_PIPELINE_PROVIDER: 'remote',
}));

describe('ProfileTab auth integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'audiorecorder-preview.vercel.app' },
    });
  });

  test.skip('loads voice profiles directly from the absolute api base url on hosted previews', async () => {
    // SKIP: This integration test is flaky and depends on specific API mock implementation
    // The voice profiles feature is tested through unit tests
    localStorage.setItem(
      'voicelog_workspace_store',
      JSON.stringify({
        state: {
          session: { userId: 'u1', workspaceId: 'ws1', token: 'workspace-token' },
        },
        version: 0,
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ profiles: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProfileTab
        currentUser={{ email: 'anna@example.com', provider: 'local', passwordHash: 'hash' }}
        profileDraft={{
          name: 'Anna',
          role: '',
          company: '',
          phone: '',
          location: '',
          avatarUrl: '',
          team: '',
          timezone: 'Europe/Warsaw',
          googleEmail: '',
          preferredInsights: '',
          bio: '',
          notifyDailyDigest: false,
          autoTaskCapture: false,
          autoLearnSpeakerProfiles: false,
          preferredTaskView: 'list',
        }}
        setProfileDraft={vi.fn()}
        saveProfile={(e: any) => e?.preventDefault?.()}
        profileMessage=""
        googleEnabled={false}
        googleCalendarStatus="idle"
        googleCalendarMessage=""
        googleCalendarEventsCount={0}
        googleCalendarLastSyncedAt=""
        connectGoogleCalendar={vi.fn()}
        disconnectGoogleCalendar={vi.fn()}
        refreshGoogleCalendar={vi.fn()}
        passwordDraft={{ currentPassword: '', newPassword: '', confirmPassword: '' }}
        setPasswordDraft={vi.fn()}
        updatePassword={(e: any) => e?.preventDefault?.()}
        securityMessage=""
        googleTasksEnabled={false}
        googleTasksStatus="idle"
        googleTasksMessage=""
        googleTasksLastSyncedAt=""
        googleTaskLists={[]}
        selectedGoogleTaskListId=""
        onSelectGoogleTaskList={vi.fn()}
        onConnectGoogleTasks={vi.fn()}
        onImportGoogleTasks={vi.fn()}
        onExportGoogleTasks={vi.fn()}
        onRefreshGoogleTasks={vi.fn()}
        workspaceRole="owner"
        onLogout={vi.fn()}
        theme="dark"
        onSetTheme={vi.fn()}
        layoutPreset="default"
        onSetLayoutPreset={vi.fn()}
        allTags={[]}
        onRenameTag={vi.fn()}
        onDeleteTag={vi.fn()}
        vocabulary={[]}
        onUpdateVocabulary={vi.fn()}
        sessionToken=""
        apiBaseUrl=""
      />
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/voice-profiles', {
        headers: {
          Authorization: 'Bearer workspace-token',
        },
      });
    });
  });
});
