import {
  formatCalendarEventTime,
  isCurrentMonth,
  isToday,
  meetingsForDay,
  monthLabel,
  weekdayLabels,
} from "./lib/calendarView";
import { formatDateTime } from "./lib/storage";

const CALENDAR_WEEKDAYS = weekdayLabels();

function eventTypeLabel(type) {
  return type === "google" ? "Google" : "VoiceLog";
}

function eventTimeLabel(entry) {
  if (!entry.startsAt) {
    return "Caly dzien";
  }

  return formatCalendarEventTime(entry.startsAt);
}

export default function CalendarTab({
  activeMonth,
  setActiveMonth,
  selectedDate,
  setSelectedDate,
  monthMatrix,
  miniMatrix,
  bucket,
  userMeetings,
  googleCalendarEvents,
  googleCalendarStatus,
  googleCalendarMessage,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  openMeetingFromCalendar,
  openGoogleCalendarForMeeting,
  googleCalendarEnabled,
}) {
  const selectedDayEntries = meetingsForDay(bucket, selectedDate).sort(
    (left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime()
  );
  const upcomingMeetings = [...userMeetings]
    .filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .slice(0, 6);

  function shiftMonth(amount) {
    setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + amount, 1));
  }

  function jumpToToday() {
    const today = new Date();
    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
  }

  return (
    <div className="calendar-layout">
      <aside className="calendar-sidebar">
        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Kalendarz</div>
              <h2>Mini month</h2>
            </div>
          </div>

          <div className="mini-calendar-header">
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(-1)}>
              {"\u2039"}
            </button>
            <strong>{monthLabel(activeMonth)}</strong>
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(1)}>
              {"\u203A"}
            </button>
          </div>

          <div className="mini-calendar-grid">
            {CALENDAR_WEEKDAYS.map((label) => (
              <span key={label} className="mini-calendar-weekday">
                {label}
              </span>
            ))}
            {miniMatrix.flat().map((date) => {
              const inMonth = isCurrentMonth(date, activeMonth);
              const today = isToday(date);
              const selected = date.toDateString() === selectedDate.toDateString();
              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  className={selected ? "mini-day selected" : today ? "mini-day today" : "mini-day"}
                  data-faded={!inMonth}
                  onClick={() => {
                    setSelectedDate(date);
                    setActiveMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Google Calendar</div>
              <h2>Synchronizacja</h2>
            </div>
          </div>

          <div className="calendar-sync-card">
            <p>
              {googleCalendarEnabled
                ? "Po zalogowaniu mozesz pobrac wydarzenia z podstawowego kalendarza Google i zobaczyc je obok spotkan VoiceLog."
                : "Dodaj Google Client ID, aby wlaczyc logowanie Google i import wydarzen."}
            </p>
            <div className="button-row">
              <button
                type="button"
                className="secondary-button"
                onClick={connectGoogleCalendar}
                disabled={!googleCalendarEnabled || googleCalendarStatus === "loading"}
              >
                {googleCalendarStatus === "loading" ? "Laczenie..." : "Pobierz wydarzenia Google"}
              </button>
              {googleCalendarEvents.length ? (
                <button type="button" className="ghost-button" onClick={disconnectGoogleCalendar}>
                  Odlacz
                </button>
              ) : null}
            </div>
            {googleCalendarMessage ? <div className="inline-alert info">{googleCalendarMessage}</div> : null}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Upcoming</div>
              <h2>Najblizsze spotkania</h2>
            </div>
          </div>
          <div className="agenda-list">
            {upcomingMeetings.length ? (
              upcomingMeetings.map((meeting) => (
                <button type="button" key={meeting.id} className="agenda-card" onClick={() => openMeetingFromCalendar(meeting.id)}>
                  <strong>{meeting.title}</strong>
                  <span>{formatDateTime(meeting.startsAt)}</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak zaplanowanych spotkan</strong>
                <span>Dodaj spotkanie w zakladce Studio, a pojawi sie tutaj automatycznie.</span>
              </div>
            )}
          </div>
        </section>
      </aside>

      <section className="panel calendar-board">
        <div className="calendar-board-header">
          <div className="calendar-board-actions">
            <button type="button" className="secondary-button" onClick={jumpToToday}>
              Dzisiaj
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(-1)}>
              {"\u2039"}
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftMonth(1)}>
              {"\u203A"}
            </button>
            <div>
              <div className="eyebrow">Calendar tab</div>
              <h2>{monthLabel(activeMonth)}</h2>
            </div>
          </div>
          <div className="status-cluster">
            <span className="status-chip">{userMeetings.length} spotkan VoiceLog</span>
            <span className="status-chip">{googleCalendarEvents.length} wydarzen Google</span>
          </div>
        </div>

        <div className="calendar-weekdays">
          {CALENDAR_WEEKDAYS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {monthMatrix.flat().map((date) => {
            const entries = meetingsForDay(bucket, date)
              .sort((left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime())
              .slice(0, 4);
            const currentMonth = isCurrentMonth(date, activeMonth);
            const today = isToday(date);
            const selected = date.toDateString() === selectedDate.toDateString();
            return (
              <button
                type="button"
                key={date.toISOString()}
                className={selected ? "calendar-day selected" : "calendar-day"}
                data-muted={!currentMonth}
                onClick={() => setSelectedDate(date)}
              >
                <div className={today ? "calendar-day-number today" : "calendar-day-number"}>{date.getDate()}</div>
                <div className="calendar-day-events">
                  {entries.map((entry) => (
                    <span
                      key={`${entry.type}-${entry.id}`}
                      className={entry.type === "google" ? "calendar-pill google" : "calendar-pill meeting"}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (entry.type === "meeting") {
                          openMeetingFromCalendar(entry.id);
                        }
                      }}
                    >
                      {entry.type === "google" ? "G" : "V"} {eventTimeLabel(entry)} {entry.title}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="selected-day-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Agenda dnia</div>
              <h2>{formatDateTime(selectedDate)}</h2>
            </div>
          </div>

          <div className="agenda-list">
            {selectedDayEntries.length ? (
              selectedDayEntries.map((entry) => (
                <div key={`${entry.type}-${entry.id}`} className="agenda-card static">
                  <div className="agenda-card-top">
                    <strong>{entry.title}</strong>
                    <span>{eventTypeLabel(entry.type)}</span>
                  </div>
                  <p>{eventTimeLabel(entry)}</p>
                  {entry.type === "meeting" ? (
                    <div className="button-row">
                      <button type="button" className="ghost-button" onClick={() => openMeetingFromCalendar(entry.id)}>
                        Otworz w Studio
                      </button>
                      <button type="button" className="ghost-button" onClick={() => openGoogleCalendarForMeeting(entry.id)}>
                        Otworz w Google Calendar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Ten dzien jest pusty</strong>
                <span>Wybierz inny dzien albo dodaj nowe spotkanie.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
