import AppProviders from "./AppProviders";
import AppShell from "./AppShell";

export default function MainApp() {
  return (
    <AppProviders>
      {({ calendarMonth, setCalendarMonth }) => (
        <AppShell calendarMonth={calendarMonth} setCalendarMonth={setCalendarMonth} />
      )}
    </AppProviders>
  );
}
