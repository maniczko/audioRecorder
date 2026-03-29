import { X } from 'lucide-react';
import TaskCreateForm, { TaskDraft } from './TaskCreateForm';
import '../styles/tasks.css';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
  initialDraft?: Partial<TaskDraft>;
  boardColumns: any[];
  peopleOptions: string[];
  tagOptions: string[];
}

export default function TaskCreateModal({
  isOpen,
  onClose,
  onSubmit,
  initialDraft,
  boardColumns,
  peopleOptions,
  tagOptions,
}: TaskCreateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="ff-modal-overlay" onClick={onClose} style={{ zIndex: 99999 }}>
      <div
        className="ff-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '90%', padding: '24px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-1)' }}>
            Utwórz nowe zadanie
          </h2>
          <button
            type="button"
            className="ff-modal-close"
            onClick={onClose}
            aria-label="Zamknij"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-2)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          className="tasks-layout ms-todo"
          style={{ display: 'block', height: 'auto', background: 'transparent' }}
        >
          <TaskCreateForm
            initialDraft={initialDraft}
            boardColumns={boardColumns}
            peopleOptions={peopleOptions}
            tagOptions={tagOptions}
            onSubmit={(draft) => {
              onSubmit(draft);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
