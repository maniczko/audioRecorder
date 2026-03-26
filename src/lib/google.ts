const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

let googleScriptPromise = null;

// Vite replaces import.meta.env.* statically at build time — dynamic access
// (import.meta.env[key]) is NOT replaced in production bundles, so we read
// the known variable names directly.
export const GOOGLE_CLIENT_ID: string =
  (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string) ||
  (typeof process !== 'undefined' ? (process.env?.REACT_APP_GOOGLE_CLIENT_ID ?? '') : '') ||
  '';
export const IS_GOOGLE_DEMO_MODE = GOOGLE_CLIENT_ID === 'demo';

function loadGoogleScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services are not available on the server.'));
  }

  if (window.google?.accounts) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = window.document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google script.')));
      return;
    }

    const script = window.document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Failed to load Google script.'));
    window.document.head.appendChild(script);
  });

  return googleScriptPromise;
}

function decodeJwtPayload(token) {
  const base64Url = String(token || '').split('.')[1] || '';
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const decoded = window.atob(padded);
  return JSON.parse(decoded);
}

export async function renderGoogleSignInButton(container, callback) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'Missing Google Client ID (VITE_GOOGLE_CLIENT_ID or REACT_APP_GOOGLE_CLIENT_ID).'
    );
  }

  if (!container) {
    throw new Error('Missing Google button container.');
  }

  if (IS_GOOGLE_DEMO_MODE) {
    container.innerHTML = `
      <button type="button" class="google-demo-button">
        <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.78 2.16c1.63-1.5 2.57-3.7 2.57-6.3z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.78-2.16c-.77.52-1.76.83-2.93.83-2.25 0-4.16-1.52-4.84-3.58H1.58v2.24C3.06 16.17 5.8 18 9 18z"/><path fill="#FBBC05" d="M4.16 10.91c-.17-.52-.27-1.07-.27-1.66s.1-1.14.27-1.66V5.35H1.58C1.04 6.44.75 7.68.75 9s.29 2.56.83 3.65l2.58-2.09z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.88 11.43 0 9 0 5.8 0 3.06 1.83 1.58 4.76L4.16 7c.68-2.06 2.59-3.58 4.84-3.58z"/></svg>
        <span>Continue with Demo Google</span>
      </button>
    `;
    const btn = container.querySelector('.google-demo-button');
    btn.onclick = () => {
      callback(
        {
          email: 'demo.user@example.com',
          name: 'Demo User',
          picture: 'https://ui-avatars.com/api/?name=Demo+User&background=random',
          sub: 'demo-123',
        },
        { credential: 'mock-credential' }
      );
    };
    return;
  }

  const google = await loadGoogleScript();
  container.innerHTML = '';

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      callback(decodeJwtPayload(response.credential), response);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    text: 'continue_with',
    size: 'large',
    shape: 'pill',
    width: 280,
    logo_alignment: 'left',
  });
}

export async function requestGoogleCalendarAccess({ loginHint }: { loginHint?: string } = {}) {
  return requestGoogleAccess({
    loginHint,
    scope: CALENDAR_SCOPE,
  });
}

async function requestGoogleAccess({ loginHint, scope }: { loginHint?: string; scope: string }) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'Missing Google Client ID (VITE_GOOGLE_CLIENT_ID or REACT_APP_GOOGLE_CLIENT_ID).'
    );
  }

  if (IS_GOOGLE_DEMO_MODE) {
    return Promise.resolve({
      access_token: 'mock-google-token',
      expires_in: 3600,
      scope,
      token_type: 'Bearer',
    });
  }

  const google = await loadGoogleScript();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      prompt: 'consent',
      login_hint: loginHint || undefined,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      },
    });

    tokenClient.requestAccessToken();
  });
}

export async function requestGoogleTasksAccess({ loginHint }: { loginHint?: string } = {}) {
  return requestGoogleAccess({
    loginHint,
    scope: TASKS_SCOPE,
  });
}

export async function fetchPrimaryCalendarEvents(accessToken: string, { timeMin, timeMax }: { timeMin?: string; timeMax?: string }) {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '100',
    timeMin: timeMin || new Date().toISOString(),
  });

  if (timeMax) {
    params.set('timeMax', timeMax);
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Calendar API returned ${response.status}.`);
  }

  return response.json();
}

async function requestGoogleCalendar(accessToken: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar API returned ${response.status}.`);
  }

  return response.json();
}

function normalizeGoogleEventAttendees(attendees: any[] = []) {
  return (Array.isArray(attendees) ? attendees : [])
    .map((attendee) => ({
      email: String(attendee?.email || '').trim(),
      displayName: String(attendee?.displayName || '').trim(),
      responseStatus: attendee?.responseStatus || 'needsAction',
    }))
    .filter((attendee) => attendee.email);
}

export function buildGoogleCalendarEventPayload(entry: any, options: {
  attendees?: any[];
  reminders?: number[];
  summary?: string;
  description?: string;
  location?: string;
} = {}) {
  const attendees = normalizeGoogleEventAttendees(options.attendees);
  const reminders = Array.isArray(options.reminders)
    ? {
        useDefault: false,
        overrides: options.reminders.map((minutes) => ({
          method: 'popup',
          minutes: Number(minutes),
        })),
      }
    : undefined;

  return {
    summary: entry.title || options.summary || 'VoiceLog event',
    description: options.description || '',
    location: options.location || '',
    start: {
      dateTime: new Date(entry.startsAt).toISOString(),
    },
    end: {
      dateTime: new Date(entry.endsAt).toISOString(),
    },
    attendees,
    reminders,
  };
}

export async function createGoogleCalendarEvent(accessToken, event) {
  return requestGoogleCalendar(accessToken, '/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function updateGoogleCalendarEvent(accessToken, eventId, updates) {
  return requestGoogleCalendar(
    accessToken,
    `/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
}

export async function fetchGoogleTaskLists(accessToken: string) {
  const response = await fetch(
    'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=100',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Tasks API returned ${response.status} while loading task lists.`);
  }

  return response.json();
}

export async function fetchGoogleTasks(accessToken: string, taskListId: string) {
  const params = new URLSearchParams({
    showCompleted: 'true',
    showHidden: 'true',
    maxResults: '100',
  });
  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Google Tasks API returned ${response.status} while loading tasks.`);
  }

  return response.json();
}

export async function createGoogleTask(accessToken: string, taskListId: string, task: any) {
  const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error(`Google Tasks API returned ${response.status} while creating a task.`);
  }

  return response.json();
}

export async function updateGoogleTask(accessToken: string, taskListId: string, taskId: string, updates: any) {
  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`,
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
    throw new Error(`Google Tasks API returned ${response.status} while updating a task.`);
  }

  return response.json();
}

export function signOutGoogleSession() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (window.google?.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch (error) {
    console.error('Unable to disable Google auto-select.', error);
  }
}
