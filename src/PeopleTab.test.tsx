import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import PeopleTab from './PeopleTab';

describe('PeopleTab directory view', () => {
  const mockProfiles = [
    {
      id: 'person_iwo',
      name: 'Iwo',
      summary: 'Uczestnik spotkań roboczych',
      meetings: [{ id: 'm1', title: 'Spotkanie projektowe', startsAt: '2026-06-14T10:00:00Z' }],
      tasks: [],
      traits: [],
      tags: ['ad-hoc', 'ustalenia', 'operacyjne'],
      needs: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 0,
      assignedToMe: true,
      observed: true,
      psychProfile: { meetingsAnalyzed: 8 },
    },
    {
      id: 'person_marta',
      name: 'Marta Kowalska',
      summary: 'Uczestnik spotkań roboczych',
      meetings: [{ id: 'm2', title: 'Planowanie', startsAt: '2026-06-12T09:00:00Z' }],
      tasks: [],
      traits: [],
      tags: ['klient', 'planowanie'],
      needs: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 0,
      assignedToMe: false,
      observed: false,
      psychProfile: { meetingsAnalyzed: 5 },
    },
    {
      id: 'person_anna',
      name: 'Anna Wisniewska',
      summary: 'Uczestnik spotkań roboczych',
      meetings: [{ id: 'm3', title: 'Status', startsAt: '2026-06-05T09:00:00Z' }],
      tasks: [],
      traits: [],
      tags: ['operacyjne'],
      needs: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 0,
      assignedToMe: false,
      observed: false,
    },
    {
      id: 'person_unassigned',
      name: 'Nieprzypisane',
      summary: 'Uczestnik spotkań roboczych',
      meetings: [],
      tasks: [],
      traits: [],
      tags: ['ad-hoc', 'ustalenia'],
      needs: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 0,
      assignedToMe: false,
      observed: false,
      unassigned: true,
    },
  ];

  const defaultProps = {
    profiles: mockProfiles,
    onOpenMeeting: vi.fn(),
    onOpenTask: vi.fn(),
    onCreateTask: vi.fn(),
    onCreateMeeting: vi.fn(),
    onUpdatePersonNotes: vi.fn(),
    onAddPerson: vi.fn(),
    onRenamePerson: vi.fn(),
    onDeletePerson: vi.fn(),
    onAnalyzePersonProfile: vi.fn(),
    externalSelectedPersonId: '',
    onPersonSelectionHandled: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the people directory shell with views, filters and full-width list', () => {
    render(<PeopleTab {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Osoby' })).toBeInTheDocument();
    expect(screen.getByText('Zarządzaj uczestnikami i ich profilami AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wszystkie osoby/i })).toBeInTheDocument();
    const filters = screen.getByRole('toolbar', { name: /Filtry osób/i });
    expect(within(filters).getByRole('button', { name: /Profil AI aktywny/i })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: /Nieprzypisane/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dodaj osobę/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /Podgląd profilu/i })
    ).not.toBeInTheDocument();
  });

  test('filters people by search across name, tags, role and AI status', async () => {
    render(<PeopleTab {...defaultProps} />);
    const input = screen.getByRole('searchbox', { name: /Szukaj osób/i });

    await userEvent.type(input, 'klient');

    const list = screen.getByRole('list', { name: /Lista osób/i });
    expect(within(list).getByText('Marta Kowalska')).toBeInTheDocument();
    expect(within(list).queryByText('Iwo')).not.toBeInTheDocument();
  });

  test('applies profile and unassigned filter chips', async () => {
    render(<PeopleTab {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /Profil AI aktywny/i }));
    let list = screen.getByRole('list', { name: /Lista osób/i });
    expect(within(list).getByText('Iwo')).toBeInTheDocument();
    expect(within(list).queryByText('Anna Wisniewska')).not.toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('toolbar', { name: /Filtry osób/i })).getByRole('button', {
        name: /Nieprzypisane/i,
      })
    );
    list = screen.getByRole('list', { name: /Lista osób/i });
    expect(within(list).getByText('Nieprzypisane')).toBeInTheDocument();
    expect(within(list).queryByText('Iwo')).not.toBeInTheDocument();
  });

  test('opens person details directly from mouse and keyboard selection', async () => {
    render(<PeopleTab {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /Marta Kowalska/i }));
    expect(screen.getByRole('button', { name: /Wróć do listy osób/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marta Kowalska' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Wróć do listy osób/i }));

    const annaCard = screen.getByRole('button', { name: /Anna Wisniewska/i });
    annaCard.focus();
    fireEvent.keyDown(annaCard, { key: 'Enter' });

    expect(screen.getByRole('heading', { name: 'Anna Wisniewska' })).toBeInTheDocument();
  });

  test('opens the full person detail layout from a person card and returns to the list', async () => {
    render(<PeopleTab {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /Marta Kowalska/i }));

    expect(screen.getByRole('button', { name: /Wróć do listy osób/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marta Kowalska' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profil AI' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Historia spotkań' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zadania tej osoby' })).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /Podgląd profilu/i })
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Wróć do listy osób/i }));

    expect(screen.getByRole('heading', { name: 'Osoby' })).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: /Podgląd profilu/i })
    ).not.toBeInTheDocument();
  });

  test('supports edit, AI management and delete actions in person details', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PeopleTab {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /Iwo/i }));
    await userEvent.click(screen.getByRole('button', { name: /Edytuj profil/i }));

    const nameInput = screen.getByLabelText(/Nazwa osoby/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Iwo Nowy');
    await userEvent.click(screen.getByRole('button', { name: /Zapisz/i }));

    expect(defaultProps.onRenamePerson).toHaveBeenCalledWith('person_iwo', 'Iwo Nowy');
    expect(screen.getByText(/Zapisano zmiany profilu/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Zarządzaj AI/i }));
    expect(defaultProps.onAnalyzePersonProfile).toHaveBeenCalledWith('person_iwo');

    await userEvent.click(screen.getByRole('button', { name: /Usuń osobę/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(defaultProps.onDeletePerson).toHaveBeenCalledWith('person_iwo');
    confirmSpy.mockRestore();
  });

  test('Regression: delete person failure keeps details open and shows error state', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeletePerson = vi.fn(() => {
      throw new Error('delete failed');
    });

    render(<PeopleTab {...defaultProps} onDeletePerson={onDeletePerson} />);

    await userEvent.click(screen.getByRole('button', { name: /Iwo/i }));
    await userEvent.click(screen.getByRole('button', { name: /Usuń osobę/i }));

    expect(onDeletePerson).toHaveBeenCalledWith('person_iwo');
    expect(screen.getByRole('heading', { name: 'Iwo' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Nie udało się usunąć osoby/i);
    expect(screen.queryByRole('heading', { name: 'Osoby' })).not.toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  test('opens add person modal from the directory action', async () => {
    render(<PeopleTab {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', { name: /Dodaj osobę/i }));
    expect(screen.getByRole('dialog', { name: /Dodaj osobę/i })).toBeInTheDocument();
  });

  test('shows empty state when filters return no people', async () => {
    render(<PeopleTab {...defaultProps} />);

    await userEvent.type(screen.getByRole('searchbox', { name: /Szukaj osób/i }), 'brak wyniku');

    expect(screen.getByText('Nie znaleziono osób')).toBeInTheDocument();
    expect(screen.getByText('Zmień filtry albo dodaj nową osobę.')).toBeInTheDocument();
  });

  test('uses reference mock people when backend profiles are empty', () => {
    render(<PeopleTab {...defaultProps} profiles={[]} />);

    expect(screen.getByRole('button', { name: /Iwo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tomasz Zając/i })).toBeInTheDocument();
  });

  test('external selected person opens that person and marks selection handled', () => {
    render(<PeopleTab {...defaultProps} externalSelectedPersonId="person_marta" />);

    expect(screen.getByRole('button', { name: /Wróć do listy osób/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marta Kowalska' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profil AI' })).toBeInTheDocument();
    expect(defaultProps.onPersonSelectionHandled).toHaveBeenCalled();
  });
});
