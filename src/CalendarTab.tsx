// @ts-nocheck
import './styles/calendar.css';
import { useEffect, useMemo, useRef, useState } from "react";
import {
  REMINDER_PRESETS,
  buildCalendarEntries,
  buildConflictMap,
  buildMonthMatrix,
  buildParticipantTimezoneSummary,
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
  reminderLabel,
  resizeCalendarEntry,
  toLocalDateTimeValue,
  weekdayLabels,
} from "./lib/calendarView";
import { formatDateTime } from "./lib/storage";
import './CalendarTabStyles.css';

const CALENDAR_WEEKDAYS = weekdayLabels();
const CALENDAR_HOURS = buildTimeSlots(0, 23);

function eventTypeLabel(type) {
  return type === "google" ? "Google" : type === "task" ? "Zadanie" : "Spotkanie";
}

function eventTimeLabel(entry) {
  return entry?.startsAt
    ? `${formatCalendarEventTime(entry.startsAt)}${entry.endsAt ? ` - ${formatCalendarEventTime(entry.endsAt)}` : ""}`
    : "Caly dzien";
}

function buildConflictDraft(conflict) {
  const snapshot = conflict?.finalSnapshot || conflict?.localSnapshot || null;
  if (!snapshot) {
    return {
      title: "",
      startsAt: "",
      durationMinutes: 15,
      location: "",
    };
  }

  return {
    title: snapshot.title || "",
    startsAt: toLocalDateTimeValue(snapshot.startsAt),
    durationMinutes: Number(snapshot.durationMinutes) || 15,
    location: snapshot.location || "",
  };
}

function buildGoogleAttendees(entry, workspaceMembers) {
  return (entry.participants || [])
    .map((participant) => {
      const match = workspaceMembers.find((member) =>
        [member.name, member.email, member.googleEmail]
          .map((value) => String(value || "").trim().toLowerCase())
          .includes(String(participant || "").trim().toLowerCase())
      );
      return {
        email: match?.googleEmail || match?.email || "",
        displayName: match?.name || participant,
      };
    })
    .filter((participant) => participant.email);
}

function CalendarFilterButton({ active, count, label, onClick }) {
  return (
    <button type="button" className={active ? "calendar-filter-chip active" : "calendar-filter-chip"} onClick={onClick}>
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function CalendarEntryChip({ entry, selected, conflictCount, onSelect, onDragStart, onDragEnd, onResize, showResize }) {
  return (
    <span
      role="button"
      tabIndex={0}
      className={`${selected ? "calendar-pill selected" : "calendar-pill"} ${entry.colorTone}${entry.editable ? " draggable" : ""}${conflictCount ? " conflict" : ""}`}
      draggable={entry.editable}
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
      onDragStart={entry.editable ? onDragStart : undefined}
      onDragEnd={entry.editable ? onDragEnd : undefined}
    >
      <span className="calendar-pill-main">
        {entry.type === "google" ? "G" : entry.type === "task" ? "T" : "V"} {eventTimeLabel(entry)} {entry.title}
      </span>
      {conflictCount ? <small className="calendar-pill-conflict">{conflictCount} konflikt</small> : null}
      {showResize && entry.editable ? (
        <span className="calendar-pill-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="calendar-resize-button" onClick={() => onResize(-30)}>
            -30
          </button>
          <button type="button" className="calendar-resize-button" onClick={() => onResize(30)}>
            +30
          </button>
        </span>
      ) : null}
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
  googleCalendarMessage,
  disconnectGoogleCalendar,
  syncCalendarEntryToGoogle,
  rescheduleGoogleCalendarEntry,
  openMeetingFromCalendar,
  openGoogleCalendarForMeeting,
  openTaskFromCalendar,
  googleCalendarWritable,
  onRescheduleMeeting,
  onRescheduleTask,
  calendarMeta,
  onUpdateCalendarEntryMeta,
  onApplyCalendarSyncSnapshot,
  workspaceMembers = [],
  peopleProfiles = [],
  currentUserTimezone = "Europe/Warsaw",
  startNewMeetingDraft,
  onNavigateToStudio,
  onCreateMeeting,
}) {
  const [viewMode, setViewMode] = useState("month");
  const [filters, setFilters] = useState({ meeting: true, task: true, google: true });
  const [selectedEntryKey, setSelectedEntryKey] = useState("");
  const [dragEntryKey, setDragEntryKey] = useState("");
  const [calendarMessage, setCalendarMessage] = useState("");
  const [conflictDraft, setConflictDraft] = useState(buildConflictDraft(null));
  const [tagFilter, setTagFilter] = useState("");
  const [calendarCreateForm, setCalendarCreateForm] = useState(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const currentTimeRef = useRef(null);
  const allMeetingTags = useMemo(() => {
    const s = new Set();
    userMeetings.forEach((m) => (m.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [userMeetings]);

  const monthMatrix = useMemo(() => buildMonthMatrix(activeMonth), [activeMonth]);
  const miniMatrix = useMemo(() => buildMonthMatrix(activeMonth), [activeMonth]);
  const weekDays = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const allEntries = useMemo(() => buildCalendarEntries(userMeetings, googleCalendarEvents, calendarTasks, calendarMeta), [calendarMeta, calendarTasks, googleCalendarEvents, userMeetings]);
  const visibleEntries = useMemo(
    () => allEntries.filter((entry) => {
      if (filters[entry.type] === false) return false;
      if (tagFilter && entry.type !== "google") {
        const entryTags = entry.source?.tags || [];
        if (!entryTags.includes(tagFilter)) return false;
      }
      return true;
    }),
    [allEntries, filters, tagFilter]
  );
  const selectedDayEntries = useMemo(() => entriesForDay(visibleEntries, selectedDate), [selectedDate, visibleEntries]);
  const conflictMap = useMemo(() => buildConflictMap(visibleEntries), [visibleEntries]);
  const reminders = useMemo(() => buildUpcomingReminders(visibleEntries), [visibleEntries]);
  const upcomingMeetings = useMemo(
    () =>
      [...userMeetings]
        .filter((meeting) => new Date(meeting.startsAt).getTime() >= Date.now() - 6 * 60 * 60 * 1000)
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
        .slice(0, 4),
    [userMeetings]
  );
  const upcomingTasks = useMemo(
    () =>
      [...calendarTasks]
        .filter((task) => Boolean(task.dueDate) && !task.completed)
        .sort((left, right) => new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime())
        .slice(0, 4),
    [calendarTasks]
  );

  useEffect(() => {
    if (!selectedEntryKey || !visibleEntries.some((entry) => entry.key === selectedEntryKey)) {
      setSelectedEntryKey(selectedDayEntries[0]?.key || "");
    }
  }, [selectedDayEntries, selectedEntryKey, visibleEntries]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (viewMode === "day" && currentTimeRef.current) {
      currentTimeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [viewMode]);

  const selectedEntry = visibleEntries.find((entry) => entry.key === selectedEntryKey) || selectedDayEntries[0] || null;
  const selectedMeta = selectedEntry ? calendarMeta?.[`${selectedEntry.type}:${selectedEntry.id}`] || {} : {};
  const selectedConflicts = selectedEntry ? conflictMap[selectedEntry.key] || [] : [];
  const participantTimezones = useMemo(
    () => buildParticipantTimezoneSummary(selectedEntry, workspaceMembers, peopleProfiles, currentUserTimezone),
    [currentUserTimezone, peopleProfiles, selectedEntry, workspaceMembers]
  );

  useEffect(() => {
    setConflictDraft(buildConflictDraft(selectedMeta.googleSyncConflict));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntryKey, selectedMeta.googleSyncConflict?.id]);

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

  async function syncToGoogle(entry, startsAt = entry.startsAt, endsAt = entry.endsAt) {
    if (!entry || entry.type === "google" || !googleCalendarWritable || typeof syncCalendarEntryToGoogle !== "function") {
      return;
    }
    const response = await syncCalendarEntryToGoogle(
      { ...entry, startsAt, endsAt },
      {
        googleEventId: selectedMeta.googleEventId || entry.googleEventId,
        description: entry.source?.context || entry.source?.description || entry.source?.notes || "",
        location: entry.source?.location || "",
        attendees: buildGoogleAttendees(entry, workspaceMembers),
        reminders: selectedMeta.reminders || [],
      }
    );
    onUpdateCalendarEntryMeta(entry.type, entry.id, {
      googleEventId: response.id,
      googleHtmlLink: response.htmlLink || "",
      googleSyncedAt: new Date().toISOString(),
    });
  }

  async function rescheduleEntry(entry, startsAt, endsAt = null) {
    if (!entry?.editable) {
      return;
    }
    const nextEnd = endsAt || resizeCalendarEntry(entry, 0).endsAt;
    if (entry.type === "meeting") {
      onRescheduleMeeting(entry.id, startsAt);
      onUpdateCalendarEntryMeta(entry.type, entry.id, { durationMinutes: Math.max(15, Math.round((new Date(nextEnd).getTime() - new Date(startsAt).getTime()) / 60000)) });
      if (selectedMeta.googleEventId || entry.googleEventId) {
        await syncToGoogle(entry, startsAt, nextEnd);
      }
    } else if (entry.type === "task") {
      onRescheduleTask(entry.id, startsAt);
      onUpdateCalendarEntryMeta(entry.type, entry.id, { durationMinutes: Math.max(15, Math.round((new Date(nextEnd).getTime() - new Date(startsAt).getTime()) / 60000)) });
      if (selectedMeta.googleEventId || entry.googleEventId) {
        await syncToGoogle(entry, startsAt, nextEnd);
      }
    } else {
      await rescheduleGoogleCalendarEntry?.(entry.id, startsAt, nextEnd);
    }
    setCalendarMessage(`Zmieniono termin: ${entry.title}`);
    const nextDate = new Date(startsAt);
    setSelectedDate(nextDate);
    setActiveMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }

  async function resolveGoogleSyncConflict(mode) {
    if (!selectedEntry || !selectedMeta.googleSyncConflict) {
      return;
    }

    const now = new Date().toISOString();
    const snapshot =
      mode === "google"
        ? selectedMeta.googleSyncConflict.remoteSnapshot
        : {
            ...(mode === "local" ? selectedMeta.googleSyncConflict.localSnapshot : selectedMeta.googleSyncConflict.finalSnapshot),
            title: conflictDraft.title,
            startsAt: conflictDraft.startsAt ? new Date(conflictDraft.startsAt).toISOString() : selectedEntry.startsAt,
            durationMinutes: Math.max(15, Number(conflictDraft.durationMinutes) || 15),
            location: conflictDraft.location,
          };
    const endsAt =
      snapshot.endsAt ||
      new Date(new Date(snapshot.startsAt).getTime() + Number(snapshot.durationMinutes || 15) * 60000).toISOString();
    const finalSnapshot = {
      ...snapshot,
      endsAt,
    };

    if (mode === "google") {
      onApplyCalendarSyncSnapshot?.(selectedEntry.type, selectedEntry.id, finalSnapshot, {
        googleSyncConflict: null,
        googlePulledAt: now,
        googleRemoteUpdatedAt: selectedMeta.googleSyncConflict.remoteUpdatedAt || now,
      });
      setCalendarMessage(`Przyjeto wersje Google dla "${selectedEntry.title}".`);
      return;
    }

    if (!googleCalendarWritable) {
      setCalendarMessage("Polacz Google Calendar, aby zapisac finalna wersje po konflikcie.");
      return;
    }

    onApplyCalendarSyncSnapshot?.(selectedEntry.type, selectedEntry.id, finalSnapshot);
    await syncToGoogle(
      {
        ...selectedEntry,
        title: finalSnapshot.title,
        startsAt: finalSnapshot.startsAt,
        endsAt: finalSnapshot.endsAt,
        source: {
          ...(selectedEntry.source || {}),
          location: finalSnapshot.location,
        },
      },
      finalSnapshot.startsAt,
      finalSnapshot.endsAt
    );
    onUpdateCalendarEntryMeta(selectedEntry.type, selectedEntry.id, {
      googleSyncConflict: null,
      googleSyncedAt: now,
      googlePulledAt: now,
      googleConflictResolvedAt: now,
    });
    setCalendarMessage(
      mode === "merge"
        ? `Scalono lokalne i zdalne zmiany dla "${selectedEntry.title}".`
        : `Zachowano lokalna wersje "${selectedEntry.title}" i zsynchronizowano ja do Google.`
    );
  }

  async function resizeEntry(entry, deltaMinutes) {
    const nextWindow = resizeCalendarEntry(entry, deltaMinutes);
    if (entry.type === "google") {
      await rescheduleGoogleCalendarEntry?.(entry.id, nextWindow.startsAt, nextWindow.endsAt);
    } else {
      onUpdateCalendarEntryMeta(entry.type, entry.id, { durationMinutes: nextWindow.durationMinutes });
      if (selectedMeta.googleEventId || entry.googleEventId) {
        await syncToGoogle(entry, entry.startsAt, nextWindow.endsAt);
      }
    }
    setCalendarMessage(`Zmieniono dlugosc: ${entry.title}`);
  }

  async function handleDrop(date, event, hour = null) {
    event.preventDefault();
    const entryKey = event.dataTransfer?.getData("application/x-voicelog-calendar") || event.dataTransfer?.getData("text/plain") || dragEntryKey;
    const entry = allEntries.find((item) => item.key === entryKey);
    if (!entry?.editable) {
      return;
    }
    const startsAt = typeof hour === "number" ? mergeDateWithHour(date, hour, entry.startsAt) : mergeDatePreservingTime(date, entry.startsAt);
    await rescheduleEntry(entry, startsAt);
    setSelectedEntryKey(entry.key);
    setDragEntryKey("");
  }

  function createMeetingFromSlot(date, hour) {
    const startsAt = new Date(date);
    startsAt.setHours(hour, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    const localStr = `${startsAt.getFullYear()}-${pad(startsAt.getMonth()+1)}-${pad(startsAt.getDate())}T${pad(startsAt.getHours())}:00`;
    setCalendarCreateForm({ startsAt: localStr, title: "", durationMinutes: 30 });
  }

  function createMeetingFromDay(date) {
    const pad = (n) => String(n).padStart(2, "0");
    const localStr = `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T09:00`;
    setCalendarCreateForm({ startsAt: localStr, title: "", durationMinutes: 30 });
  }

  const isToday_ = selectedDate.toDateString() === new Date().toDateString();
  const currentHour = Math.floor(currentTimeMinutes / 60);

  function renderEntry(entry, showResize = false) {
    return (
      <CalendarEntryChip
        key={entry.key}
        entry={entry}
        selected={selectedEntryKey === entry.key}
        conflictCount={(conflictMap[entry.key] || []).length}
        showResize={showResize}
        onResize={(delta) => resizeEntry(entry, delta)}
        onSelect={() => {
          setSelectedEntryKey(entry.key);
          const date = new Date(entry.startsAt);
          setSelectedDate(date);
          setActiveMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        }}
        onDragStart={(event) => {
          setDragEntryKey(entry.key);
          event.dataTransfer?.setData("application/x-voicelog-calendar", entry.key);
          event.dataTransfer?.setData("text/plain", entry.key);
        }}
        onDragEnd={() => setDragEntryKey("")}
      />
    );
  }

  return (
    <div className="calendar-layout">
      <aside className="calendar-sidebar">
        <section className="panel">
          <div className="mini-calendar-header">
            <button type="button" className="calendar-nav-button" onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}>{"\u2039"}</button>
            <strong>{monthLabel(activeMonth)}</strong>
            <button type="button" className="calendar-nav-button" onClick={() => setActiveMonth(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}>{"\u203A"}</button>
          </div>
          <div className="mini-calendar-grid">
            {CALENDAR_WEEKDAYS.map((label) => <span key={label} className="mini-calendar-weekday">{label}</span>)}
            {miniMatrix.flat().map((date) => (
              <button key={date.toISOString()} type="button" className={date.toDateString() === selectedDate.toDateString() ? "mini-day selected" : isToday(date) ? "mini-day today" : "mini-day"} data-faded={!isCurrentMonth(date, activeMonth)} onClick={() => { setSelectedDate(date); setActiveMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }}>
                {date.getDate()}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="calendar-filter-stack">
            {["meeting", "task", "google"].map((type) => (
              <CalendarFilterButton key={type} active={filters[type]} count={allEntries.filter((entry) => entry.type === type).length} label={eventTypeLabel(type)} onClick={() => setFilters((previous) => ({ ...previous, [type]: !previous[type] }))} />
            ))}
          </div>

          {googleCalendarEvents.length ? (
            <div className="button-row">
              <button type="button" className="ghost-button" onClick={disconnectGoogleCalendar}>Odlacz Google</button>
            </div>
          ) : null}
          {googleCalendarMessage ? <div className="inline-alert info">{googleCalendarMessage}</div> : null}

          {allMeetingTags.length > 0 && (
            <div className="calendar-tag-filters">
              <div className="calendar-tag-filter-label">Tagi spotkań</div>
              <div className="calendar-tag-filter-list">
                <button
                  type="button"
                  className={!tagFilter ? "calendar-tag-chip active" : "calendar-tag-chip"}
                  onClick={() => setTagFilter("")}
                >
                  Wszystkie
                </button>
                {allMeetingTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={tagFilter === tag ? "calendar-tag-chip active" : "calendar-tag-chip"}
                    onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {reminders.length > 0 ? (
          <section className="panel">
            <div className="agenda-list">
              {reminders.slice(0, 5).map((reminder) => (
                <button key={reminder.id} type="button" className="agenda-card">
                  <strong>{reminder.title}</strong>
                  <span>{reminderLabel(reminder.minutes)} przed wydarzeniem</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="agenda-list">
            {upcomingMeetings.length ? (
              upcomingMeetings.map((meeting) => (
                <button key={meeting.id} type="button" className="agenda-card" onClick={() => openMeetingFromCalendar(meeting.id)}>
                  <strong>{meeting.title}</strong>
                  <span>{formatDateTime(meeting.startsAt)}</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak spotkan</strong>
                <span>Dodaj spotkanie, a pojawi sie tutaj.</span>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="agenda-list">
            {upcomingTasks.length ? (
              upcomingTasks.map((task) => (
                <button key={task.id} type="button" className="agenda-card" onClick={() => openTaskFromCalendar(task.id)}>
                  <strong>{task.title}</strong>
                  <span>{formatDateTime(task.dueDate)}</span>
                </button>
              ))
            ) : (
              <div className="empty-panel">
                <strong>Brak terminow</strong>
                <span>Taski z terminem pojawia sie tutaj automatycznie.</span>
              </div>
            )}
          </div>
        </section>
      </aside>

      <section className="panel calendar-board">
        <div className="calendar-board-header">
          <div className="calendar-board-actions">
            <button type="button" className="secondary-button" onClick={() => { const today = new Date(); setSelectedDate(today); setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }}>Dzisiaj</button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftPeriod(-1)}>{"\u2039"}</button>
            <button type="button" className="calendar-nav-button" onClick={() => shiftPeriod(1)}>{"\u203A"}</button>
            <div><div className="eyebrow">Calendar</div><h2>{viewMode === "month" ? monthLabel(activeMonth) : formatCalendarDayLabel(selectedDate, { month: true })}</h2></div>
          </div>
          <div className="calendar-toolbar">
            <div className="calendar-view-switch">
              {["month", "week", "day"].map((mode) => (
                <button key={mode} type="button" className={viewMode === mode ? "calendar-view-button active" : "calendar-view-button"} onClick={() => setViewMode(mode)}>
                  {mode === "month" ? "Miesiac" : mode === "week" ? "Tydzien" : "Dzien"}
                </button>
              ))}
            </div>
            <div className="status-cluster">
              <span className="status-chip">{userMeetings.length} spotkan</span>
              <span className="status-chip">{calendarTasks.length} zadan</span>
              <span className="status-chip">{googleCalendarEvents.length} Google</span>
            </div>
          </div>
        </div>

        {calendarMessage ? <div className="inline-alert info">{calendarMessage}</div> : null}

        {viewMode === "month" ? (
          <>
            <div className="calendar-weekdays">{CALENDAR_WEEKDAYS.map((label) => <div key={label} className="calendar-weekday">{label}</div>)}</div>
            <div className="calendar-grid">
              {monthMatrix.flat().map((date) => {
                const entries = entriesForDay(visibleEntries, date);
                return (
                  <div key={date.toISOString()} className={date.toDateString() === selectedDate.toDateString() ? "calendar-day-wrap selected" : "calendar-day-wrap"} data-muted={!isCurrentMonth(date, activeMonth)}>
                    <button type="button" className={date.toDateString() === selectedDate.toDateString() ? "calendar-day selected" : "calendar-day"} data-muted={!isCurrentMonth(date, activeMonth)} onClick={() => setSelectedDate(date)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(date, event)}>
                      <div className={isToday(date) ? "calendar-day-number today" : "calendar-day-number"}>{date.getDate()}</div>
                      <div className="calendar-day-events">{entries.slice(0, 4).map((entry) => renderEntry(entry))}</div>
                    </button>
                    <button type="button" className="calendar-day-add-btn" onClick={() => createMeetingFromDay(date)} title="Nowe spotkanie">+</button>
                  </div>
                );
              })}
            </div>
          </>
        ) : viewMode === "week" ? (
          <div className="calendar-week-view">
            {weekDays.map((day) => (
              <section key={day.toISOString()} className="calendar-column" onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(day, event)}>
                <header className="calendar-column-head">
                  <strong>{formatCalendarDayLabel(day, { short: true })}</strong>
                  <span>{day.getDate()}</span>
                  <button type="button" className="calendar-day-add-btn" onClick={() => createMeetingFromDay(day)} title="Nowe spotkanie">+</button>
                </header>
                <div className="calendar-column-body">
                  {entriesForDay(visibleEntries, day).length ? entriesForDay(visibleEntries, day).map((entry) => renderEntry(entry, true)) : <div className="calendar-column-empty">Upusc tutaj wydarzenie.</div>}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="calendar-day-view">
            {CALENDAR_HOURS.map((hour) => {
              const slotEntries = selectedDayEntries.filter((entry) => new Date(entry.startsAt).getHours() === hour);
              const isCurrentHour = isToday_ && hour === currentHour;
              const isNowSlot = isToday_ && currentTimeMinutes >= hour * 60 && currentTimeMinutes < (hour + 1) * 60;
              const nowOffset = isNowSlot ? ((currentTimeMinutes - hour * 60) / 60) * 100 : null;
              return (
                <div key={hour} className={`calendar-time-row${isCurrentHour ? " calendar-time-row-current" : ""}`}>
                  <div className="calendar-time-label">
                    {String(hour).padStart(2, "0")}:00
                    {isCurrentHour && <span className="calendar-now-dot" />}
                  </div>
                  <div
                    className="calendar-time-slot"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(selectedDate, event, hour)}
                  >
                    {isNowSlot && nowOffset !== null && (
                      <div className="calendar-now-line" ref={currentTimeRef} style={{ top: `${nowOffset}%` }} />
                    )}
                    {slotEntries.length ? (
                      slotEntries.map((entry) => renderEntry(entry, true))
                    ) : (
                      <button
                        type="button"
                        className="calendar-slot-create-btn"
                        onClick={() => createMeetingFromSlot(selectedDate, hour)}
                        title={`Utwórz spotkanie ${String(hour).padStart(2, "0")}:00`}
                      >
                        <span className="calendar-slot-create-icon">+</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {calendarCreateForm && (
          <div className="calendar-create-form-overlay">
            <div className="calendar-create-form">
              <div className="calendar-create-form-head">
                <strong>Nowe spotkanie</strong>
                <button type="button" className="calendar-create-close" onClick={() => setCalendarCreateForm(null)}>×</button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!calendarCreateForm.title.trim() || typeof onCreateMeeting !== "function") return;
                  const startsAt = new Date(calendarCreateForm.startsAt).toISOString();
                  onCreateMeeting({
                    title: calendarCreateForm.title.trim(),
                    startsAt,
                    durationMinutes: calendarCreateForm.durationMinutes,
                    context: "",
                    attendees: "",
                    needs: "",
                    desiredOutputs: "",
                    tags: "",
                    location: "",
                  });
                  setCalendarCreateForm(null);
                  setCalendarMessage(`Utworzono spotkanie: ${calendarCreateForm.title.trim()}`);
                }}
              >
                <label className="calendar-create-field">
                  <span>Tytuł <span style={{color:"var(--accent)"}}>*</span></span>
                  <input
                    autoFocus
                    value={calendarCreateForm.title}
                    onChange={(e) => setCalendarCreateForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="np. Spotkanie z klientem"
                    required
                  />
                </label>
                <label className="calendar-create-field">
                  <span>Kiedy</span>
                  <input
                    type="datetime-local"
                    value={calendarCreateForm.startsAt}
                    onChange={(e) => setCalendarCreateForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                </label>
                <label className="calendar-create-field">
                  <span>Czas trwania</span>
                  <select
                    value={calendarCreateForm.durationMinutes}
                    onChange={(e) => setCalendarCreateForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 godz</option>
                  </select>
                </label>
                <div className="calendar-create-actions">
                  <button type="submit" className="primary-button" disabled={!calendarCreateForm.title.trim()}>
                    Utwórz spotkanie
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setCalendarCreateForm(null)}>
                    Anuluj
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="calendar-lower-grid">
          <div className="selected-day-panel">
            <div className="agenda-list">
              {selectedDayEntries.length ? selectedDayEntries.map((entry) => (
                <div key={entry.key} className={selectedEntryKey === entry.key ? "agenda-card static selected" : "agenda-card static"} onClick={() => setSelectedEntryKey(entry.key)}>
                  <div className="agenda-card-top"><strong>{entry.title}</strong><span>{eventTypeLabel(entry.type)}</span></div>
                  <p>{eventTimeLabel(entry)}</p>
                  {(conflictMap[entry.key] || []).length ? <small className="calendar-conflict-label">{(conflictMap[entry.key] || []).length} konfliktow</small> : null}
                </div>
              )) : <div className="empty-panel"><strong>Ten dzien jest pusty</strong><span>Wybierz inny dzien albo dodaj nowe spotkanie.</span></div>}
            </div>
          </div>

          <div className="selected-day-panel">
            {selectedEntry ? (
              <div className="calendar-editor-card">
                <div className="calendar-editor-meta">
                  <span className={`calendar-source-pill ${selectedEntry.type}`}>{eventTypeLabel(selectedEntry.type)}</span>
                  <span>{formatDateTime(selectedEntry.startsAt)}</span>
                  {selectedMeta.googleEventId ? <span className="calendar-source-pill google">Linked Google</span> : null}
                </div>
                <label className="calendar-editor-field">
                  <span>{selectedEntry.type === "task" ? "Termin" : "Start"}</span>
                  <input type="datetime-local" value={toLocalDateTimeValue(selectedEntry.startsAt)} onChange={(event) => rescheduleEntry(selectedEntry, new Date(event.target.value).toISOString(), selectedEntry.endsAt)} disabled={!selectedEntry.editable} />
                </label>
                <div className="calendar-editor-field"><span>Zakres</span><strong>{eventTimeLabel(selectedEntry)}</strong></div>
                <div className="calendar-duration-buttons">
                  <button type="button" className="ghost-button" onClick={() => resizeEntry(selectedEntry, -30)}>Skroc o 30 min</button>
                  <button type="button" className="ghost-button" onClick={() => resizeEntry(selectedEntry, 30)}>Wydluz o 30 min</button>
                  <button type="button" className="ghost-button" onClick={() => resizeEntry(selectedEntry, 60)}>+1 godzina</button>
                </div>
                {selectedEntry.type !== "google" ? (
                  <div className="calendar-reminder-grid">
                    {REMINDER_PRESETS.map((preset) => {
                      const active = selectedEntry.reminders.includes(preset.value);
                      return (
                        <button key={preset.value} type="button" className={active ? "calendar-reminder-chip active" : "calendar-reminder-chip"} onClick={() => onUpdateCalendarEntryMeta(selectedEntry.type, selectedEntry.id, { reminders: active ? selectedEntry.reminders.filter((value) => value !== preset.value) : [...selectedEntry.reminders, preset.value] })}>
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                ) : <div className="calendar-readonly-note">Przypomnienia dla Google ustawiasz bezposrednio w Google.</div>}
                {participantTimezones.length ? (
                  <div className="calendar-timezone-list">
                    {participantTimezones.map((participant) => (
                      <div key={`${participant.label}-${participant.timezone}`} className="calendar-timezone-row">
                        <strong>{participant.label}</strong>
                        <span>{participant.timezone}</span>
                        <small>{participant.range}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
                {selectedConflicts.length ? (
                  <div className="calendar-conflict-list">
                    {selectedConflicts.map((entry) => (
                      <button key={entry.key} type="button" className="agenda-card static" onClick={() => setSelectedEntryKey(entry.key)}>
                        <strong>{entry.title}</strong>
                        <span>{eventTimeLabel(entry)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedMeta.googleSyncConflict ? (
                  <section className="calendar-sync-conflict-panel">
                    <div className="panel-header compact">
                      <div>
                        <div className="eyebrow">Google conflict</div>
                        <h2>Rozwiaz konflikt synchronizacji</h2>
                      </div>
                    </div>
                    <div className="calendar-sync-conflict-grid">
                      <article className="calendar-sync-card">
                        <strong>Lokalne</strong>
                        <span>{selectedMeta.googleSyncConflict.localSnapshot.title}</span>
                        <small>{formatDateTime(selectedMeta.googleSyncConflict.localSnapshot.startsAt)}</small>
                      </article>
                      <article className="calendar-sync-card">
                        <strong>Google</strong>
                        <span>{selectedMeta.googleSyncConflict.remoteSnapshot.title}</span>
                        <small>{formatDateTime(selectedMeta.googleSyncConflict.remoteSnapshot.startsAt)}</small>
                      </article>
                      <article className="calendar-sync-card">
                        <strong>Finalna wersja</strong>
                        <label className="calendar-editor-field">
                          <span>Tytul</span>
                          <input
                            value={conflictDraft.title}
                            onChange={(e) => setConflictDraft((f) => ({ ...f, title: e.target.value }))}
                          />
                        </label>
                        <label className="calendar-editor-field">
                          <span>Kiedy</span>
                          <input
                            type="datetime-local"
                            value={conflictDraft.startsAt}
                            onChange={(e) => setConflictDraft((f) => ({ ...f, startsAt: e.target.value }))}
                          />
                        </label>
                        <label className="calendar-editor-field">
                          <span>Czas (min)</span>
                          <input
                            type="number"
                            value={conflictDraft.durationMinutes}
                            onChange={(e) => setConflictDraft((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
                          />
                        </label>
                        <label className="calendar-editor-field">
                          <span>Lokalizacja</span>
                          <input
                            value={conflictDraft.location}
                            onChange={(e) => setConflictDraft((f) => ({ ...f, location: e.target.value }))}
                          />
                        </label>
                      </article>
                    </div>
                    <div className="calendar-sync-conflict-actions">
                      <button type="button" className="primary-button" onClick={() => resolveGoogleSyncConflict("merge")}>Zachowaj finalna wersje</button>
                      <button type="button" className="secondary-button" onClick={() => resolveGoogleSyncConflict("google")}>Przyjmij Google</button>
                      <button type="button" className="ghost-button" onClick={() => resolveGoogleSyncConflict("local")}>Przyjmij Lokalne</button>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="selected-day-panel">
                <div className="empty-panel">
                  <strong>Wybierz wydarzenie</strong>
                  <span>Kliknij w kalendarzu, aby zobaczyć i edytować szczegóły.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
