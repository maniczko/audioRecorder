import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TasksSidebar from './TasksSidebar';

function createBaseProps(overrides: Record<string, any> = {}) {
  const sidebarLists = {
    baseLists: [
      { id: 'smart:important', label: 'Important', icon: '!', count: 1 },
      { id: 'smart:all', label: 'All', icon: '*', count: 3 },
    ],
    workspaceLists: [{ id: 'column:todo', label: 'Todo', icon: '#', count: 2 }],
    priorityLists: [{ id: 'priority:high', label: 'Wysoki', icon: 'priority-high', count: 1 }],
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
  it('renders task, status and custom-list sections and calls list select callback', () => {
    const setSelectedListId = vi.fn();
    render(<TasksSidebar {...createBaseProps({ setSelectedListId })} />);

    expect(screen.getByText('ZADANIA')).toBeInTheDocument();
    expect(screen.getByText('STATUSY')).toBeInTheDocument();
    expect(screen.getByText('PRIORYTET')).toBeInTheDocument();
    expect(screen.getByText('LISTY WŁASNE')).toBeInTheDocument();
    expect(screen.getByText('Important')).toBeInTheDocument();
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('Wysoki')).toBeInTheDocument();
    expect(screen.queryByText('Zapytaj AI')).not.toBeInTheDocument();

    const allButtonText = screen.getByText('All');
    fireEvent.click(allButtonText.closest('button') as HTMLButtonElement);
    expect(setSelectedListId).toHaveBeenCalledWith('smart:all');
  });

  it('hides zero counters while keeping non-zero badges visible', () => {
    render(
      <TasksSidebar
        {...createBaseProps({
          sidebarLists: {
            baseLists: [
              { id: 'smart:today', label: 'Dziś', icon: 'today', count: 0 },
              { id: 'smart:all', label: 'Wszystkie', icon: 'all', count: 3 },
            ],
            workspaceLists: [
              { id: 'column:todo', label: 'Do zrobienia', icon: 'todo', count: 0 },
              { id: 'column:done', label: 'Ukończone', icon: 'completed', count: 2 },
            ],
            priorityLists: [],
            customGroups: [],
          },
        })}
      />
    );

    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens custom list manager from list section', () => {
    const setShowColumnManager = vi.fn();
    render(<TasksSidebar {...createBaseProps({ setShowColumnManager })} />);

    fireEvent.click(screen.getByRole('button', { name: /Utwórz listę/i }));

    expect(setShowColumnManager).toHaveBeenCalledWith(expect.any(Function));
  });

  it('does not render conflict or AI cards in the task filter sidebar', () => {
    render(
      <TasksSidebar
        {...createBaseProps({
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

    expect(screen.queryByText('Conflict task')).not.toBeInTheDocument();
    expect(screen.queryByText('Zapytaj AI')).not.toBeInTheDocument();
    expect(screen.queryByText(/zmian do decyzji/i)).not.toBeInTheDocument();
  });
});
