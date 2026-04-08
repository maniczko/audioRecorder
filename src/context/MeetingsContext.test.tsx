import { describe, expect, test, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { MeetingsProvider, useMeetingsCtx } from './MeetingsContext';

// Import the mock from setupTests to verify it's working
// The global mock in setupTests.ts returns empty userMeetings by default

describe('MeetingsContext', () => {
  test('provides meetings hook result to descendants', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MeetingsProvider>{children}</MeetingsProvider>
    );
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    // Global mock returns empty userMeetings by default
    expect(result.current.meetings.userMeetings).toEqual([]);
    expect(result.current.meetings.selectedMeeting).toBeNull();
    expect(result.current.meetings.isHydratingRemoteState).toBe(false);
  });

  test('exposes create and mutation methods that delegate to hook', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MeetingsProvider>{children}</MeetingsProvider>
    );
    const { result } = renderHook(() => useMeetingsCtx(), { wrapper });

    // createAdHocMeeting is mocked to return { id: 'mock-meeting' }
    const created = result.current.meetings.createAdHocMeeting();
    expect(created).toEqual({ id: 'mock-meeting' });

    // All mutation methods should be defined (mocked as vi.fn())
    expect(result.current.meetings.deleteMeeting).toBeDefined();
    expect(result.current.meetings.updateMeeting).toBeDefined();
    expect(result.current.meetings.selectMeeting).toBeDefined();
    expect(result.current.meetings.setMeetings).toBeDefined();
  });

  test('returns safe defaults when useMeetingsCtx is called outside provider', () => {
    const { result } = renderHook(() => useMeetingsCtx());
    expect(result.current.meetings).toBeDefined();
    expect(result.current.meetings.userMeetings).toEqual([]);
    expect(result.current.meetings.selectedMeeting).toBeNull();
  });
});
