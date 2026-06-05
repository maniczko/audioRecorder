import { render, screen, fireEvent } from '@testing-library/react';
import TasksSidebar from './TasksSidebar';

function createBaseProps(overrides: Record<string, any> = {}) {
  const sidebarLists = {
    baseLists: [
      { id: 'smart:important', label: 'Important', icon: '!', count: 1 },
      { id: 'smart:all', label: 'All', icon: '*', count: 3 },
    ],
    workspaceLists: [{ id: 'column:todo', label: 'Todo', icon: '#', count: 2 }],
    customGroups: [],
  };

  return {
    sidebarLists,
    selectedListId: 'smart:important',
    setSelectedListId: vi.fn(),
    visibleStats: {},
    showColumnManager: false,
    setShowColumnManager: vi.fn(),
    boardColumns: [{ id: 'todo', label: 'Todo', color: '#000', isDone: false, system: true }],
    onUpdateColumn: vi.fn(),
    onDeleteColumn: vi.fn(),
    columnDraft: {},
    setColumnDraft: vi.fn(),
    submitColumn: vi.fn(),
    quickAddInputRef: { current: null },
    searchInputRef: { current: null },
    selectedTaskCount: 0,
    clearTaskSelection: vi.fn(),
    selectedTasks: [],
    taskNotifications: [],
    conflictTasks: [],
    onFocusConflictTask: vi.fn(),
    workspaceMembers: [],
    currentUserName: 'User',
    ownerFilter: 'all',
    setOwnerFilter: vi.fn(),
    allTasks: [],
    ...overrides,
  };
}

describe('TasksSidebar', () => {
  it('renders smart and workspace lists and calls list select callback', () => {
    const setSelectedListId = vi.fn();
    render(<TasksSidebar {...createBaseProps({ setSelectedListId })} />);

    expect(screen.getByText('Important')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();

    const allButtonText = screen.getByText('All');
    fireEvent.click(allButtonText.closest('button') as HTMLButtonElement);
    expect(setSelectedListId).toHaveBeenCalledWith('smart:all');
  });

  it('does not render team block when there is only one workspace member', () => {
    render(
      <TasksSidebar {...createBaseProps({ workspaceMembers: [{ id: 'u1', name: 'One' }] })} />
    );
    expect(screen.queryByText('One')).not.toBeInTheDocument();
  });

  it('renders and handles team block when workspace has multiple members', () => {
    const setOwnerFilter = vi.fn();
    render(
      <TasksSidebar
        {...createBaseProps({
          workspaceMembers: [
            { id: 'u1', name: 'Alice' },
            { id: 'u2', name: 'Bob' },
          ],
          setOwnerFilter,
        })}
      />
    );

    const bob = screen.getByRole('button', { name: /Bob/ });
    fireEvent.click(bob);

    expect(setOwnerFilter).toHaveBeenCalledWith('Bob');
  });

  it('persists collapsed state when toggling group', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    render(<TasksSidebar {...createBaseProps()} />);

    const smartHeader = screen.getByRole('button', { name: /Inteligentne listy/i });
    fireEvent.click(smartHeader);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'voicebobr:sidebar-collapsed',
      expect.stringContaining('"smart":true')
    );
    expect(screen.queryByText('Important')).not.toBeInTheDocument();
  });

  it('renders conflict card and focuses conflict task', () => {
    const onFocusConflictTask = vi.fn();
    render(
      <TasksSidebar
        {...createBaseProps({
          onFocusConflictTask,
          conflictTasks: [
            {
              id: 'conflict-1',
              title: 'Conflict task',
              googleSyncConflict: { localUpdatedAt: '2026-01-01T00:00:00Z', remoteUpdatedAt: '' },
            },
          ],
        })}
      />
    );

    expect(screen.getByText('1 zmian do decyzji')).toBeInTheDocument();
    expect(screen.getByText('Conflict task')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Conflict task/i }));
    expect(onFocusConflictTask).toHaveBeenCalledWith('conflict-1');
  });
});
