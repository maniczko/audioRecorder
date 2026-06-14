import type { Dispatch, SetStateAction } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AudioLines, BookOpenText, CalendarDays, Layers, ListTodo, UsersRound } from 'lucide-react';
import AskAIPopover from '../../shared/AskAIPopover';
import { MascotAvatar, VoiceBobrLogo } from '../brand/VoiceBobrBrand';

type AppShellTab = 'studio' | 'recordings' | 'calendar' | 'tasks' | 'people' | 'notes' | 'profile';

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
  closeSidebar: (options?: { returnFocus?: boolean }) => void;
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
  { id: 'notes', label: 'Notatki', icon: BookOpenText },
];

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
    <aside id="voicebobr-sidebar" className="modern-sidebar" aria-label="Główna nawigacja">
      <div
        className="modern-brand"
        onClick={openHome}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openHome();
          }
        }}
        title="Strona główna"
        aria-label="Strona główna"
      >
        <VoiceBobrLogo />
      </div>

      <nav className="modern-nav" aria-label="Widoki aplikacji">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`modern-nav-item ${activeTab === item.id ? 'active' : ''}`}
              aria-current={activeTab === item.id ? 'page' : undefined}
              aria-label={item.label}
              onClick={() => {
                if (item.id === 'studio') {
                  openStudio();
                } else {
                  setActiveTab(item.id);
                }
                closeSidebar({ returnFocus: true });
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="modern-nav-label">{item.label}</span>
            </button>
          );
        })}

        {activeTab !== 'tasks' ? (
          <div style={{ marginTop: 'auto', position: 'relative' }}>
            <button
              type="button"
              className={`modern-nav-item ${showAskAI ? 'active' : ''}`}
              aria-label="Zapytaj AI"
              aria-expanded={showAskAI}
              onClick={() => {
                setShowAskAI((current) => !current);
                closeSidebar({ returnFocus: true });
              }}
              style={{ width: '100%' }}
            >
              <MascotAvatar className="modern-nav-mascot" size="xs" />
              Zapytaj AI
            </button>
            {showAskAI && (
              <AskAIPopover
                currentWorkspace={currentWorkspace}
                onClose={() => setShowAskAI(false)}
              />
            )}
          </div>
        ) : null}
      </nav>

      <div className="modern-workspace-selector">
        {availableWorkspaces.length > 1 ? (
          <select
            aria-label="Przełącz workspace"
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
