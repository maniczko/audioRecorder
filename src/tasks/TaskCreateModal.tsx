import { useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import TaskCreateForm, { TaskDraft } from './TaskCreateForm';
import '../styles/tasks.css';
import './TaskDetailsPanelStyles.css';
import './TasksWorkspaceViewStyles.css';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
  initialDraft?: Partial<TaskDraft>;
  boardColumns: any[];
  peopleOptions: string[];
  tagOptions: string[];
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function TaskCreateModal({
  isOpen,
  onClose,
  onSubmit,
  initialDraft,
  boardColumns,
  peopleOptions,
  tagOptions,
}: TaskCreateModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const formId = useId();

  const closeModal = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(() => {
      const preferredInput = modalRef.current?.querySelector<HTMLElement>(
        '[data-modal-initial-focus="true"]'
      );
      const firstInput = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (preferredInput || firstInput)?.focus();
    });

    return () => {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="task-create-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeModal();
        }
      }}
    >
      <div
        ref={modalRef}
        className="task-create-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="task-create-modal-header">
          <h2 id={titleId}>Nowe zadanie</h2>
          <button
            type="button"
            className="task-create-modal-close"
            onClick={closeModal}
            aria-label="Zamknij"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="task-create-modal-body">
          <TaskCreateForm
            formId={formId}
            initialDraft={initialDraft}
            boardColumns={boardColumns}
            peopleOptions={peopleOptions}
            tagOptions={tagOptions}
            onSubmit={(draft) => {
              onSubmit(draft);
              closeModal();
            }}
            showQuickAdd={false}
            autoFocus
          />
        </div>

        <footer className="task-create-modal-footer">
          <button type="button" className="task-create-modal-secondary" onClick={closeModal}>
            Anuluj
          </button>
          <span className="task-create-modal-shortcut">
            <kbd>N</kbd>
            Skrót do nowego zadania
          </span>
          <button type="submit" form={formId} className="task-create-modal-primary">
            Dodaj zadanie
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
