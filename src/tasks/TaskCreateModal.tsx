import TaskCreateForm, { TaskDraft } from './TaskCreateForm';
import Modal from '../shared/Modal';
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
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Utwórz nowe zadanie" size="lg">
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
    </Modal>
  );
}
