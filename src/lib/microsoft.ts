/**
 * Microsoft Graph API Integration
 * Handles Outlook Calendar and Microsoft To Do integration
 */

export const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || '';
export const MICROSOFT_TENANT_ID = import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common';
export const MICROSOFT_REDIRECT_URI = import.meta.env.VITE_MICROSOFT_REDIRECT_URI || '';

const MICROSOFT_AUTHORITY = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}`;
// Scopes for Calendar and Tasks
export const CALENDAR_SCOPES = ['Calendars.ReadWrite', 'Calendars.Read'];
export const TASKS_SCOPES = ['Tasks.ReadWrite', 'Tasks.Read'];

export interface MicrosoftProfile {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string;
  organizer?: { emailAddress?: { name?: string; address?: string } };
}

export interface MicrosoftTaskList {
  id: string;
  name: string;
  isOwner?: boolean;
}

export interface MicrosoftTask {
  id: string;
  title: string;
  notes?: string;
  dueDateTime?: { dateTime?: string; timeZone?: string };
  isCompleted?: boolean;
  completedDateTime?: { dateTime?: string; timeZone?: string };
}

/**
 * Initialize Microsoft Authentication Library (MSAL)
 */
export async function initializeMsal() {
  if (!MICROSOFT_CLIENT_ID) {
    throw new Error('MICROSOFT_CLIENT_ID is not configured');
  }

  // Dynamic import to avoid bundling MSAL if not needed
  const { PublicClientApplication } = await import('@azure/msal-browser');

  const msalConfig = {
    auth: {
      clientId: MICROSOFT_CLIENT_ID,
      authority: MICROSOFT_AUTHORITY,
      redirectUri: MICROSOFT_REDIRECT_URI || window.location.origin,
    },
  };

  return new PublicClientApplication(msalConfig);
}

/**
 * Sign in to Microsoft and get access token
 */
export async function signInMicrosoft(
  msalInstance: any,
  scopes: string[] = [...CALENDAR_SCOPES, ...TASKS_SCOPES]
): Promise<string> {
  const loginResponse = await msalInstance.loginPopup({
    scopes,
  });

  return loginResponse.accessToken;
}

/**
 * Sign out from Microsoft
 */
export async function signOutMicrosoft(msalInstance: any): Promise<void> {
  await msalInstance.logoutPopup();
}

/**
 * Get Microsoft Graph access token
 */
export async function getMicrosoftAccessToken(
  msalInstance: any,
  scopes: string[]
): Promise<string> {
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length === 0) {
    throw new Error('No Microsoft account signed in');
  }

  const tokenResponse = await msalInstance.acquireTokenSilent({
    scopes,
    account: accounts[0],
  });

  return tokenResponse.accessToken;
}

/**
 * Fetch user profile from Microsoft Graph
 */
export async function fetchMicrosoftProfile(accessToken: string): Promise<MicrosoftProfile> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Microsoft Graph API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch calendar events from Outlook
 */
export async function fetchOutlookCalendarEvents(
  accessToken: string,
  options: { timeMin: string; timeMax: string }
): Promise<OutlookEvent[]> {
  const { timeMin, timeMax } = options;

  const url = new URL('https://graph.microsoft.com/v1.0/me/events');
  url.searchParams.append('startDateTime', timeMin);
  url.searchParams.append('endDateTime', timeMax);
  url.searchParams.append('$orderby', 'start/dateTime');
  url.searchParams.append('$top', '100');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Outlook Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Create calendar event in Outlook
 */
export async function createOutlookCalendarEvent(
  accessToken: string,
  event: {
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    body?: { contentType: string; content: string };
    isOnlineMeeting?: boolean;
  }
): Promise<OutlookEvent> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error(`Outlook Calendar create error: ${response.status}`);
  }

  return response.json();
}

/**
 * Update calendar event in Outlook
 */
export async function updateOutlookCalendarEvent(
  accessToken: string,
  eventId: string,
  updates: Partial<OutlookEvent>
): Promise<OutlookEvent> {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Outlook Calendar update error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch task lists from Microsoft To Do
 */
export async function fetchMicrosoftTaskLists(accessToken: string): Promise<MicrosoftTaskList[]> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/todo/lists', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Microsoft To Do API error: ${response.status}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Fetch tasks from a specific Microsoft To Do list
 */
export async function fetchMicrosoftTasks(
  accessToken: string,
  listId: string
): Promise<MicrosoftTask[]> {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Microsoft To Do API error: ${response.status}`);
  }

  const data = await response.json();
  return data.value || [];
}

/**
 * Create task in Microsoft To Do
 */
export async function createMicrosoftTask(
  accessToken: string,
  listId: string,
  task: {
    title: string;
    notes?: string;
    dueDateTime?: { dateTime: string; timeZone: string };
  }
): Promise<MicrosoftTask> {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error(`Microsoft To Do create error: ${response.status}`);
  }

  return response.json();
}

/**
 * Update task in Microsoft To Do
 */
export async function updateMicrosoftTask(
  accessToken: string,
  listId: string,
  taskId: string,
  updates: Partial<MicrosoftTask>
): Promise<MicrosoftTask> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${taskId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    throw new Error(`Microsoft To Do update error: ${response.status}`);
  }

  return response.json();
}

/**
 * Render Microsoft sign-in button
 */
export async function renderMicrosoftSignInButton(
  container: HTMLElement,
  onSignIn: (profile: MicrosoftProfile) => void
): Promise<void> {
  if (!MICROSOFT_CLIENT_ID) {
    container.innerHTML =
      '<div style="color: #666; padding: 10px;">Microsoft integration not configured</div>';
    return;
  }

  const msalInstance = await initializeMsal();
  await msalInstance.initialize();

  // Check if already logged in
  const accounts = msalInstance.getAllAccounts();

  if (accounts.length > 0) {
    // Already logged in, get profile
    const tokenResponse = await msalInstance.acquireTokenSilent({
      scopes: ['User.Read'],
      account: accounts[0],
    });

    const profile = await fetchMicrosoftProfile(tokenResponse.accessToken);
    onSignIn(profile);
    return;
  }

  // Render sign-in button
  container.innerHTML = `
    <button 
      id="microsoft-signin-btn"
      style="
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: #0078d4;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      "
    >
      <svg width="16" height="16" viewBox="0 0 23 23" fill="none">
        <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
        <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
        <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
        <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
      </svg>
      Sign in with Microsoft
    </button>
  `;

  const button = container.querySelector('#microsoft-signin-btn');
  if (button) {
    button.addEventListener('click', async () => {
      try {
        const tokenResponse = await signInMicrosoft(msalInstance);
        const profile = await fetchMicrosoftProfile(tokenResponse);
        onSignIn(profile);
      } catch (error) {
        console.error('Microsoft sign-in error:', error);
      }
    });
  }
}

/**
 * Request calendar access from user
 */
export async function requestOutlookCalendarAccess(accessToken: string): Promise<boolean> {
  // Already have access if we have a valid token
  return true;
}

/**
 * Request tasks access from user
 */
export async function requestMicrosoftTasksAccess(accessToken: string): Promise<boolean> {
  // Already have access if we have a valid token
  return true;
}
