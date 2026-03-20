import { describe, test, expect, vi } from 'vitest';
import { buildPeopleProfiles } from './people';

describe('buildPeopleProfiles', () => {
  const mockCurrentUser = {
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    timezone: 'Europe/Warsaw'
  };

  const mockMeetings = [
    {
      id: 'm1',
      title: 'Meeting 1',
      startsAt: '2026-03-20T10:00:00Z',
      attendees: ['Jan Kowalski', 'Anna Nowak', 'Marek'],
      needs: ['Czego potrzebujemy?'],
      desiredOutputs: ['Plan'],
      context: 'Omówienie projektu X',
      speakerNames: { '0': 'Jan Kowalski', '1': 'Anna Nowak' },
      tags: ['projekt-x']
    },
    {
      id: 'm2',
      title: 'Meeting 2',
      startsAt: '2026-03-21T14:00:00Z',
      attendees: ['Jan Kowalski', 'Sławek'],
      needs: ['Budżet'],
      desiredOutputs: ['Zatwierdzenie'],
      context: 'Biznesowy temat rynkowy',
      speakerNames: { '0': 'Jan Kowalski', '1': 'Sławek' },
      tags: ['finanse']
    }
  ];

  const mockTasks = [
    { id: 't1', title: 'Task 1', owner: 'Anna Nowak', completed: false, tags: ['task-tag'] },
    { id: 't2', title: 'Task 2', owner: 'Jan Kowalski', completed: true },
    { id: 't3', title: 'Task 3', owner: 'Jan Kowalski', completed: false }
  ];

  const mockWorkspaceMembers = [
    { name: 'Anna Nowak', email: 'anna@example.com', timezone: 'Europe/Warsaw' },
    { name: 'Sławek', email: 'slawek@example.com', timezone: 'Europe/Berlin' }
  ];

  test('should return empty array if no input data', () => {
    const result = buildPeopleProfiles([], [], null, []);
    expect(result).toEqual([]);
  });

  test('should unique names and build profiles', () => {
    const result = buildPeopleProfiles(mockMeetings, mockTasks, mockCurrentUser, mockWorkspaceMembers);
    
    // Unique identities result in 6 profiles (Names + Emails from members)
    expect(result.length).toBe(6);
    
    const names = result.map(p => p.name);
    expect(names).toContain('Jan Kowalski');
    expect(names).toContain('Anna Nowak');
    expect(names).toContain('Marek');
    expect(names).toContain('Sławek');
    expect(names).toContain('anna@example.com');
  });

  test('should calculate correct task counts', () => {
    const result = buildPeopleProfiles(mockMeetings, mockTasks, mockCurrentUser, mockWorkspaceMembers);
    
    const jan = result.find(p => p.name === 'Jan Kowalski');
    expect(jan.completedTasks).toBe(1);
    expect(jan.openTasks).toBe(1);
    expect(jan.tasks).toHaveLength(2);

    const anna = result.find(p => p.name === 'Anna Nowak');
    expect(anna.completedTasks).toBe(0);
    expect(anna.openTasks).toBe(1);
    expect(anna.tasks).toHaveLength(1);
  });

  test('should infer traits correctly with Polish characters', () => {
    // Adding more tasks for Anna to test trait "czesto przejmuje ownership"
    const moreTasks = [
      ...mockTasks,
      { id: 't4', title: 'Task 4', owner: 'Anna Nowak', completed: false },
      { id: 't5', title: 'Task 5', owner: 'Anna Nowak', completed: false },
      { id: 't6', title: 'Task 6', owner: 'Anna Nowak', completed: false }
    ];

    const result = buildPeopleProfiles(mockMeetings, moreTasks, mockCurrentUser, mockWorkspaceMembers);
    
    const anna = result.find(p => p.name === 'Anna Nowak');
    expect(anna.traits).toContain('czesto przejmuje ownership i follow-upy');

    // Sławek has "Budżet" in needs which should trigger the trait
    const slawek = result.find(p => p.name === 'Sławek');
    expect(slawek.traits).toContain('patrzy na decyzje przez pryzmat kosztu i zakresu');
  });

  test('should create summary string using Polish marks and reverse chronological order', () => {
    const result = buildPeopleProfiles(mockMeetings, mockTasks, mockCurrentUser, mockWorkspaceMembers);
    
    const jan = result.find(p => p.name === 'Jan Kowalski');
    // Jan's meetings are sorted reverse-chronologically. 
    // M2 (Mar 21) is first, M1 (Mar 20) is second.
    // firstNeed = M2.needs[0] = "Budżet"
    // firstOutput = M2.desiredOutputs[0] = "Zatwierdzenie"
    // firstTrait = "pilnuje planu i terminów" (from 'Plan' in M1's outputs - signals are joined from all meetings)
    
    const expected = 'Jan Kowalski pilnuje planu i terminów. Najczęściej oczekuje: Budżet. Po spotkaniach najbardziej liczą się dla tej osoby: Zatwierdzenie.';
    expect(jan.summary).toBe(expected);
  });

  test('should handle slugified IDs with Polish characters', () => {
    const result = buildPeopleProfiles([], [], { name: 'Łukasz Żółć' }, []);
    const lukasz = result.find(p => p.name === 'Łukasz Żółć');
    expect(lukasz.id).toBe('lukasz-zolc');
  });

  test('should sort profiles by activity (meetings * 2 + tasks)', () => {
    const result = buildPeopleProfiles(mockMeetings, mockTasks, mockCurrentUser, mockWorkspaceMembers);
    
    // Jan: 2 meetings * 2 + 2 tasks = 6
    // Anna: 1 meeting * 2 + 1 task = 3
    expect(result[0].name).toBe('Jan Kowalski');
    expect(result[1].name).toBe('Anna Nowak');
  });

  test('should match timezone from workspace members or current user', () => {
    const result = buildPeopleProfiles(mockMeetings, mockTasks, mockCurrentUser, mockWorkspaceMembers);
    
    const jan = result.find(p => p.name === 'Jan Kowalski');
    expect(jan.timezone).toBe('Europe/Warsaw');

    const slawek = result.find(p => p.name === 'Sławek');
    expect(slawek.timezone).toBe('Europe/Berlin');
  });

  test('should find next meeting in the future', () => {
    vi.useFakeTimers();
    const systemNow = '2026-03-21T00:00:00Z';
    vi.setSystemTime(new Date(systemNow));
    
    const result = buildPeopleProfiles(mockMeetings, mockTasks, mockCurrentUser, mockWorkspaceMembers);
    
    const jan = result.find(p => p.name === 'Jan Kowalski');
    expect(jan.nextMeeting.id).toBe('m2');
    
    vi.useRealTimers();
  });
});
