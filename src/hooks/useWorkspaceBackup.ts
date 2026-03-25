import { useCallback, useMemo, useRef, useState } from 'react';
import { useMeetingsStore } from '../store/meetingsStore';
import { useWorkspaceSelectors } from '../store/workspaceStore';
import { downloadTextFile } from '../lib/storage';
import { slugifyExportTitle } from '../lib/export';
import {
  buildWorkspaceBackup,
  mergeWorkspaceBackup,
  parseWorkspaceBackup,
  previewWorkspaceBackupImport,
  stringifyWorkspaceBackup,
  type WorkspaceBackupPayload,
  type WorkspaceBackupPreview,
} from '../lib/workspaceBackup';

export default function useWorkspaceBackup() {
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceSelectors();
  const {
    meetings,
    manualTasks,
    taskState,
    taskBoards,
    calendarMeta,
    vocabulary,
    setMeetings,
    setManualTasks,
    setTaskState,
    setTaskBoards,
    setCalendarMeta,
    setVocabulary,
    setWorkspaceMessage,
  } = useMeetingsStore();

  const pendingBackupRef = useRef<WorkspaceBackupPayload | null>(null);
  const [preview, setPreview] = useState<WorkspaceBackupPreview | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const currentState = useMemo(
    () => ({ meetings, manualTasks, taskState, taskBoards, calendarMeta, vocabulary }),
    [calendarMeta, manualTasks, meetings, taskBoards, taskState, vocabulary]
  );

  const exportWorkspace = useCallback(() => {
    const payload = buildWorkspaceBackup(
      currentWorkspaceId || '',
      currentWorkspace?.name || 'Workspace',
      currentState
    );
    const filename = `${slugifyExportTitle(currentWorkspace?.name || currentWorkspaceId || 'workspace')}-backup.json`;
    downloadTextFile(filename, stringifyWorkspaceBackup(payload), 'application/json;charset=utf-8');
    setStatusMessage('Backup workspace pobrany.');
  }, [currentState, currentWorkspace?.name, currentWorkspaceId]);

  const importWorkspaceFile = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      const raw = await file.text();
      const parsed = parseWorkspaceBackup(raw);
      pendingBackupRef.current = parsed;
      setPreview(previewWorkspaceBackupImport(currentState, parsed.state));
      setStatusMessage(
        parsed.workspaceId && currentWorkspaceId && parsed.workspaceId !== currentWorkspaceId
          ? 'Backup pochodzi z innego workspace. Zostanie scalony z bieżącym stanem.'
          : 'Backup gotowy do importu.'
      );
    },
    [currentState, currentWorkspaceId]
  );

  const clearImportState = useCallback(() => {
    pendingBackupRef.current = null;
    setPreview(null);
    setStatusMessage('');
  }, []);

  const applyWorkspaceImport = useCallback(async () => {
    if (!pendingBackupRef.current) {
      setStatusMessage('Najpierw wczytaj plik backupu.');
      return;
    }

    setIsImporting(true);
    try {
      const merged = mergeWorkspaceBackup(currentState, pendingBackupRef.current.state);
      setMeetings(merged.meetings as any[]);
      setManualTasks(merged.manualTasks as any[]);
      setTaskState(merged.taskState as Record<string, any>);
      setTaskBoards(merged.taskBoards as Record<string, any>);
      setCalendarMeta(merged.calendarMeta as Record<string, any>);
      setVocabulary(merged.vocabulary as any[]);
      setWorkspaceMessage('Backup workspace zaimportowany.');
      setStatusMessage('Import zakończony pomyślnie.');
      pendingBackupRef.current = null;
      setPreview(null);
    } finally {
      setIsImporting(false);
    }
  }, [
    currentState,
    setCalendarMeta,
    setManualTasks,
    setMeetings,
    setTaskBoards,
    setTaskState,
    setVocabulary,
    setWorkspaceMessage,
  ]);

  return {
    exportWorkspace,
    importWorkspaceFile,
    applyWorkspaceImport,
    clearImportState,
    preview,
    statusMessage,
    isImporting,
    hasPendingImport: Boolean(pendingBackupRef.current),
  };
}
