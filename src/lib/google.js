const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

let googleScriptPromise = null;

export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";

function loadGoogleScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Identity Services are not available on the server."));
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
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script.")));
      return;
    }

    const script = window.document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google script."));
    window.document.head.appendChild(script);
  });

  return googleScriptPromise;
}

function decodeJwtPayload(token) {
  const base64Url = String(token || "").split(".")[1] || "";
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const decoded = window.atob(padded);
  return JSON.parse(decoded);
}

export async function renderGoogleSignInButton(container, callback) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Missing REACT_APP_GOOGLE_CLIENT_ID.");
  }

  if (!container) {
    throw new Error("Missing Google button container.");
  }

  const google = await loadGoogleScript();
  container.innerHTML = "";

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      callback(decodeJwtPayload(response.credential), response);
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    text: "continue_with",
    size: "large",
    shape: "pill",
    width: 280,
    logo_alignment: "left",
  });
}

export async function requestGoogleCalendarAccess({ loginHint } = {}) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Missing REACT_APP_GOOGLE_CLIENT_ID.");
  }

  const google = await loadGoogleScript();

  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: CALENDAR_SCOPE,
      prompt: "consent",
      login_hint: loginHint || undefined,
      callback: (response) => {
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

export async function fetchPrimaryCalendarEvents(accessToken, { timeMin, timeMax }) {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
    timeMin: timeMin || new Date().toISOString(),
  });

  if (timeMax) {
    params.set("timeMax", timeMax);
  }

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Google Calendar API returned ${response.status}.`);
  }

  return response.json();
}

export function signOutGoogleSession() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.google?.accounts?.id?.disableAutoSelect();
  } catch (error) {
    console.error("Unable to disable Google auto-select.", error);
  }
}
