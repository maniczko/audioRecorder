import { memo, useMemo, useState } from 'react';
import { formatDateTime } from '../lib/storage';

const LS_KEY = 'voicebobr:sidebar-collapsed';

function loadCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function initials(name: string): string {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

const AVATAR_COLORS = [
  '#75d6c4',
  '#a3c4f3',
  '#f3ca72',
  '#f17d72',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#60a5fa',
  '#e879f9',
  '#4ade80',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'przed chwilą';
  if (mins < 60) return `${mins} min temu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  return formatDateTime(dateString);
}

const ACTIVITY_ICONS: Record<string, string> = {
  created: '✦',
  updated: '✎',
  recording: '🎙',
  status: '⊙',
  comment: '💬',
  assigned: '→',
};

function ActivityFeed({ items }: { items: any[] }) {
  if (!items.length) {
    return (
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', padding: '8px 0', margin: 0 }}>
        Brak ostatniej aktywności.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.slice(0, 8).map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            padding: '5px 8px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.02)',
            borderLeft: '2px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent)' }}>
              {ACTIVITY_ICONS[item.type] || '•'}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              title={item.title}
            >
              {item.title}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              {item.actor || 'System'}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-3, #6b7280)' }}>
              {timeAgo(item.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamPanel({
  workspaceMembers,
  allTasks,
  currentUserName,
  ownerFilter,
  setOwnerFilter,
}: {
  workspaceMembers: any[];
  allTasks: any[];
  currentUserName: string;
  ownerFilter: string;
  setOwnerFilter: (v: string) => void;
}) {
  const members = useMemo(() => {
    return workspaceMembers.map((member) => {
      const name = member.name || member.email || member.id || '';
      const openTasks = allTasks.filter(
        (t) =>
          !t._softDeleted &&
          !t.completed &&
          (t.owner === name || (Array.isArray(t.assignedTo) && t.assignedTo.includes(name)))
      ).length;
      return { ...member, displayName: name, openTasks };
    });
  }, [workspaceMembers, allTasks]);

  if (!members.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {members.map((member) => {
        const isActive = ownerFilter === member.displayName;
        const color = avatarColor(member.displayName);
        return (
          <button
            key={member.id || member.displayName}
            type="button"
            onClick={() => setOwnerFilter(isActive ? 'all' : member.displayName)}
            title={isActive ? 'Pokaż wszystkie zadania' : `Filtruj zadania: ${member.displayName}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              borderRadius: 7,
              border: 'none',
              background: isActive ? 'rgba(117,214,196,0.12)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              transition: 'background 0.15s',
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: color,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials(member.displayName) || '?'}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: '0.8rem',
                color: isActive ? 'var(--accent)' : 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: member.displayName === currentUserName ? 600 : 400,
              }}
            >
              {member.displayName === currentUserName
                ? `${member.displayName} (ja)`
                : member.displayName}
            </span>
            {member.openTasks > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  flexShrink: 0,
                }}
              >
                {member.openTasks}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TasksSidebar({
  sidebarLists,
  selectedListId,
  setSelectedListId,
  visibleStats,
  showColumnManager,
  setShowColumnManager,
  boardColumns,
  onUpdateColumn,
  onDeleteColumn,
  columnDraft,
  setColumnDraft,
  submitColumn,
  quickAddInputRef,
  searchInputRef,
  selectedTaskCount = 0,
  clearTaskSelection,
  selectedTasks = [],
  taskNotifications = [],
  conflictTasks = [],
  onFocusConflictTask,
  workspaceMembers = [],
  workspaceActivity = [],
  currentUserName = '',
  ownerFilter = 'all',
  setOwnerFilter,
  allTasks = [],
}: any) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const hasTeam = workspaceMembers.length > 1;
  const hasActivity = workspaceActivity.length > 0;

  return (
    <aside className="todo-sidebar">
      <div className="todo-sidebar-top">
        <div className="todo-sidebar-scroll">
          <div className="todo-nav-panel">
            <div className="todo-sidebar-group">
              <button
                type="button"
                className="todo-workspace-title todo-workspace-toggle"
                onClick={() => toggle('smart')}
                aria-expanded={!collapsed.smart}
                aria-controls="todo-smart-lists"
              >
                <span
                  className={`todo-workspace-toggle-arrow${collapsed.smart ? ' collapsed' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <strong>Inteligentne listy</strong>
              </button>
              {!collapsed.smart && (
                <div id="todo-smart-lists" role="group" aria-label="Inteligentne listy">
                  {sidebarLists.baseLists.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        selectedListId === item.id ? 'todo-side-link active' : 'todo-side-link'
                      }
                      onClick={() => setSelectedListId(item.id)}
                    >
                      <span className="todo-side-icon">{item.icon}</span>
                      <span className="todo-side-label">{item.label}</span>
                      <strong>{item.count}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="todo-workspace-group">
              <button
                type="button"
                className="todo-workspace-title todo-workspace-toggle"
                onClick={() => toggle('workspace')}
                aria-expanded={!collapsed.workspace}
                aria-controls="todo-workspace-lists"
              >
                <span
                  className={`todo-workspace-toggle-arrow${collapsed.workspace ? ' collapsed' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <strong>Widoki workspace</strong>
              </button>
              {!collapsed.workspace && (
                <div id="todo-workspace-lists" role="group" aria-label="Widoki workspace">
                  {sidebarLists.workspaceLists.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={
                        selectedListId === item.id
                          ? 'todo-side-link active workspace'
                          : 'todo-side-link workspace'
                      }
                      onClick={() => setSelectedListId(item.id)}
                    >
                      <span className="todo-side-icon">{item.icon}</span>
                      <span className="todo-side-label">{item.label}</span>
                      <strong>{item.count}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {hasTeam && (
              <div className="todo-sidebar-group">
                <button
                  type="button"
                  className="todo-workspace-title todo-workspace-toggle"
                  onClick={() => toggle('team')}
                  aria-expanded={!collapsed.team}
                  aria-controls="todo-team-section"
                >
                  <span
                    className={`todo-workspace-toggle-arrow${collapsed.team ? ' collapsed' : ''}`}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                  <strong>Zespół</strong>
                  {ownerFilter !== 'all' && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.68rem',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        background: 'rgba(117,214,196,0.15)',
                        borderRadius: 4,
                        padding: '1px 5px',
                      }}
                    >
                      filtr aktywny
                    </span>
                  )}
                </button>
                {!collapsed.team && (
                  <div id="todo-team-section">
                    <TeamPanel
                      workspaceMembers={workspaceMembers}
                      allTasks={allTasks}
                      currentUserName={currentUserName}
                      ownerFilter={ownerFilter}
                      setOwnerFilter={setOwnerFilter || (() => {})}
                    />
                  </div>
                )}
              </div>
            )}

            {hasActivity && (
              <div className="todo-sidebar-group">
                <button
                  type="button"
                  className="todo-workspace-title todo-workspace-toggle"
                  onClick={() => toggle('activity')}
                  aria-expanded={!collapsed.activity}
                  aria-controls="todo-activity-section"
                >
                  <span
                    className={`todo-workspace-toggle-arrow${collapsed.activity ? ' collapsed' : ''}`}
                    aria-hidden="true"
                  >
                    ▼
                  </span>
                  <strong>Ostatnia aktywność</strong>
                </button>
                {!collapsed.activity && (
                  <div id="todo-activity-section">
                    <ActivityFeed items={workspaceActivity} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="todo-sidebar-footer">
        {conflictTasks.length ? (
          <div className="todo-conflict-card">
            <div className="todo-card-head">
              <div>
                <span className="todo-card-eyebrow">Conflict center</span>
                <strong>{conflictTasks.length} zmian do decyzji</strong>
              </div>
              <span className="todo-status-pill warning">Google</span>
            </div>
            <div className="todo-conflict-list">
              {conflictTasks.slice(0, 4).map((task) => (
                <button
                  type="button"
                  key={task.id}
                  className="todo-conflict-item"
                  onClick={() => onFocusConflictTask?.(task.id)}
                >
                  <strong>{task.title}</strong>
                  <span>
                    Lokalnie:{' '}
                    {task.googleSyncConflict?.localUpdatedAt
                      ? formatDateTime(task.googleSyncConflict.localUpdatedAt)
                      : 'brak'}
                  </span>
                  <small>
                    Google:{' '}
                    {task.googleSyncConflict?.remoteUpdatedAt
                      ? formatDateTime(task.googleSyncConflict.remoteUpdatedAt)
                      : 'brak'}
                  </small>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default memo(TasksSidebar);
