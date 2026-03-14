import { useEffect, useMemo, useState } from "react";
import {
  buildCalendarEntries,
  buildMonthMatrix,
  buildTimeSlots,
  buildUpcomingReminders,
  buildWeekDays,
  entriesForDay,
  formatCalendarDayLabel,
  formatCalendarEventTime,
  isCurrentMonth,
  isToday,
  mergeDatePreservingTime,
  mergeDateWithHour,
  monthLabel,
  REMINDER_PRESETS,
  reminderLabel,
  toLocalDateTimeValue,
  weekdayLabels,
} from "./lib/calendarView";
import { formatDateTime } from "./lib/storage";

const CALENDAR_WEEKDAYS = weekdayLabels();
const CALENDAR_HOURS = buildTimeSlots(0, 23);

function eventTypeLabel(type) {
  if (type === "google") {
    return "Google";
  }
  if (type === "task") {
    return "Zadanie";
  }
  return "Spotkanie";
}

function eventTimeLabel(entry) {
  if (!entry.startsAt) {
    return "Caly dzien";
  }

  return formatCalendarEventTime(entry.startsAt);
}

function filterCounts(entries) {
  return {
    meeting: entries.filter((entry) => entry.type === "meeting").length,
    task: entries.filter((entry) => entry.type === "task").length,
    google: entries.filter((entry) => entry.type === "google").length,
  };
}

function filterEntry(filters, entry) {
  return filters[entry.type] !== false;
}

function dragPayloadKey(event) {
  return (
    event.dataTransfer?.getData("application/x-voicelog-calendar") ||
    event.dataTransfer?.getData("text/plain") ||
    ""
  );
}

function writeDragPayload(event, entryKey) {
  if (!event.dataTransfer) {
    return;
  }

  event.dataTransfer.setData("application/x-voicelog-calendar", entryKey);
  event.dataTransfer.setData("text/plain", entryKey);
  event.dataTransfer.effectAllowed = "move";
}

function CalendarFilterButton({ active, count, label, onClick }) {
  return (
    <button type="button" className={active ? "calendar-filter-chip active" : "calendar-filter-chip"} onClick={onClick}>
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function CalendarEntryChip({ entry, selected, onSelect, onDragStart, onDragEnd }) {
  return (
    <span
      role="button"
      tabIndex={0}
      className={
        selected
          ? `calendar-pill ${entry.colorTone} selected`
          : `calendar-pill ${entry.colorTone}${entry.editable ? " draggable" : ""}`
      }
      draggable={entry.editable}
      onDragStart={entry.editable ? onDragStart : undefined}
      onDragEnd={entry.editable ? onDragEnd : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {entry.type === "google" ? "G" : entry.type === "task" ? "T" : "V"} {eventTimeLabel(entry)} {entry.title}
    </span>
  );
}

export default function CalendarTab({
  activeMonth,
  setActiveMonth,
  selectedDate,
  setSelectedDate,
  userMeetings,
  calendarTasks,
  googleCalendarEvents,
  googleCalendarStatus,
  googleCalendarMessage,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  openMeetingFromCalendar,
  openGoogleCalendarForMeeting,
  openTaskFromCalendar,
  googleCalendarEnabled,
  onRescheduleMeeting,
  onRescheduleTask,
  calendarMeta,
  onUpdateCalendarEntryMeta,
}) {
  const [viewMode, setViewMode] = useState("month");
  const [filters, setFilters] = useState({ meeting: true, task: true, google: true });
  const [selectedEntryKey, setSelectedEntryKey] = useState("");
  const [dragEntryKey, setDragEntryKey] = useState("");
  const [calendarMessage, setCalendarMessage] = useState("");

  const monthMatrix = useMemo(() => buildMonthMatrix(activeMonth), [activeMonth]);
  const miniMatrix = useMemo(() => buildMonthMatrix(activeMonth), [activeMonth]);
  const weekDays = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const allEntries = useMemo(
    () => buildCalendarEntries(userMeetings, googleCalendarEvents, calendarTasks, calendarMeta),
    [calendarMeta, calendarTasks, googleCalendarEvents, userMeetings]
  );
  const visibleEntries = useMemo(() => allEntries.filter((entry) => filterEntry(filters, entry)), [allEntries, filters]);
  const selectedDayEntries = useMemo(
    () => entriesForDay(visibleEntries, selectedDate),
    [selectedDate, visibleEntries]
  );
  const entryCounts = useMemo(() => filterCounts(allEntries), [allEntries]);
  const upcomingMeetings = useMemo(
    () =>
      [...userMeetings]
        .filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
        .slice(0, 6),
    [userMeetings]
  );
  const upcomingTasks = useMemo(
    () =>
      [...calendarTasks]
        .filter((task) => Boolean(task.dueDate) && !task.completed)
        .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
        .slice(0, 6),
    [calendarTasks]
  );
  const upcomingReminders = useMemo(() => buildUpcomingReminders(visibleEntries), [visibleEntries]);

  useEffect(() => {
    if (selectedEntryKey && visibleEntries.some((entry) => entry.key === selectedEntryKey)) {
      return;
    }

    setSelectedEntryKey(selectedDayEntries[0]?.key || "");
  }, [selectedDayEntries, selectedEntryKey, visibleEntries]);

  const selectedEntry =
    visibleEntries.find((entry) => entry.key === selectedEntryKey) ||
    selectedDayEntries[0] ||
    null;

  function shiftPeriod(amount) {
    if (viewMode === "month") {
      setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + amount, 1));
      return;
    }

    const delta = viewMode === "week" ? amount * 7 : amount;
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + delta);
    setSelectedDate(nextDate);
    setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }

  function jumpToToday() {
    const today = new Date();
    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today);
    setCalendarMessage("");
  }

  function toggleFilter(type) {
    setFilters((previous) => ({
      ...previous,
      [type]: !previous[type],
    }));
  }

  function selectEntry(entry) {
    setSelectedEntryKey(entry.key);
    const entryDate = new Date(entry.startsAt);
    setSelectedDate(entryDate);
    setActiveMonth(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1));
  }

  function rescheduleEntry(entry, nextStartsAt) {
    if (!entry || !entry.editable) {
      return;
    }

    if (entry.type === "meeting") {
      onRescheduleMeeting(entry.id, nextStartsAt);
      setCalendarMessage(`Przeniesiono spotkanie "${entry.title}".`);
    } else if (entry.type === "task") {
      onRescheduleTask(entry.id, nextStartsAt);
      setCalendarMessage(`Zmieniono termin zadania "${entry.title}".`);
    }

    const nextDate = new Date(nextStartsAt);
    setSelectedDate(nextDate);
    setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }

  function handleDrop(date, event, hour = null) {
    event.preventDefault();
    const entryKey = dragPayloadKey(event) || dragEntryKey;
    const entry = allEntries.find((item) => item.key === entryKey);
    if (!entry || !entry.editable) {
      return;
    }

    const nextStartsAt =
      typeof hour === "number" ? mergeDateWithHour(date, hour, entry.startsAt) : mergeDatePreservingTime(date, entry.startsAt);

    rescheduleEntry(entry, nextStartsAt);
    setSelectedEntryKey(entry.key);
    setDragEntryKey("");
  }

  function renderMonthView() {
    return (
      <>
        <div className="calendar-weekdays">
          {CALENDAR_WEEKDAYS.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {monthMatrix.flat().map((date) => {
            const entries = entriesForDay(visibleEntries, date).slice(0, 4);
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
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(date, event)}
              >
                <div className={today ? "calendar-day-number today" : "calendar-day-number"}>{date.getDate()}</div>
                <div className="calendar-day-events">
                  {entries.map((entry) => (
                    <CalendarEntryChip
                      key={entry.key}
                      entry={entry}
                      selected={selectedEntryKey === entry.key}
                      onSelect={() => selectEntry(entry)}
                      onDragStart={(event) => {
                        setDragEntryKey(entry.key);
                        writeDragPayload(event, entry.key);
                      }}
                      onDragEnd={() => setDragEntryKey("")}
                    />
                  ))}
                  {entriesForDay(visibleEntries, date).length > entries.length ? (
                    <span className="calendar-more-indicator">+{entriesForDay(visibleEntries, date).length - entries.length} wiecej</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </>
    );
  }

  function renderWeekView() {
    return (
      <div className="calendar-week-view">
        {weekDays.map((day) => {
          const entries = entriesForDay(visibleEntries, day);
          return (
            <section
              key={day.toISOString()}
              className="calendar-column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(day, event)}
            >
              <header className="calendar-column-head">
                <strong>{formatCalendarDayLabel(day, { short: true })}</strong>
                <span>{day.getDate()}</span>
              </header>
              <div className="calendar-column-body">
                {entries.length ? (
                  entries.map((entry) => (
                    <CalendarEntryChip
                      key={entry.key}
                      entry={entry}
                      selected={selectedEntryKey === entry.key}
                      onSelect={() => selectEntry(entry)}
                      onDragStart={(event) => {
                        setDragEntryKey(entry.key);
                        writeDragPayload(event, entry.key);
                      }}
                      onDragEnd={() => setDragEntryKey("")}
                    />
                  ))
                ) : (
                  <div className="calendar-column-empty">Upusc tutaj spotkanie lub zadanie.</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  function renderDayView() {
    return (
      <div className="calendar-day-view">
        {CALENDAR_HOURS.map((hour) => {
          const entries = selectedDayEntries.filter((entry) => new Date(entry.startsAt).getHours() === hour);
          return (
            <div key={hour} className="calendar-time-row">
              <div className="calendar-time-label">{String(hour).padStart(2, "0")}:00</div>
              <div
                className="calendar-time-slot"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(selectedDate, event, hour)}
              >
                {entries.length ? (
                  entries.map((entry) => (
                    <CalendarEntryChip
                      key={entry.key}
                      entry={entry}
                      selected={selectedEntryKey === entry.key}
                      onSelect={() => selectEntry(entry)}
                      onDragStart={(event) => {
                        setDragEntryKey(entry.key);
                        writeDragPayload(event, entry.key);
                      }}
                      onDragEnd={() => setDragEntryKey("")}
                    />
                  ))
                ) : (
                  <span className="calendar-slot-placeholder">Przeciagnij tutaj wydarzenie</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
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
            <button type="button" className="calendar-nav-button" onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}>
              {"\u2039"}
            </button>
            <strong>{monthLabel(activeMonth)}</strong>
            <button type="button" className="calendar-nav-button" onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}>
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
              <div className="eyebrow">Filtry</div>
              <h2>Widoczne zrodla</h2>
            </div>
          </div>
          <div className="calendar-filter-stack">
            <CalendarFilterButton
              active={filters.meeting}
              count={entryCounts.meeting}
              label="Spotkania"
              onClick={() => toggleFilter("meeting")}
            />
            <CalendarFilterButton
              active={filters.task}
              count={entryCounts.task}
              label="Zadania"
              onClick={() => toggleFilter("task")}
            />
            <CalendarFilterButton
              active={filters.google}
              count={entryCounts.google}
              label="Google"
              onClick={() => toggleFilter("google")}
            />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Przypomnienia</div>
              <h2>Nadchodzace alerty</h2>
            </div>
          </div>
          <div className="agenda-list">
            {upcomingReminders.length ? (
              upcomingReminders.slice(0, 6).map((reminder) => (
                <button
                  type="button"
                  key={reminder.id}
                  className="agenda-card"
                  onClick={() => {
                    const entry = visibleEntries.find((item) => item.key === reminder.entryKey);
                    if (entry) {
                      selectEntry(entry);
                    }
                  }}
                >
                  <strong>{reminder.title}</strong>
                  <span>{reminderLabel(reminder.minutes)} przed wydarzeniem</span>
                  <span>{formatDateTime(reminder.remindAt)}</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak aktywnych przypomnien</strong>
                <span>Wybierz spotkanie lub zadanie i ustaw przypomnienie w panelu po prawej.</span>
              </div>
            )}
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

        <section className="panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Tasks</div>
              <h2>Najblizsze terminy</h2>
            </div>
          </div>
          <div className="agenda-list">
            {upcomingTasks.length ? (
              upcomingTasks.map((task) => (
                <button type="button" key={task.id} className="agenda-card" onClick={() => openTaskFromCalendar(task.id)}>
                  <strong>{task.title}</strong>
                  <span>{formatDateTime(task.dueDate)}</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak terminow zadan</strong>
                <span>Dodaj termin do zadania, a pojawi sie tutaj i w miesiecznym widoku.</span>
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
            <button type="button" className="calendar-nav-button" onClick={() => shiftPeriod(-1)}>
              {"\u2039"}
            </button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftPeriod(1)}>
              {"\u203A"}
            </button>
            <div>
              <div className="eyebrow">Calendar tab</div>
              <h2>{viewMode === "month" ? monthLabel(activeMonth) : formatCalendarDayLabel(selectedDate, { month: true })}</h2>
            </div>
          </div>
          <div className="calendar-toolbar">
            <div className="calendar-view-switch">
              <button type="button" className={viewMode === "month" ? "calendar-view-button active" : "calendar-view-button"} onClick={() => setViewMode("month")}>
                Miesiac
              </button>
              <button type="button" className={viewMode === "week" ? "calendar-view-button active" : "calendar-view-button"} onClick={() => setViewMode("week")}>
                Tydzien
              </button>
              <button type="button" className={viewMode === "day" ? "calendar-view-button active" : "calendar-view-button"} onClick={() => setViewMode("day")}>
                Dzien
              </button>
            </div>
            <div className="status-cluster">
              <span className="status-chip">{userMeetings.length} spotkan VoiceLog</span>
              <span className="status-chip">{googleCalendarEvents.length} wydarzen Google</span>
              <span className="status-chip">{calendarTasks.length} terminow zadan</span>
            </div>
          </div>
        </div>

        {calendarMessage ? <div className="inline-alert info">{calendarMessage}</div> : null}

        {viewMode === "month" ? renderMonthView() : viewMode === "week" ? renderWeekView() : renderDayView()}

        <div className="calendar-lower-grid">
          <div className="selected-day-panel">
            <div className="panel-header compact">
              <div>
                <div className="eyebrow">Agenda dnia</div>
                <h2>{formatCalendarDayLabel(selectedDate, { month: true })}</h2>
              </div>
            </div>

            <div className="agenda-list">
              {selectedDayEntries.length ? (
                selectedDayEntries.map((entry) => (
                  <div
                    key={entry.key}
                    className={selectedEntryKey === entry.key ? "agenda-card static selected" : "agenda-card static"}
                    onClick={() => selectEntry(entry)}
                  >
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
                    ) : entry.type === "task" ? (
                      <div className="button-row">
                        <button type="button" className="ghost-button" onClick={() => openTaskFromCalendar(entry.id)}>
                          Otworz w Zadaniach
                        </button>
                      </div>
                    ) : entry.htmlLink ? (
                      <div className="button-row">
                        <button type="button" className="ghost-button" onClick={() => window.open(entry.htmlLink, "_blank", "noopener,noreferrer")}>
                          Otworz w Google
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

          <div className="selected-day-panel">
            <div className="panel-header compact">
              <div>
                <div className="eyebrow">Inspektor</div>
                <h2>{selectedEntry ? selectedEntry.title : "Wybierz wydarzenie"}</h2>
              </div>
            </div>

            {selectedEntry ? (
              <div className="calendar-editor-card">
                <div className="calendar-editor-meta">
                  <span className={`calendar-source-pill ${selectedEntry.type}`}>{eventTypeLabel(selectedEntry.type)}</span>
                  <span>{formatDateTime(selectedEntry.startsAt)}</span>
                </div>
                <label className="calendar-editor-field">
                  <span>{selectedEntry.type === "task" ? "Termin" : "Start"}</span>
                  <input
                    type="datetime-local"
                    value={toLocalDateTimeValue(selectedEntry.startsAt)}
                    onChange={(event) => rescheduleEntry(selectedEntry, new Date(event.target.value).toISOString())}
                    disabled={!selectedEntry.editable}
                  />
                </label>
                <div className="calendar-editor-field">
                  <span>Przypomnienia</span>
                  {selectedEntry.editable ? (
                    <div className="calendar-reminder-grid">
                      {REMINDER_PRESETS.map((preset) => {
                        const active = selectedEntry.reminders.includes(preset.value);
                        return (
                          <button
                            key={preset.value}
                            type="button"
                            className={active ? "calendar-reminder-chip active" : "calendar-reminder-chip"}
                            onClick={() =>
                              onUpdateCalendarEntryMeta(selectedEntry.type, selectedEntry.id, {
                                reminders: active
                                  ? selectedEntry.reminders.filter((value) => value !== preset.value)
                                  : [...selectedEntry.reminders, preset.value],
                              })
                            }
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="calendar-readonly-note">Wydarzenia Google sa obecnie tylko do odczytu.</div>
                  )}
                </div>
                <div className="calendar-editor-field">
                  <span>Szybkie akcje</span>
                  <div className="button-row">
                    {selectedEntry.type === "meeting" ? (
                      <>
                        <button type="button" className="ghost-button" onClick={() => openMeetingFromCalendar(selectedEntry.id)}>
                          Otworz w Studio
                        </button>
                        <button type="button" className="ghost-button" onClick={() => openGoogleCalendarForMeeting(selectedEntry.id)}>
                          Google Calendar
                        </button>
                      </>
                    ) : selectedEntry.type === "task" ? (
                      <button type="button" className="ghost-button" onClick={() => openTaskFromCalendar(selectedEntry.id)}>
                        Otworz zadanie
                      </button>
                    ) : selectedEntry.htmlLink ? (
                      <button type="button" className="ghost-button" onClick={() => window.open(selectedEntry.htmlLink, "_blank", "noopener,noreferrer")}>
                        Otworz w Google
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-panel">
                <strong>Brak wybranego wydarzenia</strong>
                <span>Kliknij spotkanie, zadanie albo wydarzenie Google, aby zmienic termin lub przypomnienia.</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
