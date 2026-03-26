/**
 * Google API Type Definitions
 */

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (input: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
    onGoogleLibraryLoad?: () => void;
  }
}

export interface GoogleAuthResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start?: { dateTime: string; timeZone?: string };
  end?: { dateTime: string; timeZone?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
  created?: string;
  updated?: string;
  status?: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  position?: string;
  etag?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
  etag?: string;
}

export interface GoogleCalendarOptions {
  loginHint?: string;
  scope?: string;
}

export interface GoogleTasksOptions {
  loginHint?: string;
  scope?: string;
}

export interface GoogleEventCreateOptions {
  title?: string;
  description?: string;
  location?: string;
  attendees?: string[];
  reminders?: number[];
  startTime?: string;
  endTime?: string;
}

export {};
