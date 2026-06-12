import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import PeopleTab from './PeopleTab';

describe('PeopleTab', () => {
  const mockProfiles = [
    {
      id: 'person_1',
      name: 'Anna Nowak',
      summary: 'Project Manager in Warsaw',
      meetings: [{ id: 'm1', title: 'Sync', startsAt: '2026-03-18T10:00:00Z' }],
      tasks: [
        {
          id: 't1',
          title: 'Prepare report',
          status: 'todo',
          priority: 'high',
          completed: false,
          tags: ['urgent'],
        },
      ],
      traits: ['Organized', 'Communicative'],
      tags: ['PM', 'Warsaw'],
      needs: ['Clear goals'],
      outputs: ['Monthly report'],
      openTasks: 1,
      completedTasks: 0,
    },
    {
      id: 'person_2',
      name: 'Jan Kowalski',
      summary: 'Lead Developer',
      meetings: [],
      tasks: [],
      traits: [],
      tags: ['Dev'],
      needs: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 5,
    },
    {
      id: 'manual_barbara',
      name: 'Barbara Zynda',
      summary: 'Manual person',
      meetings: [],
      tasks: [],
      traits: [],
      tags: [],
      needs: [],
      concerns: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 0,
      manual: true,
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

  test('renders profile sidebar and selected person details', async () => {
    render(<PeopleTab {...defaultProps} />);
    expect(screen.getAllByText('Anna Nowak').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jan Kowalski').length).toBeGreaterThan(0);

    // Check main panel (Anna should be selected by default)
    expect(screen.getByRole('heading', { name: 'Anna Nowak' })).toBeInTheDocument();
  });

  test('filters people list by search query', async () => {
    render(<PeopleTab {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Szukaj po imieniu/i);

    fireEvent.change(searchInput, { target: { value: 'Jan' } });

    expect(screen.queryByText('Anna Nowak')).not.toBeInTheDocument();
    expect((await screen.findAllByText('Jan Kowalski'))[0]).toBeInTheDocument();
  });

  test('switches between people when sidebar item is clicked', async () => {
    render(<PeopleTab {...defaultProps} />);
    const janText = screen.getByText('Jan Kowalski');
    const janBtn = janText.closest('button');

    fireEvent.click(janBtn);

    expect(screen.getByRole('heading', { name: 'Jan Kowalski' })).toBeInTheDocument();
  });

  test('adds a new need for the selected person', () => {
    render(<PeopleTab {...defaultProps} />);

    // Find add need button
    const addBtn = screen.getByTitle('Dodaj potrzebę');
    fireEvent.click(addBtn);

    const input = screen.getByPlaceholderText(/np. Jasne priorytety/i);
    fireEvent.change(input, { target: { value: 'Quiet space' } });
    fireEvent.submit(input);

    expect(defaultProps.onUpdatePersonNotes).toHaveBeenCalledWith(
      'person_1',
      expect.objectContaining({
        needs: ['Clear goals', 'Quiet space'],
      })
    );
  });

  test('adds a manual person from sidebar form', () => {
    defaultProps.onAddPerson.mockReturnValueOnce({ id: 'manual_ewa', name: 'Ewa Test' });
    render(<PeopleTab {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText(/Barbara Zynda/i), {
      target: { value: 'Ewa Test' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Barbara Zynda/i).closest('form')!);

    expect(defaultProps.onAddPerson).toHaveBeenCalledWith({ name: 'Ewa Test' });
  });

  test('renames selected person from hero editor', () => {
    defaultProps.onRenamePerson.mockReturnValueOnce({ id: 'person_1', name: 'Anna Premium' });
    render(<PeopleTab {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Edytuj profil/i }));
    fireEvent.change(screen.getByLabelText('Nazwa osoby'), {
      target: { value: 'Anna Premium' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz' }));

    expect(defaultProps.onRenamePerson).toHaveBeenCalledWith('person_1', 'Anna Premium');
  });

  test('renders reference profile hero metrics', () => {
    render(<PeopleTab {...defaultProps} />);

    expect(screen.getByRole('button', { name: /Spotkania\s*1/i })).toBeInTheDocument();
    expect(screen.getByText('Ostatnia aktywność')).toBeInTheDocument();
    expect(screen.getAllByText('Profil AI').length).toBeGreaterThan(0);
    expect(screen.getByText('aktywny')).toBeInTheDocument();
  });

  test('allows deleting manual people', () => {
    render(<PeopleTab {...defaultProps} />);
    const barbaraButton = screen.getByText('Barbara Zynda').closest('button');
    fireEvent.click(barbaraButton);

    fireEvent.click(screen.getByRole('button', { name: /Usun osobe/i }));

    expect(defaultProps.onDeletePerson).toHaveBeenCalledWith('manual_barbara');
  });

  test('calls onOpenMeeting when history item is clicked', () => {
    render(<PeopleTab {...defaultProps} />);
    const meetingCard = screen.getByText('Sync');
    fireEvent.click(meetingCard);

    expect(defaultProps.onOpenMeeting).toHaveBeenCalledWith('m1');
  });
});
