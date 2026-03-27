import AppProviders from './AppProviders';
import AppShellModern from './AppShellModern';
import useUI from './hooks/useUI';

export default function MainApp() {
  return (
    <AppProviders>
      {({ calendarMonth, setCalendarMonth }) => (
        <AppShellModern calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />
      )}
    </AppProviders>
  );
}
