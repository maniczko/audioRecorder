import AppProviders from './AppProviders';
import AppShell from './AppShell';
import AppShellModern from './AppShellModern';
import useUI from './hooks/useUI';
export default function MainApp() {
  return (
    <AppProviders>
      {({ calendarMonth, setCalendarMonth }) => (
        <AppShellSelector calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />
      )}
    </AppProviders>
  );
}

function AppShellSelector({ calendarMonth, setCalendarMonth }) {
  const { layoutPreset } = useUI();

  if (layoutPreset === 'modern') {
    return <AppShellModern calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />;
  }

  return <AppShell calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />;
}
