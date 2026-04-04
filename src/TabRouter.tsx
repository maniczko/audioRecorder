import { useMemo, useState, lazy, Suspense, useCallback } from 'react';
import ErrorBoundary from './lib/ErrorBoundary';

import { useWorkspaceSelectors } from './store/workspaceStore';
import { useAuthStore } from './store/authStore';
import useMeetings from './hooks/useMeetings';
import { useGoogleCtx } from './context/GoogleContext';
import { useMicrosoftCtx } from './context/MicrosftContext';
import { useRecorderCtx } from './context/RecorderContext';
import useUI from './hooks/useUI';

/**
 * Wrapper dla lazy loading z obsługą błędów i retry logic.
 * Zapobiega błędom "Failed to fetch dynamically imported module".
 */
export function createLazyComponent(
  importFn: () => Promise<{ default: React.ComponentType<any> }>
) {
  return lazy(async () => {
    try {
      const module = await importFn();
      return module;
    } catch (error) {
      console.error('[LazyComponent] Failed to load component:', error);

      // Return fallback component with retry logic
      return {
        default: function FallbackComponent() {
          const [retrying, setRetrying] = useState(false);
          const [errorCount, setErrorCount] = useState(0);

          const handleRetry = useCallback(() => {
            setRetrying(true);
            setErrorCount((prev) => prev + 1);

            // Force reload the page if retry fails multiple times
            if (errorCount >= 2) {
              window.location.reload();
              return;
            }

            // Try to reload the component after a short delay
            setTimeout(() => {
              window.location.reload();
            }, 500);
          }, [errorCount]);

          return (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                maxWidth: '600px',
                margin: '4rem auto',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#fff' }}>
                ⚠️ Problem z załadowaniem widoku
              </h2>
              <p style={{ color: '#aaa', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Nie udało się załadować tego komponentu. To może być spowodowane:
              </p>
              <ul
                style={{
                  textAlign: 'left',
                  color: '#aaa',
                  marginBottom: '1.5rem',
                  lineHeight: 1.8,
                }}
              >
                <li>Problemem z cache przeglądarki</li>
                <li>Brakiem połączenia z internetem</li>
                <li>Uszkodzonymi plikami buildu</li>
              </ul>
              <button
                onClick={handleRetry}
                disabled={retrying}
                style={{
                  padding: '12px 32px',
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: retrying ? 'not-allowed' : 'pointer',
                  opacity: retrying ? 0.7 : 1,
                  fontWeight: 600,
                }}
              >
                {retrying ? 'Ładowanie...' : '🔄 Odśwież stronę'}
              </button>
              {errorCount > 0 && (
                <p style={{ marginTop: '1rem', color: '#ff6b6b', fontSize: '0.9rem' }}>
                  Próba {errorCount} z 3...
                </p>
              )}
            </div>
          );
        },
      };
    }
  });
}

// Lazy load all tabs with error handling
const CalendarTab = createLazyComponent(() => import('./CalendarTab'));
const NotesTab = createLazyComponent(() => import('./NotesTab'));
const PeopleTab = createLazyComponent(() => import('./PeopleTab'));
const ProfileTab = createLazyComponent(() => import('./ProfileTab'));
const StudioTab = createLazyComponent(() => import('./StudioTab'));
const TasksTab = createLazyComponent(() => import('./TasksTab'));
const RecordingsTab = createLazyComponent(() => import('./RecordingsTab'));

function getActiveTabLabel(activeTab: string) {
  switch (activeTab) {
    case 'calendar':
      return 'Kalendarz';
    case 'tasks':
      return 'Zadania';
    case 'notes':
      return 'Notatki';
    case 'people':
      return 'Osoby';
    case 'profile':
      return 'Profil';
    case 'recordings':
      return 'Nagrania';
    default:
      return 'Studio';
  }
}

function buildAllTags(userMeetings: any[] = [], meetingTasks: any[] = []) {
  const tagMap = new Map<string, { tag: string; taskCount: number; meetingCount: number }>();

  (userMeetings || []).forEach((meeting) =>
    (meeting.tags || []).forEach((tag) => {
      const entry = tagMap.get(tag) || { tag, taskCount: 0, meetingCount: 0 };
      entry.meetingCount += 1;
      tagMap.set(tag, entry);
    })
  );

  (meetingTasks || []).forEach((task) =>
    (task.tags || []).forEach((tag) => {
      const entry = tagMap.get(tag) || { tag, taskCount: 0, meetingCount: 0 };
      entry.taskCount += 1;
      tagMap.set(tag, entry);
    })
  );

  return [...tagMap.values()].sort((left, right) => left.tag.localeCompare(right.tag));
}

export default function TabRouter({ calendarMonth, setCalendarMonth }) {
  const workspace = useWorkspaceSelectors();
  const auth = useAuthStore();
  const meetings = useMeetings();
  const google = useGoogleCtx();
  const microsoft = useMicrosoftCtx();
  const recorder = useRecorderCtx();
  const ui = useUI();

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date());

  const allTags = useMemo(
    () => buildAllTags(meetings.userMeetings, meetings.meetingTasks),
    [meetings.meetingTasks, meetings.userMeetings]
  );

  function renderActiveTab() {
    switch (ui.activeTab) {
      case 'calendar':
        return (
          <CalendarTab
            activeMonth={calendarMonth}
            setActiveMonth={setCalendarMonth}
            selectedDate={selectedCalendarDate}
            setSelectedDate={setSelectedCalendarDate}
            userMeetings={meetings.userMeetings}
            calendarTasks={ui.calendarTasks}
            googleCalendarEvents={google.googleCalendarEvents}
            googleCalendarMessage={google.googleCalendarMessage}
            disconnectGoogleCalendar={google.disconnectGoogleCalendar}
            syncCalendarEntryToGoogle={google.syncCalendarEntryToGoogle}
            rescheduleGoogleCalendarEntry={google.rescheduleGoogleCalendarEntry}
            openMeetingFromCalendar={ui.openMeetingFromCalendar}
            openGoogleCalendarForMeeting={ui.openGoogleCalendarForMeeting}
            openTask={ui.openTask}
            googleCalendarWritable={google.googleCalendarWritable}
            onRescheduleMeeting={meetings.rescheduleMeeting}
            onRescheduleTask={meetings.rescheduleTask}
            calendarMeta={meetings.calendarMeta}
            onUpdateCalendarEntryMeta={meetings.updateCalendarEntryMeta}
            onApplyCalendarSyncSnapshot={meetings.applyCalendarSyncSnapshot}
            workspaceMembers={workspace.currentWorkspaceMembers}
            peopleProfiles={meetings.peopleProfiles}
            currentUserTimezone={
              workspace.currentUser?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
            }
            startNewMeetingDraft={meetings.startNewMeetingDraft}
            onNavigateToStudio={() => ui.setActiveTab('studio')}
            onCreateMeeting={meetings.createMeetingDirect}
          />
        );
      case 'tasks':
        return (
          <TasksTab
            tasks={meetings.meetingTasks}
            peopleOptions={meetings.taskPeople}
            tagOptions={meetings.taskTags}
            boardColumns={meetings.taskColumns}
            onCreateTask={meetings.createTaskFromComposer}
            onUpdateTask={meetings.updateTask}
            onBulkUpdateTasks={meetings.bulkUpdateTasks}
            onDeleteTask={meetings.deleteTask}
            onBulkDeleteTasks={meetings.bulkDeleteTasks}
            onMoveTaskToColumn={meetings.moveTaskToColumn}
            onReorderTask={meetings.reorderTask}
            onCreateColumn={meetings.addTaskColumn}
            onUpdateColumn={meetings.changeTaskColumn}
            onDeleteColumn={meetings.removeTaskColumn}
            onOpenMeeting={ui.openMeetingFromCalendar}
            defaultView={workspace.currentUser.preferredTaskView || 'list'}
            googleTasksEnabled={google.googleEnabled}
            googleTasksStatus={google.googleTasksStatus}
            googleTasksMessage={google.googleTasksMessage}
            googleTasksLastSyncedAt={google.googleTasksLastSyncedAt}
            googleTaskLists={google.googleTaskLists}
            selectedGoogleTaskListId={google.selectedGoogleTaskListId}
            onSelectGoogleTaskList={google.setSelectedGoogleTaskListId}
            onConnectGoogleTasks={google.connectGoogleTasks}
            onImportGoogleTasks={google.importGoogleTasksFromList}
            onExportGoogleTasks={google.exportTasksToGoogle}
            onRefreshGoogleTasks={google.refreshGoogleTasks}
            onResolveGoogleTaskConflict={google.resolveGoogleTaskConflict}
            workspaceName={workspace.currentWorkspace?.name || ''}
            workspaceInviteCode={workspace.currentWorkspace?.inviteCode || ''}
            externalSelectedTaskId={ui.pendingTaskId}
            onTaskSelectionHandled={() => ui.setPendingTaskId('')}
            currentUserName={workspace.currentUser?.name || workspace.currentUser?.email || 'Ty'}
            workspaceMembers={workspace.currentWorkspaceMembers}
            taskNotifications={meetings.taskNotifications}
            workspaceActivity={meetings.workspaceActivity}
          />
        );
      case 'notes':
        return (
          <NotesTab
            userMeetings={meetings.userMeetings}
            onOpenMeeting={ui.openMeetingFromCalendar}
            onCreateNote={meetings.createManualNote}
          />
        );
      case 'people':
        return (
          <PeopleTab
            profiles={meetings.peopleProfiles}
            onOpenMeeting={ui.openMeetingFromCalendar}
            onOpenTask={ui.openTask}
            onCreateTask={ui.createTaskForPerson}
            onCreateMeeting={ui.createMeetingForPerson}
            onUpdatePersonNotes={meetings.updatePersonNotes}
            onAnalyzePersonProfile={meetings.analyzePersonPsychProfile}
            externalSelectedPersonId={ui.pendingPersonId}
            onPersonSelectionHandled={() => ui.setPendingPersonId('')}
          />
        );
      case 'profile':
        return (
          <ProfileTab
            currentUser={workspace.currentUser}
            profileDraft={auth.profileDraft}
            setProfileDraft={auth.setProfileDraft}
            saveProfile={auth.saveProfile}
            profileMessage={auth.profileMessage}
            googleEnabled={google.googleEnabled}
            googleCalendarStatus={google.googleCalendarStatus}
            googleCalendarMessage={google.googleCalendarMessage}
            googleCalendarEventsCount={google.googleCalendarEvents.length}
            googleCalendarLastSyncedAt={google.googleCalendarLastSyncedAt}
            connectGoogleCalendar={google.connectGoogleCalendar}
            disconnectGoogleCalendar={google.disconnectGoogleCalendar}
            refreshGoogleCalendar={google.refreshGoogleCalendar}
            passwordDraft={auth.passwordDraft}
            setPasswordDraft={auth.setPasswordDraft}
            updatePassword={auth.updatePassword}
            securityMessage={auth.securityMessage}
            onLogout={ui.logout}
            googleTasksEnabled={google.googleEnabled}
            googleTasksStatus={google.googleTasksStatus}
            googleTasksMessage={google.googleTasksMessage}
            googleTasksLastSyncedAt={google.googleTasksLastSyncedAt}
            googleTaskLists={google.googleTaskLists}
            selectedGoogleTaskListId={google.selectedGoogleTaskListId}
            onSelectGoogleTaskList={google.setSelectedGoogleTaskListId}
            onConnectGoogleTasks={google.connectGoogleTasks}
            onImportGoogleTasks={google.importGoogleTasksFromList}
            onExportGoogleTasks={google.exportTasksToGoogle}
            onRefreshGoogleTasks={google.refreshGoogleTasks}
            microsoftEnabled={microsoft.microsoftEnabled}
            microsoftCalendarStatus={microsoft.microsoftCalendarStatus}
            microsoftCalendarMessage={microsoft.microsoftCalendarMessage}
            outlookCalendarEventsCount={microsoft.outlookCalendarEvents.length}
            microsoftCalendarLastSyncedAt={microsoft.microsoftCalendarLastSyncedAt}
            connectMicrosoftCalendar={microsoft.connectMicrosoftCalendar}
            disconnectMicrosoftCalendar={microsoft.disconnectMicrosoftCalendar}
            microsoftTasksStatus={microsoft.microsoftTasksStatus}
            microsoftTasksMessage={microsoft.microsoftTasksMessage}
            microsoftTaskLists={microsoft.microsoftTaskLists}
            selectedMicrosoftTaskListId={microsoft.selectedMicrosoftTaskListId}
            onSelectMicrosoftTaskList={microsoft.setSelectedMicrosoftTaskListId}
            connectMicrosoftTasks={microsoft.connectMicrosoftTasks}
            disconnectMicrosoftTasks={microsoft.disconnectMicrosoftTasks}
            workspaceRole={workspace.currentWorkspaceRole}
            theme={ui.theme}
            onSetTheme={ui.setTheme}
            layoutPreset={ui.layoutPreset}
            onSetLayoutPreset={ui.setLayoutPreset}
            sessionToken={workspace.session?.token || ''}
            apiBaseUrl={import.meta.env.VITE_API_BASE_URL || ''}
            allTags={allTags}
            onRenameTag={meetings.renameTag}
            onDeleteTag={meetings.deleteTag}
            vocabulary={[]}
            onUpdateVocabulary={() => {}}
            peopleProfiles={meetings.peopleProfiles}
            audioStorageState={recorder.audioStorageState}
            onRefreshAudioStorageState={recorder.refreshAudioStorageState}
            onDeleteStoredRecordingAudio={recorder.deleteStoredRecordingAudio}
          />
        );
      case 'recordings':
        return (
          <RecordingsTab
            currentWorkspace={workspace.currentWorkspace}
            userMeetings={meetings.userMeetings}
            selectedMeeting={meetings.selectedMeeting}
            selectMeeting={meetings.selectMeeting}
            startNewMeetingDraft={meetings.startNewMeetingDraft}
            selectedRecordingId={meetings.selectedRecordingId}
            setSelectedRecordingId={meetings.setSelectedRecordingId}
            setActiveTab={ui.setActiveTab}
            saveMeeting={meetings.saveMeeting}
            onCreateMeeting={meetings.createMeetingDirect}
            queueRecording={recorder.queueRecording}
            recordingQueue={recorder.recordingQueue}
            activeQueueItem={recorder.activeQueueItem}
            analysisStatus={recorder.analysisStatus}
            recordingMessage={recorder.recordingMessage}
            pipelineProgressPercent={recorder.pipelineProgressPercent}
            pipelineStageLabel={recorder.pipelineStageLabel}
            retryRecordingQueueItem={recorder.retryRecordingQueueItem}
            retryStoredRecording={recorder.retryStoredRecording}
            deleteRecordingAndMeeting={meetings.deleteRecordingAndMeeting}
          />
        );
      default:
        return (
          <StudioTab
            currentUser={workspace.currentUser}
            currentWorkspace={workspace.currentWorkspace}
            currentWorkspaceMembers={workspace.currentWorkspaceMembers}
            currentWorkspaceRole={workspace.currentWorkspaceRole}
            currentWorkspacePermissions={workspace.currentWorkspacePermissions}
            updateWorkspaceMemberRole={workspace.updateWorkspaceMemberRole}
            setActiveTab={ui.setActiveTab}
            meetingDraft={meetings.meetingDraft}
            setMeetingDraft={meetings.setMeetingDraft}
            activeStoredMeetingDraft={meetings.activeStoredMeetingDraft}
            clearMeetingDraft={meetings.clearMeetingDraft}
            saveMeeting={meetings.saveMeeting}
            startNewMeetingDraft={meetings.startNewMeetingDraft}
            workspaceActivity={meetings.workspaceActivity}
            workspaceMessage={meetings.workspaceMessage}
            userMeetings={meetings.userMeetings}
            selectedMeetingId={meetings.selectedMeetingId}
            selectMeeting={meetings.selectMeeting}
            selectedMeeting={meetings.selectedMeeting}
            displayRecording={ui.displayRecording}
            studioAnalysis={ui.studioAnalysis}
            onOpenTask={ui.openTask}
            onOpenPerson={ui.openPersonFromPalette}
            isRecording={recorder.isRecording}
            analysisStatus={recorder.analysisStatus}
            activeQueueItem={recorder.activeQueueItem}
            selectedMeetingQueue={recorder.selectedMeetingQueue}
            elapsed={recorder.elapsed}
            visualBars={recorder.visualBars}
            voiceActivityStatus={recorder.voiceActivityStatus}
            silenceCountdown={recorder.silenceCountdown}
            resetSilenceTimer={recorder.resetSilenceTimer}
            isPaused={recorder.isPaused}
            pauseRecording={recorder.pauseRecording}
            resumeRecording={recorder.resumeRecording}
            stopRecording={recorder.stopRecording}
            startRecording={recorder.startRecording}
            retryRecordingQueueItem={recorder.retryRecordingQueueItem}
            normalizeRecording={recorder.normalizeRecording}
            recordPermission={recorder.recordPermission}
            speechRecognitionSupported={recorder.speechRecognitionSupported}
            liveText={recorder.liveText}
            liveTranscriptEnabled={recorder.liveTranscriptEnabled}
            setLiveTranscriptEnabled={recorder.setLiveTranscriptEnabled}
            recordingMessage={recorder.recordingMessage}
            pipelineProgressPercent={recorder.pipelineProgressPercent}
            pipelineStageLabel={recorder.pipelineStageLabel}
            setRecordingMessage={recorder.setRecordingMessage}
            retryStoredRecording={recorder.retryStoredRecording}
            selectedRecording={meetings.selectedRecording}
            displaySpeakerNames={ui.displaySpeakerNames}
            selectedRecordingAudioUrl={ui.selectedRecordingAudioUrl}
            selectedRecordingAudioError={ui.selectedRecordingAudioError}
            selectedRecordingAudioStatus={ui.selectedRecordingAudioStatus}
            hydrateRecordingAudio={ui.hydrateRecordingAudio}
            clearAudioHydrationError={ui.clearAudioHydrationError}
            updateTranscriptSegment={meetings.updateTranscriptSegment}
            assignSpeakerToTranscriptSegments={meetings.assignSpeakerToTranscriptSegments}
            mergeTranscriptSegments={meetings.mergeTranscriptSegments}
            splitTranscriptSegment={meetings.splitTranscriptSegment}
            addRecordingMarker={meetings.addRecordingMarker}
            updateRecordingMarker={meetings.updateRecordingMarker}
            deleteRecordingMarker={meetings.deleteRecordingMarker}
            renameSpeaker={meetings.renameSpeaker}
            autoCreateVoiceProfile={meetings.autoCreateVoiceProfile}
            selectedRecordingId={meetings.selectedRecordingId}
            setSelectedRecordingId={meetings.setSelectedRecordingId}
            exportTranscript={ui.exportTranscript}
            exportMeetingNotes={ui.exportMeetingNotes}
            exportMeetingPdfFile={ui.exportMeetingPdfFile}
            meetingTasks={meetings.meetingTasks}
            onCreateTask={meetings.createTaskFromComposer}
            peopleProfiles={meetings.peopleProfiles}
            setSelectedMeetingId={meetings.setSelectedMeetingId}
            isDetachedMeetingDraft={meetings.isDetachedMeetingDraft}
            addMeetingComment={meetings.addMeetingComment}
            currentUserName={workspace.currentUser?.name || workspace.currentUser?.email || 'Ty'}
            defaultToNewStudio={ui.tabHistory.length === 1}
            tagOptions={meetings.taskTags}
          />
        );
    }
  }

  return (
    <ErrorBoundary key={ui.activeTab} label={getActiveTabLabel(ui.activeTab)}>
      <Suspense fallback={<div className="tab-router-loading">Ładowanie ekranu...</div>}>
        {renderActiveTab()}
      </Suspense>
    </ErrorBoundary>
  );
}
