import { useEffect, useMemo, useRef, useState } from 'react';
import { createMediaService } from '../services/mediaService';
import {
  deleteRecordingBlob,
  getAudioStorageEstimate,
  listStoredSizes,
  saveAudioBlob,
} from '../lib/audioStore';
import { createId } from '../lib/storage';
import {
  RECORDING_WORKSPACE_REQUIRED_MESSAGE,
  createRecordingQueueItem,
  hasRecordingWorkspaceContext,
  upsertRecordingQueueItem,
  getNextPendingRecordingQueueItem,
} from '../lib/recordingQueue';
import {
  createRecordingConsentDisclosure,
  createRecordingConsentMetadata,
  loadRecordingConsent,
  saveRecordingConsent,
  type RecordingConsentDisclosure,
  type RecordingConsentMetadata,
} from '../lib/recordingConsent';

import useAudioHardware from './useAudioHardware';
import useAudioHydration from './useAudioHydration';
import useRecordingPipeline from './useRecordingPipeline';
import useLiveTranscript from './useLiveTranscript';

interface AudioStorageState {
  usageBytes: number;
  quotaBytes: number;
  freeBytes: number;
  usageRatio: number;
  isNearQuota: boolean;
  warningMessage: string;
  items: any[];
}

interface UseRecorderParams {
  selectedMeeting?: any;
  userMeetings: any[];
  createAdHocMeeting: () => any;
  attachCompletedRecording: (recordingMeetingId: any, recording: any) => void;
  isHydratingRemoteState: boolean;
  selectMeeting?: (meeting: any) => void;
  currentWorkspaceId?: string | null;
}

interface StartRecordingOptions {
  adHoc?: boolean;
}

interface PendingRecordingRequest {
  active: any;
}

export default function useRecorder({
  selectedMeeting,
  userMeetings,
  createAdHocMeeting,
  attachCompletedRecording,
  isHydratingRemoteState,
  selectMeeting,
  currentWorkspaceId,
}: UseRecorderParams) {
  const mediaService = useMemo(() => createMediaService(), []);
  const [liveText, setLiveText] = useState('');
  const [currentSegments, setCurrentSegments] = useState<any[]>([]);
  const [recordingMeetingId, setRecordingMeetingId] = useState<string | null>(null);
  const [recordingConsentPromptOpen, setRecordingConsentPromptOpen] = useState(false);
  const [recordingConsentDisclosure] = useState<RecordingConsentDisclosure>(() =>
    createRecordingConsentDisclosure({ remoteMode: mediaService.mode === 'remote' })
  );
  const [audioStorageState, setAudioStorageState] = useState<AudioStorageState>({
    usageBytes: 0,
    quotaBytes: 0,
    freeBytes: 0,
    usageRatio: 0,
    isNearQuota: false,
    warningMessage: '',
    items: [],
  });
  const userMeetingsRef = useRef<any[]>(userMeetings);
  const pendingRecordingRequestRef = useRef<PendingRecordingRequest | null>(null);
  const activeRecordingConsentRef = useRef<RecordingConsentMetadata | null>(null);

  useEffect(() => {
    userMeetingsRef.current = userMeetings;
  }, [userMeetings]);

  function withWorkspaceFallback(meeting: any) {
    if (!meeting || typeof meeting !== 'object') return meeting;
    const workspaceId = String(meeting.workspaceId || currentWorkspaceId || '').trim();
    if (!workspaceId || meeting.workspaceId === workspaceId) return meeting;
    return { ...meeting, workspaceId };
  }

  function remoteWorkspaceReady(meeting: any) {
    return mediaService.mode !== 'remote' || hasRecordingWorkspaceContext(meeting);
  }

  function blockMissingWorkspace() {
    pipeline.setAnalysisStatus('error');
    pipeline.setPipelineProgress(0, 'Brak kontekstu workspace');
    pipeline.setRecordingMessage(RECORDING_WORKSPACE_REQUIRED_MESSAGE);
  }

  function getWorkspaceConsentId(meeting: any) {
    return String(meeting?.workspaceId || currentWorkspaceId || 'local');
  }

  function resolveRecordingConsent(meeting: any) {
    return loadRecordingConsent(getWorkspaceConsentId(meeting));
  }

  function startHardwareRecording(active: any, consent: RecordingConsentMetadata) {
    activeRecordingConsentRef.current = consent;
    setRecordingMeetingId(active.id);
    selectMeeting?.(active);
    return hardware.startRecording(active.id);
  }

  function requestRecordingConsent(active: any) {
    pendingRecordingRequestRef.current = { active };
    setRecordingConsentPromptOpen(true);
    pipeline.setRecordingMessage('Przed nagrywaniem zaakceptuj zgode i ujawnienie dostawcow AI.');
  }

  function normalizeErrorMessage(error: unknown) {
    return String(error instanceof Error ? error.message : error || '').trim();
  }

  function isQuotaExceededSaveError(error: unknown) {
    const message = normalizeErrorMessage(error).toLowerCase();
    return (
      message.includes('za malo miejsca') ||
      message.includes('brak miejsca') ||
      message.includes('quota exceeded') ||
      message.includes('quota')
    );
  }

  function isBlobUploadError(error: unknown) {
    const message = normalizeErrorMessage(error).toLowerCase();
    return message.includes('upload') && message.includes('blob');
  }

  async function refreshAudioStorageState(): Promise<AudioStorageState> {
    const [estimate, itemsResult] = await Promise.all([
      getAudioStorageEstimate(),
      listStoredSizes(),
    ]);

    const items = Array.isArray(itemsResult) ? itemsResult : [];
    const nextEstimate = estimate || {
      usageBytes: 0,
      quotaBytes: 0,
      freeBytes: 0,
      usageRatio: 0,
      isNearQuota: false,
    };
    const warningMessage = nextEstimate.isNearQuota
      ? `Storage audio jest wykorzystany w ${Math.round(nextEstimate.usageRatio * 100)}%. Zostało ${Math.max(0, Math.round(nextEstimate.freeBytes / 1024 / 1024))} MB.`
      : '';

    setAudioStorageState({
      ...nextEstimate,
      warningMessage,
      items,
    });
    return {
      ...nextEstimate,
      warningMessage,
      items,
    };
  }

  useEffect(() => {
    refreshAudioStorageState().catch((error) => {
      console.warn('Unable to read audio storage state.', error);
    });
  }, []);

  // 1. Pipeline & Queue Management
  const pipeline = useRecordingPipeline({
    userMeetingsRef,
    attachCompletedRecording,
    setCurrentSegments,
    isHydratingRemoteState,
  });

  // 2. Audio Assets & Hydration
  const hydration = useAudioHydration({
    mediaService,
    userMeetings,
  });

  useEffect(() => {
    if (isHydratingRemoteState) return;
    const recordingId = selectedMeeting?.latestRecordingId || selectedMeeting?.recordings?.[0]?.id;
    if (!recordingId) return;
    const selectedRecording = (selectedMeeting?.recordings || []).find(
      (recording: any) =>
        String(recording?.id || recording?.recordingId || '').trim() === String(recordingId).trim()
    );
    if (selectedRecording?.audioUnavailable || selectedRecording?.audioAvailable === false) return;
    if (hydration.audioUrls?.[recordingId]) return;
    if (hydration.audioHydrationStatusByRecordingId?.[recordingId] === 'error') return;
    hydration.hydrateRecordingAudio(recordingId, { priority: true }).catch(() => {});
  }, [hydration, isHydratingRemoteState, selectedMeeting]);

  // 3. Hardware & Recording Control
  const hardware = useAudioHardware({
    mediaService,
    onRecordingStop: async ({ meetingId, chunks, mimeType, rawSegments, duration }) => {
      try {
        const rid = createId('recording');
        const blob = new Blob(chunks, { type: mimeType });
        hydration.registerAudioUrl(rid, blob);
        await saveAudioBlob(rid, blob);
        refreshAudioStorageState().catch(() => undefined);
        const meeting = withWorkspaceFallback(
          userMeetingsRef.current.find((m) => m.id === meetingId) || selectedMeeting
        );

        if (!remoteWorkspaceReady(meeting)) {
          blockMissingWorkspace();
          return;
        }

        const recordingConsent =
          activeRecordingConsentRef.current || resolveRecordingConsent(meeting);

        pipeline.setRecordingQueue((prev) =>
          upsertRecordingQueueItem(
            prev,
            createRecordingQueueItem({
              recordingId: rid,
              meetingId,
              workspaceId: currentWorkspaceId || '',
              meeting,
              mimeType,
              rawSegments,
              duration,
              recordingConsent,
            })
          )
        );
        pipeline.setRecordingMessage('Nagranie trafilo do kolejki.');
      } catch (e) {
        console.error('Recording finalization failed.', e);
        pipeline.setRecordingMessage('Błąd finalizacji nagrania.');
      } finally {
        setRecordingMeetingId(null);
        activeRecordingConsentRef.current = null;
      }
    },
    onSegmentsChange: setCurrentSegments,
    onInterimChange: setLiveText,
    onMessageChange: pipeline.setRecordingMessage,
    onStartFailure: () => {
      setRecordingMeetingId(null);
    },
  });

  // 4. Live Transcription Bridge
  const [liveTranscriptEnabled, setLiveTranscriptEnabled] = useState(
    mediaService.mode === 'remote'
  );
  const serverCaption = useLiveTranscript({
    chunksRef: hardware.chunksRef,
    isRecording: hardware.isRecording,
    enabled:
      mediaService.mode === 'remote' &&
      liveTranscriptEnabled &&
      !mediaService.supportsLiveTranscription(),
    transcribeLive: (blob: Blob) =>
      (mediaService as any).transcribeLiveChunk?.(blob) ?? Promise.resolve(''),
    mimeType: hardware.mimeTypeRef.current,
  });

  useEffect(() => {
    if (mediaService.mode === 'remote' && liveTranscriptEnabled && serverCaption) {
      setLiveText(serverCaption);
    }
  }, [serverCaption, mediaService.mode, liveTranscriptEnabled]);

  const startRecordingWrapper = (options: StartRecordingOptions = {}) => {
    const active = withWorkspaceFallback(
      options.adHoc || !selectedMeeting ? createAdHocMeeting() : selectedMeeting
    );
    if (!active) {
      pipeline.setRecordingMessage('Nie udalo sie przygotowac spotkania.');
      return;
    }
    if (!remoteWorkspaceReady(active)) {
      blockMissingWorkspace();
      return;
    }
    const consent = resolveRecordingConsent(active);
    if (!consent) {
      requestRecordingConsent(active);
      return;
    }
    return startHardwareRecording(active, consent);
  };

  const acceptRecordingConsent = () => {
    const pending = pendingRecordingRequestRef.current;
    const active = pending?.active || withWorkspaceFallback(selectedMeeting);
    const consent = createRecordingConsentMetadata({
      workspaceId: getWorkspaceConsentId(active),
      disclosure: recordingConsentDisclosure,
    });
    saveRecordingConsent(consent);
    pendingRecordingRequestRef.current = null;
    setRecordingConsentPromptOpen(false);
    pipeline.setRecordingMessage('Zgoda zapisana. Rozpoczynamy nagrywanie.');
    if (active) {
      return startHardwareRecording(active, consent);
    }
    return undefined;
  };

  const declineRecordingConsent = () => {
    pendingRecordingRequestRef.current = null;
    setRecordingConsentPromptOpen(false);
    pipeline.setRecordingMessage('Nagrywanie nie zostalo uruchomione bez zgody.');
  };

  const selectedMeetingQueue = useMemo(
    () => pipeline.getMeetingQueue(selectedMeeting?.id),
    [pipeline, selectedMeeting?.id]
  );
  const activeQueueItem = useMemo(
    () => getNextPendingRecordingQueueItem(pipeline.recordingQueue),
    [pipeline.recordingQueue]
  );

  async function queueRecording(meetingId, file, meetingHint?) {
    if (!meetingId || !file) {
      pipeline.setRecordingMessage('Nie udalo sie dodac pliku do kolejki.');
      return null;
    }

    const rid = createId('recording');
    const blob = file instanceof Blob ? file : new Blob([file]);
    const meeting = withWorkspaceFallback(
      userMeetingsRef.current.find((item) => item.id === meetingId) ||
        (selectedMeeting?.id === meetingId ? selectedMeeting : null) ||
        meetingHint ||
        null
    );

    if (!remoteWorkspaceReady(meeting)) {
      blockMissingWorkspace();
      return null;
    }

    try {
      hydration.registerAudioUrl(rid, blob);
      await saveAudioBlob(rid, blob);
      refreshAudioStorageState().catch(() => undefined);
      pipeline.setRecordingQueue((prev) =>
        upsertRecordingQueueItem(
          prev,
          createRecordingQueueItem({
            recordingId: rid,
            meetingId,
            workspaceId: currentWorkspaceId || '',
            meeting,
            mimeType: file.type || 'audio/webm',
            rawSegments: [],
            duration: 0,
          })
        )
      );
      pipeline.setAnalysisStatus('queued');
      pipeline.setPipelineProgress(8, 'Plik dodany do kolejki');
      pipeline.setRecordingMessage('Plik dodany do kolejki. Rozpoczynamy wgrywanie...');
      return rid;
    } catch (error) {
      console.error('Queued file import failed.', error);
      const normalizedErrorMessage = normalizeErrorMessage(error);
      if (isQuotaExceededSaveError(error) || isBlobUploadError(error)) {
        const queuePayload = createRecordingQueueItem({
          recordingId: rid,
          meetingId,
          workspaceId: currentWorkspaceId || '',
          meeting,
          mimeType: file.type || 'audio/webm',
          rawSegments: [],
          duration: 0,
        });

        pipeline.setRecordingQueue((prev) =>
          upsertRecordingQueueItem(prev, {
            ...queuePayload,
            status: 'queued',
            uploaded: false,
            errorMessage: '',
            lastErrorMessage: normalizedErrorMessage,
          })
        );
        pipeline.setAnalysisStatus('error');
        pipeline.setPipelineProgress(0, 'Dodanie pliku nie powiodlo sie');
        pipeline.setRecordingMessage('Nie udalo sie zapisac pliku do kolejki.');
        return rid;
      }

      pipeline.setAnalysisStatus('error');
      pipeline.setPipelineProgress(0, 'Dodanie pliku nie powiodlo sie');
      pipeline.setRecordingMessage('Nie udalo sie zapisac pliku do kolejki.');
      return null;
    }
  }

  function resetRecorderState() {
    pipeline.setRecordingMessage('');
    setLiveText('');
    setCurrentSegments([]);
    hardware.cleanupRecorder();
    setRecordingMeetingId(null);
  }

  function retryStoredRecording(meeting, recording) {
    return pipeline.retryStoredRecording?.(meeting, recording);
  }

  async function deleteStoredRecordingAudio(recordingId) {
    if (!recordingId) {
      return;
    }

    await deleteRecordingBlob(recordingId);
    hydration.removeAudioUrl?.(recordingId);
    await refreshAudioStorageState().catch(() => undefined);
  }

  return {
    ...hardware,
    ...hydration,
    ...pipeline,
    liveText,
    currentSegments,
    recordingMeetingId,
    selectedMeetingQueue,
    activeQueueItem,
    speechRecognitionSupported: mediaService.supportsLiveTranscription(),
    liveTranscriptEnabled,
    setLiveTranscriptEnabled: mediaService.mode === 'remote' ? setLiveTranscriptEnabled : null,
    recordingConsent: {
      isPromptOpen: recordingConsentPromptOpen,
      disclosure: recordingConsentDisclosure,
      accept: acceptRecordingConsent,
      decline: declineRecordingConsent,
      current: selectedMeeting ? resolveRecordingConsent(selectedMeeting) : null,
    },
    startRecording: startRecordingWrapper,
    pauseRecording: hardware.pauseRecording,
    resumeRecording: hardware.resumeRecording,
    queueRecording,
    retryStoredRecording,
    resetRecorderState,
    audioStorageState,
    refreshAudioStorageState,
    deleteStoredRecordingAudio,
  };
}
