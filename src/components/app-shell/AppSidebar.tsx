import type { Dispatch, SetStateAction } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AudioLines, Brain, CalendarDays, Layers, ListTodo, UsersRound } from 'lucide-react';
import AskAIPopover from '../../shared/AskAIPopover';

type AppShellTab = 'studio' | 'recordings' | 'calendar' | 'tasks' | 'people' | 'profile';

interface WorkspaceOption {
  id: string;
  name: string;
}

interface CurrentWorkspace {
  id?: string;
  name?: string;
}

interface AppSidebarProps {
  activeTab: string;
  showAskAI: boolean;
  currentWorkspace?: CurrentWorkspace | null;
  currentWorkspaceId?: string | null;
  availableWorkspaces: WorkspaceOption[];
  closeSidebar: () => void;
  openStudio: () => void;
  setActiveTab: (tab: AppShellTab) => void;
  setShowAskAI: Dispatch<SetStateAction<boolean>>;
  switchWorkspace: (workspaceId: string) => void;
}

interface NavigationItem {
  id: AppShellTab;
  label: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { id: 'studio', label: 'Studio', icon: AudioLines },
  { id: 'recordings', label: 'Nagrania', icon: Layers },
  { id: 'calendar', label: 'Kalendarz', icon: CalendarDays },
  { id: 'tasks', label: 'Zadania', icon: ListTodo },
  { id: 'people', label: 'Osoby', icon: UsersRound },
];

function VoiceLogMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 64 64" fill="none">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth="3.8">
          <path d="M18 18c-3.5 0-6 2.8-6 6.2 0 3.1 2.2 5.7 5.2 6.1" />
          <path d="M46 18c3.5 0 6 2.8 6 6.2 0 3.1-2.2 5.7-5.2 6.1" />
          <path d="M20 45V35.5c0-8 5.8-14.5 12-14.5s12 6.5 12 14.5V45" />
          <path d="M22 29.5c1.9-4.6 5.8-8.6 10-8.6s8.1 4 10 8.6" />
          <path d="M27.3 35.8c1.3 2.5 3.1 3.8 4.7 3.8 1.6 0 3.4-1.3 4.7-3.8" />
          <path d="M32 29.8v7.7" />
          <path d="M28.7 40.2v4.9c0 1.4 1.1 2.5 2.5 2.5h1.6c1.4 0 2.5-1.1 2.5-2.5v-4.9" />
          <path d="M44.6 40.5c2.9.1 5.2-.9 7-2.7 2.4-2.4 3.4-5.8 3.4-9.6-4 1.3-6.6 3.4-8.3 6.1" />
          <path d="M22.2 43.8c-2.4-1.1-4.4-2.8-5.8-4.8" />
          <path d="M41.8 43.8c1.2-.6 2.3-1.3 3.3-2.1" />
          <path d="M23.4 17.5c2.5-2.3 5.4-4 8.6-4.9 3.3.9 6.2 2.6 8.7 4.9" />
          <path d="M29 16.5l3 2.1 3-2.1" />
        </g>
        <g fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="24.5" cy="28.3" r="2.1" />
          <circle cx="39.5" cy="28.3" r="2.1" />
          <path d="M29 31.8c1.1-1.5 2-2.2 3-2.2s1.9.7 3 2.2c-.8 1.3-1.8 2-3 2s-2.2-.7-3-2Z" />
          <rect x="29.2" y="40.4" width="2.1" height="6.1" rx="1" />
          <rect x="32.7" y="40.4" width="2.1" height="6.1" rx="1" />
        </g>
        <g transform="rotate(24 21 49)" fill="none" stroke="currentColor">
          <path
            d="M18.4 44.6c0-2.1 1.7-3.8 3.8-3.8 2.1 0 3.8 1.7 3.8 3.8v5.8h-7.6v-5.8Z"
            strokeWidth="2.8"
          />
          <rect x="21" y="50.4" width="2.4" height="6.1" rx="1.2" strokeWidth="1.8" />
          <path d="M16.4 44.1c0-3.2 2.6-5.8 5.8-5.8s5.8 2.6 5.8 5.8" strokeWidth="2.8" />
          <path d="M17.8 43.2h8.8" strokeWidth="2.1" />
          <path d="M18.8 46.1h6.8" strokeWidth="2.1" />
        </g>
      </g>
    </svg>
  );
}

export default function AppSidebar({
  activeTab,
  showAskAI,
  currentWorkspace,
  currentWorkspaceId,
  availableWorkspaces,
  closeSidebar,
  openStudio,
  setActiveTab,
  setShowAskAI,
  switchWorkspace,
}: AppSidebarProps) {
  const openHome = () => {
    openStudio();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <aside className="modern-sidebar">
      <div
        className="modern-brand"
        onClick={openHome}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            openHome();
          }
        }}
        title="Strona gĹ‚Ăłwna"
      >
        <div className="modern-brand-logo" style={{ color: 'var(--inline-color-accent-strong)' }}>
          <VoiceLogMark />
        </div>
        <h1>VoiceBĂłbr</h1>
      </div>

      <nav className="modern-nav">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`modern-nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => {
                if (item.id === 'studio') {
                  openStudio();
                } else {
                  setActiveTab(item.id);
                }
                closeSidebar();
              }}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}

        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <button
            type="button"
            className={`modern-nav-item ${showAskAI ? 'active' : ''}`}
            onClick={() => {
              setShowAskAI((current) => !current);
              closeSidebar();
            }}
            style={{ width: '100%' }}
          >
            <Brain size={18} />
            Zapytaj AI
          </button>
          {showAskAI && (
            <AskAIPopover currentWorkspace={currentWorkspace} onClose={() => setShowAskAI(false)} />
          )}
        </div>
      </nav>

      <div className="modern-workspace-selector">
        {availableWorkspaces.length > 1 ? (
          <select
            value={currentWorkspaceId || ''}
            onChange={(e) => switchWorkspace(e.target.value)}
          >
            {availableWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-center text-slate-400">{currentWorkspace?.name}</div>
        )}
      </div>
    </aside>
  );
}
