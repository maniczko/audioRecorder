/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act, testing-library/no-wait-for-multiple-assertions, testing-library/prefer-find-by, testing-library/no-container */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarTab from "./CalendarTab";

function createDataTransfer() {
  const store = {};
  return {
    dropEffect: "move",
    effectAllowed: "move",
    setData: jest.fn((type, value) => {
      store[type] = value;
    }),
    getData: jest.fn((type) => store[type] || ""),
  };
}

function renderCalendarTab(overrides = {}) {
  const props = {
    activeMonth: new Date("2026-03-01T00:00:00.000Z"),
    setActiveMonth: jest.fn(),
    selectedDate: new Date("2026-03-14T00:00:00.000Z"),
    setSelectedDate: jest.fn(),
    userMeetings: [
      {
        id: "meeting_1",
        title: "Spotkanie zespolu",
        startsAt: "2026-03-14T09:00:00.000Z",
        durationMinutes: 45,
      },
    ],
    calendarTasks: [
      {
        id: "task_1",
        title: "Task A",
        dueDate: "2026-03-14T12:00:00.000Z",
        completed: false,
      },
    ],
    googleCalendarEvents: [
      {
        id: "google_1",
        summary: "Google sync",
        start: { dateTime: "2026-03-15T11:00:00.000Z" },
        htmlLink: "https://calendar.google.com",
      },
    ],
    googleCalendarStatus: "idle",
    googleCalendarMessage: "",
    connectGoogleCalendar: jest.fn(),
    disconnectGoogleCalendar: jest.fn(),
    openMeetingFromCalendar: jest.fn(),
    openGoogleCalendarForMeeting: jest.fn(),
    openTaskFromCalendar: jest.fn(),
    googleCalendarEnabled: true,
    onRescheduleMeeting: jest.fn(),
    onRescheduleTask: jest.fn(),
    calendarMeta: {},
    onUpdateCalendarEntryMeta: jest.fn(),
    ...overrides,
  };

  return {
    ...render(<CalendarTab {...props} />),
    props,
  };
}

function findMonthDay(container, dayNumber) {
  return Array.from(container.querySelectorAll(".calendar-day")).find((node) => {
    const dayNode = node.querySelector(".calendar-day-number");
    return dayNode?.textContent === String(dayNumber) && node.getAttribute("data-muted") !== "true";
  });
}

describe("CalendarTab", () => {
  test("reschedules a task when dragged to another month cell", () => {
    const { container, props } = renderCalendarTab();
    const dataTransfer = createDataTransfer();
    const taskChip = container.querySelector(".calendar-pill.task");
    const targetDay = findMonthDay(container, 15);

    fireEvent.dragStart(taskChip, { dataTransfer });
    fireEvent.dragOver(targetDay, { dataTransfer });
    fireEvent.drop(targetDay, { dataTransfer });

    expect(props.onRescheduleTask).toHaveBeenCalledTimes(1);
    expect(props.onRescheduleTask).toHaveBeenCalledWith(
      "task_1",
      expect.any(String)
    );
    expect(new Date(props.onRescheduleTask.mock.calls[0][1]).getUTCDate()).toBe(15);
  });

  test("supports filters and switching between month week and day views", async () => {
    const { container } = renderCalendarTab();
    const googleFilterButton = Array.from(container.querySelectorAll(".calendar-filter-chip")).find((button) =>
      button.textContent.includes("Google")
    );

    expect(screen.getByText(/Google sync/i)).toBeInTheDocument();

    await userEvent.click(googleFilterButton);
    expect(screen.queryByText(/Google sync/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Tydzien" }));
    expect(container.querySelector(".calendar-week-view")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Dzien" }));
    expect(container.querySelector(".calendar-day-view")).toBeInTheDocument();
  });

  test("updates reminder presets for the selected entry", async () => {
    const { container, props } = renderCalendarTab();
    const taskChip = container.querySelector(".calendar-pill.task");

    await userEvent.click(taskChip);
    await userEvent.click(screen.getByRole("button", { name: "30 min" }));

    expect(props.onUpdateCalendarEntryMeta).toHaveBeenCalledWith("task", "task_1", {
      reminders: [30],
    });
  });
});
