import { useState } from "react";
import './TaskScheduleViewStyles.css';

const WEEKDAYS_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
const MONTHS_PL = [
  "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
  "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru",
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date) {
  return startOfDay(date).getTime();
}

function buildDays(anchorDate, count) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(anchorDate);
    d.setDate(anchorDate.getDate() + i);
    days.push(startOfDay(d));
  }
  return days;
}

function mondayOf(date) {
  const d = startOfDay(date);
  const dow = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - dow + 1);
  return d;
}

export default function TaskScheduleView({ tasks, selectedTask, onSelectTask, onUpdateTask }) {
  const [viewRange, setViewRange] = useState("2w");
  const today = startOfDay(new Date());

  const anchor = viewRange === "2w" ? mondayOf(today) : today;
  const dayCount = viewRange === "2w" ? 14 : 35;
  const days = buildDays(anchor, dayCount);

  const tasksWithDue = tasks.filter((t) => t.dueDate && !t.completed);
  const tasksWithoutDue = tasks.filter((t) => !t.dueDate && !t.completed);

  const tasksByDay = new Map();
  tasksWithDue.forEach((t) => {
    const key = dayKey(new Date(t.dueDate));
    if (!tasksByDay.has(key)) {
      tasksByDay.set(key, []);
    }
    tasksByDay.get(key).push(t);
  });

  function handleTaskDragStart(event, taskId) {
    event.dataTransfer.setData("text/plain", taskId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDayDrop(event, targetDay) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (!taskId || typeof onUpdateTask !== "function") {
      return;
    }
    const newDue = new Date(targetDay);
    newDue.setHours(9, 0, 0, 0);
    onUpdateTask(taskId, { dueDate: newDue.toISOString() });
  }

  const isWeekMode = viewRange === "2w";

  return (
    <div className="task-schedule-view">
      <div className="schedule-toolbar">
        <div className="todo-view-switch" role="tablist">
          <button
            type="button"
            className={viewRange === "2w" ? "todo-view-button active" : "todo-view-button"}
            onClick={() => setViewRange("2w")}
          >
            2 tygodnie
          </button>
          <button
            type="button"
            className={viewRange === "5w" ? "todo-view-button active" : "todo-view-button"}
            onClick={() => setViewRange("5w")}
          >
            5 tygodni
          </button>
        </div>
        <small className="schedule-hint">Przeciagnij zadanie na dzien aby zmienic termin.</small>
      </div>

      <div className={`schedule-grid ${isWeekMode ? "schedule-grid-14" : "schedule-grid-35"}`}>
        {days.map((day) => {
          const isToday = day.getTime() === today.getTime();
          const isPast = day.getTime() < today.getTime();
          const dayTasks = tasksByDay.get(day.getTime()) || [];
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div
              key={day.getTime()}
              className={`schedule-day${isToday ? " today" : ""}${isPast ? " past" : ""}${isWeekend ? " weekend" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDayDrop(e, day)}
            >
              <div className="schedule-day-header">
                <span className="schedule-weekday">{WEEKDAYS_PL[day.getDay()]}</span>
                <span className={`schedule-date-num${isToday ? " today" : ""}`}>
                  {day.getDate()}
                </span>
                {day.getDate() === 1 ? (
                  <span className="schedule-month-label">{MONTHS_PL[day.getMonth()]}</span>
                ) : null}
              </div>
              <div className="schedule-day-tasks">
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    draggable
                    className={`schedule-task-chip${selectedTask?.id === task.id ? " active" : ""}${task.important ? " important" : ""}`}
                    onClick={() => onSelectTask?.(task.id)}
                    onDragStart={(e) => handleTaskDragStart(e, task.id)}
                    title={task.title}
                  >
                    {task.title}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {tasksWithoutDue.length > 0 ? (
        <div className="schedule-unscheduled">
          <div className="schedule-unscheduled-header">
            <strong>Bez terminu</strong>
            <span>{tasksWithoutDue.length}</span>
          </div>
          <div className="schedule-unscheduled-chips">
            {tasksWithoutDue.slice(0, 15).map((task) => (
              <button
                key={task.id}
                type="button"
                className={`schedule-task-chip unscheduled${selectedTask?.id === task.id ? " active" : ""}`}
                onClick={() => onSelectTask?.(task.id)}
                title={task.title}
              >
                {task.title}
              </button>
            ))}
            {tasksWithoutDue.length > 15 ? (
              <span className="schedule-overflow">+{tasksWithoutDue.length - 15} więcej</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
