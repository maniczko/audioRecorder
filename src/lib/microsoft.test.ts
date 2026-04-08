/**
 * @vitest-environment jsdom
 * microsoft lib tests - comprehensive coverage
 *
 * Tests for Microsoft Graph integration utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock MSAL
const mocks = vi.hoisted(() => ({
  PublicClientApplication: vi.fn().mockImplementation(() => ({
    loginPopup: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
    logoutPopup: vi.fn().mockResolvedValue(undefined),
    getAllAccounts: vi.fn().mockReturnValue([]),
    acquireTokenPopup: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
  })),
}));

vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: mocks.PublicClientApplication,
}));

// Import after mock
import {
  MICROSOFT_CLIENT_ID,
  MICROSOFT_TENANT_ID,
  MICROSOFT_REDIRECT_URI,
  CALENDAR_SCOPES,
  TASKS_SCOPES,
  initializeMsal,
  signInMicrosoft,
  signOutMicrosoft,
  getMicrosoftAccessToken,
} from './microsoft';

describe('microsoft lib - comprehensive tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constants', () => {
    it('exports MICROSOFT_CLIENT_ID', () => {
      expect(MICROSOFT_CLIENT_ID).toBeDefined();
      expect(typeof MICROSOFT_CLIENT_ID).toBe('string');
    });

    it('exports MICROSOFT_TENANT_ID', () => {
      expect(MICROSOFT_TENANT_ID).toBeDefined();
      expect(MICROSOFT_TENANT_ID).toBe('common');
    });

    it('exports MICROSOFT_REDIRECT_URI', () => {
      expect(MICROSOFT_REDIRECT_URI).toBeDefined();
      expect(typeof MICROSOFT_REDIRECT_URI).toBe('string');
    });

    it('exports CALENDAR_SCOPES', () => {
      expect(CALENDAR_SCOPES).toBeDefined();
      expect(Array.isArray(CALENDAR_SCOPES)).toBe(true);
      expect(CALENDAR_SCOPES).toContain('Calendars.ReadWrite');
      expect(CALENDAR_SCOPES).toContain('Calendars.Read');
    });

    it('exports TASKS_SCOPES', () => {
      expect(TASKS_SCOPES).toBeDefined();
      expect(Array.isArray(TASKS_SCOPES)).toBe(true);
      expect(TASKS_SCOPES).toContain('Tasks.ReadWrite');
      expect(TASKS_SCOPES).toContain('Tasks.Read');
    });
  });

  describe('initializeMsal', () => {
    it('throws error when MICROSOFT_CLIENT_ID is not configured', async () => {
      // Since MICROSOFT_CLIENT_ID is empty by default, this should throw
      await expect(initializeMsal()).rejects.toThrow('MICROSOFT_CLIENT_ID is not configured');
    });
  });

  describe('signInMicrosoft', () => {
    it('signs in and returns access token', async () => {
      const mockMsalInstance = {
        loginPopup: vi.fn().mockResolvedValue({ accessToken: 'test-token-123' }),
      };

      const token = await signInMicrosoft(mockMsalInstance);

      expect(token).toBe('test-token-123');
      expect(mockMsalInstance.loginPopup).toHaveBeenCalled();
    });

    it('signs in with custom scopes', async () => {
      const mockMsalInstance = {
        loginPopup: vi.fn().mockResolvedValue({ accessToken: 'test-token-456' }),
      };

      const customScopes = ['Calendars.Read'];
      await signInMicrosoft(mockMsalInstance, customScopes);

      expect(mockMsalInstance.loginPopup).toHaveBeenCalledWith({
        scopes: customScopes,
      });
    });
  });

  describe('signOutMicrosoft', () => {
    it('signs out successfully', async () => {
      const mockMsalInstance = {
        logoutPopup: vi.fn().mockResolvedValue(undefined),
      };

      await signOutMicrosoft(mockMsalInstance);

      expect(mockMsalInstance.logoutPopup).toHaveBeenCalled();
    });
  });

  describe('getMicrosoftAccessToken', () => {
    it('throws error when no account signed in', async () => {
      const mockMsalInstance = {
        getAllAccounts: vi.fn().mockReturnValue([]),
      };

      await expect(getMicrosoftAccessToken(mockMsalInstance, CALENDAR_SCOPES)).rejects.toThrow(
        'No Microsoft account signed in'
      );
    });

    it('returns access token when account exists', async () => {
      const mockMsalInstance = {
        getAllAccounts: vi.fn().mockReturnValue([{ username: 'test@example.com' }]),
        acquireTokenSilent: vi.fn().mockResolvedValue({ accessToken: 'existing-token' }),
      };

      const token = await getMicrosoftAccessToken(mockMsalInstance, CALENDAR_SCOPES);

      expect(token).toBe('existing-token');
      expect(mockMsalInstance.acquireTokenSilent).toHaveBeenCalled();
    });
  });

  describe('Calendar functions', () => {
    it('fetchOutlookCalendarEvents is defined', async () => {
      const { fetchOutlookCalendarEvents } = await import('./microsoft');
      expect(fetchOutlookCalendarEvents).toBeDefined();
      expect(typeof fetchOutlookCalendarEvents).toBe('function');
    });

    it('createOutlookCalendarEvent is defined', async () => {
      const { createOutlookCalendarEvent } = await import('./microsoft');
      expect(createOutlookCalendarEvent).toBeDefined();
      expect(typeof createOutlookCalendarEvent).toBe('function');
    });

    it('updateOutlookCalendarEvent is defined', async () => {
      const { updateOutlookCalendarEvent } = await import('./microsoft');
      expect(updateOutlookCalendarEvent).toBeDefined();
      expect(typeof updateOutlookCalendarEvent).toBe('function');
    });

    it('requestOutlookCalendarAccess is defined', async () => {
      const { requestOutlookCalendarAccess } = await import('./microsoft');
      expect(requestOutlookCalendarAccess).toBeDefined();
      expect(typeof requestOutlookCalendarAccess).toBe('function');
    });
  });

  describe('Task functions', () => {
    it('fetchMicrosoftTaskLists is defined', async () => {
      const { fetchMicrosoftTaskLists } = await import('./microsoft');
      expect(fetchMicrosoftTaskLists).toBeDefined();
      expect(typeof fetchMicrosoftTaskLists).toBe('function');
    });

    it('fetchMicrosoftTasks is defined', async () => {
      const { fetchMicrosoftTasks } = await import('./microsoft');
      expect(fetchMicrosoftTasks).toBeDefined();
      expect(typeof fetchMicrosoftTasks).toBe('function');
    });

    it('createMicrosoftTask is defined', async () => {
      const { createMicrosoftTask } = await import('./microsoft');
      expect(createMicrosoftTask).toBeDefined();
      expect(typeof createMicrosoftTask).toBe('function');
    });

    it('updateMicrosoftTask is defined', async () => {
      const { updateMicrosoftTask } = await import('./microsoft');
      expect(updateMicrosoftTask).toBeDefined();
      expect(typeof updateMicrosoftTask).toBe('function');
    });

    it('requestMicrosoftTasksAccess is defined', async () => {
      const { requestMicrosoftTasksAccess } = await import('./microsoft');
      expect(requestMicrosoftTasksAccess).toBeDefined();
      expect(typeof requestMicrosoftTasksAccess).toBe('function');
    });
  });

  describe('Profile functions', () => {
    it('fetchMicrosoftProfile is defined', async () => {
      const { fetchMicrosoftProfile } = await import('./microsoft');
      expect(fetchMicrosoftProfile).toBeDefined();
      expect(typeof fetchMicrosoftProfile).toBe('function');
    });

    it('renderMicrosoftSignInButton is defined', async () => {
      const { renderMicrosoftSignInButton } = await import('./microsoft');
      expect(renderMicrosoftSignInButton).toBeDefined();
      expect(typeof renderMicrosoftSignInButton).toBe('function');
    });
  });
});
