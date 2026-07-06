import { memo, useMemo } from 'react';
import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Circle,
  Clock3,
  ArrowDown,
  ArrowUp,
  Minus,
  Layers3,
  ListTodo,
  PlusCircle,
  Star,
  SunMedium,
  Timer,
  UserCheck,
} from 'lucide-react';

const iconMap = {
  today: SunMedium,
  my_day: SunMedium,
  week: CalendarRange,
  planned: Clock3,
  overdue: AlertCircle,
  important: Star,
  assigned: UserCheck,
  all: Layers3,
  todo: Circle,
  in_progress: Timer,
  waiting: Clock3,
  completed: CheckCircle2,
  done: CheckCircle2,
  custom: ListTodo,
  'priority-high': ArrowUp,
  'priority-medium': Minus,
  'priority-low': ArrowDown,
};

function getListIcon(icon) {
  return iconMap[icon] || iconMap[String(icon || '').toLowerCase()] || Circle;
}

function SidebarSection({ title, items, selectedListId, setSelectedListId }) {
  if (!items?.length) return null;

  return (
    <section className="todo-sidebar-section" aria-label={title}>
      <div className="todo-workspace-title">
        <strong>{title}</strong>
      </div>
      <div className="todo-sidebar-section-list">
        {items.map((item) => {
          const Icon = getListIcon(item.icon);
          const isActive = selectedListId === item.id;
          return (
            <button
              type="button"
              key={item.id}
              className={isActive ? 'todo-side-link active' : 'todo-side-link'}
              onClick={() => setSelectedListId(item.id)}
            >
              <span className="todo-side-icon" aria-hidden="true">
                <Icon size={17} strokeWidth={2.1} />
              </span>
              <span className="todo-side-label">{item.label}</span>
              {item.count > 0 ? <strong className="todo-side-count">{item.count}</strong> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TasksSidebar({
  sidebarLists,
  selectedListId,
  setSelectedListId,
  showColumnManager,
  setShowColumnManager,
}: any) {
  const customLists = useMemo(
    () => sidebarLists.customLists || sidebarLists.customGroups || [],
    [sidebarLists]
  );
  const taskLists = useMemo(
    () => sidebarLists.taskLists || sidebarLists.baseLists || [],
    [sidebarLists]
  );
  const statusLists = useMemo(
    () => sidebarLists.statusLists || sidebarLists.workspaceLists || [],
    [sidebarLists]
  );
  const priorityLists = useMemo(
    () => sidebarLists.priorityLists || sidebarLists.priorityGroups || [],
    [sidebarLists]
  );

  return (
    <aside className="todo-sidebar">
      <div className="todo-sidebar-top">
        <div className="todo-sidebar-scroll">
          <nav className="todo-nav-panel" aria-label="Nawigacja zadań">
            <SidebarSection
              title="ZADANIA"
              items={taskLists}
              selectedListId={selectedListId}
              setSelectedListId={setSelectedListId}
            />
            <SidebarSection
              title="STATUSY"
              items={statusLists}
              selectedListId={selectedListId}
              setSelectedListId={setSelectedListId}
            />
            <SidebarSection
              title="PRIORYTET"
              items={priorityLists}
              selectedListId={selectedListId}
              setSelectedListId={setSelectedListId}
            />

            <section className="todo-sidebar-section" aria-label="LISTY WŁASNE">
              <div className="todo-workspace-title">
                <strong>LISTY WŁASNE</strong>
              </div>
              {customLists.length ? (
                <div className="todo-sidebar-section-list">
                  {customLists.map((item) => {
                    const Icon = getListIcon(item.icon || 'custom');
                    const isActive = selectedListId === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={isActive ? 'todo-side-link active' : 'todo-side-link'}
                        onClick={() => setSelectedListId(item.id)}
                      >
                        <span className="todo-side-icon" aria-hidden="true">
                          <Icon size={17} strokeWidth={2.1} />
                        </span>
                        <span className="todo-side-label">{item.label}</span>
                        {item.count > 0 ? (
                          <strong className="todo-side-count">{item.count}</strong>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <button
                type="button"
                className="todo-manage-lists-button"
                onClick={() => setShowColumnManager((previous) => !previous)}
                aria-label="Dodaj liste wlasna Utwórz listę"
                aria-pressed={showColumnManager}
              >
                <span className="todo-side-icon" aria-hidden="true">
                  <PlusCircle size={17} strokeWidth={2.1} />
                </span>
                <span className="todo-side-label">Utwórz listę</span>
              </button>
            </section>
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default memo(TasksSidebar);
