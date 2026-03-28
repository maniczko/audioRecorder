import AppProviders from './AppProviders';
import AppShellModern from './AppShellModern';

export default function MainApp() {
  return (
    <AppProviders>
      {({ calendarMonth, setCalendarMonth }) => (
        <AppShellModern calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />
      )}
    </AppProviders>
  );
}
