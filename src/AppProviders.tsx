import { ReactNode, useState } from 'react';
import { GoogleProvider } from './context/GoogleContext';
import { MicrosoftProvider } from './context/MicrosftContext';
import { MeetingsProvider } from './context/MeetingsContext';
import { RecorderProvider } from './context/RecorderContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import MeetingsSyncManager from './components/MeetingsSyncManager';

export default function AppProviders({
  children,
}: {
  children: ReactNode | ((props: any) => ReactNode);
}) {
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  return (
    <WorkspaceProvider>
      <MeetingsProvider>
        <MeetingsSyncManager>
          <GoogleProvider calendarMonth={calendarMonth}>
            <MicrosoftProvider calendarMonth={calendarMonth}>
              <RecorderProvider>
                {typeof children === 'function'
                  ? (children as any)({ calendarMonth, setCalendarMonth })
                  : children}
              </RecorderProvider>
            </MicrosoftProvider>
          </GoogleProvider>
        </MeetingsSyncManager>
      </MeetingsProvider>
    </WorkspaceProvider>
  );
}
