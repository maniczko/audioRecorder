import { useState } from "react";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { MeetingsProvider } from "./context/MeetingsContext";
import { GoogleProvider } from "./context/GoogleContext";
import { RecorderProvider } from "./context/RecorderContext";
import { UIProvider } from "./context/UIContext";

export default function AppProviders({ children }) {
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  return (
    <WorkspaceProvider>
      <MeetingsProvider>
        <GoogleProvider calendarMonth={calendarMonth}>
          <RecorderProvider>
            <UIProvider>
              {typeof children === "function"
                ? children({ calendarMonth, setCalendarMonth })
                : children}
            </UIProvider>
          </RecorderProvider>
        </GoogleProvider>
      </MeetingsProvider>
    </WorkspaceProvider>
  );
}
