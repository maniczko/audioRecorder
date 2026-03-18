/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act, testing-library/no-wait-for-multiple-assertions, testing-library/prefer-find-by */
import { act, render, screen, waitFor, configure } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { registerUser } from "./lib/auth";
import { STORAGE_KEYS } from "./lib/storage";

configure({ asyncUtilTimeout: 5000 });

const originalNotification = window.Notification;

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function seedWorkspaceAppState({ manualTasks = [] } = {}) {
  const user = {
    id: "user_1",
    name: "Anna Nowak",
    email: "anna@example.com",
    role: "PM",
    provider: "local",
    workspaceIds: ["workspace_1", "workspace_2"],
    defaultWorkspaceId: "workspace_1",
    preferredTaskView: "list",
  };
  const workspaces = [
    { id: "workspace_1", name: "Workspace One", memberIds: ["user_1"], inviteCode: "ONE123" },
    { id: "workspace_2", name: "Workspace Two", memberIds: ["user_1"], inviteCode: "TWO456" },
  ];
  const meetings = [
    {
      id: "meeting_1",
      userId: "user_1",
      workspaceId: "workspace_1",
      createdByUserId: "user_1",
      title: "Spotkanie A",
      context: "",
      startsAt: "2026-03-14T09:00:00.000Z",
      durationMinutes: 30,
      attendees: [],
      tags: [],
      needs: [],
      desiredOutputs: [],
      location: "",
      recordings: [],
      latestRecordingId: null,
      analysis: null,
      speakerNames: {},
      speakerCount: 0,
      createdAt: "2026-03-14T09:00:00.000Z",
      updatedAt: "2026-03-14T09:00:00.000Z",
    },
    {
      id: "meeting_2",
      userId: "user_1",
      workspaceId: "workspace_2",
      createdByUserId: "user_1",
      title: "Spotkanie B",
      context: "",
      startsAt: "2026-03-15T09:00:00.000Z",
      durationMinutes: 45,
      attendees: [],
      tags: [],
      needs: [],
      desiredOutputs: [],
      location: "",
      recordings: [],
      latestRecordingId: null,
      analysis: null,
      speakerNames: {},
      speakerCount: 0,
      createdAt: "2026-03-15T09:00:00.000Z",
      updatedAt: "2026-03-15T09:00:00.000Z",
    },
  ];

  writeStorage(STORAGE_KEYS.users, [user]);
  writeStorage(STORAGE_KEYS.workspaces, workspaces);
  writeStorage(STORAGE_KEYS.meetings, meetings);
  writeStorage(STORAGE_KEYS.manualTasks, manualTasks);
  writeStorage(STORAGE_KEYS.taskState, {});
  writeStorage(STORAGE_KEYS.taskBoards, {});
  writeStorage(STORAGE_KEYS.session, {
    userId: "user_1",
    workspaceId: "workspace_1",
  });
  writeStorage(STORAGE_KEYS.meetingDrafts, {
    workspace_1: { selectedMeetingId: "meeting_1" }
  });
}

describe("App integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
    window.Notification = originalNotification;
  });

  test("registers a user and enters the workspace", async () => {
    render(<App />);

    await userEvent.type(screen.getByPlaceholderText("np. Anna Nowak"), "Anna Nowak");
    await userEvent.type(screen.getByPlaceholderText("np. Product Manager"), "Product Manager");
    await userEvent.type(screen.getByPlaceholderText("np. VoiceLog"), "VoiceLog");
    await userEvent.type(screen.getByPlaceholderText("np. Zespol sprzedazy"), "Zespol Sprzedazy");
    await userEvent.type(screen.getByPlaceholderText("name@company.com"), "anna@example.com");
    await userEvent.type(screen.getByPlaceholderText("minimum 6 znakow"), "sekret12");

    await userEvent.click(screen.getByRole("button", { name: "Wejdz do workspace" }));

    expect(await screen.findByText("Meeting intelligence studio")).toBeInTheDocument();
    expect(screen.getByText("Utworz pierwsze spotkanie")).toBeInTheDocument();
  });

  test("resets password end to end and logs in with the new password", async () => {
    const registerResult = await registerUser([], [], {
      name: "Marta",
      email: "marta@example.com",
      password: "starehaslo",
      workspaceMode: "create",
      workspaceName: "Support",
    });

    writeStorage(STORAGE_KEYS.users, registerResult.users);
    writeStorage(STORAGE_KEYS.workspaces, registerResult.workspaces);
    writeStorage(STORAGE_KEYS.session, null);

    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await userEvent.type(screen.getByPlaceholderText("name@company.com"), "marta@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Wyslij kod resetu" }));

    const preview = await screen.findByText(/W tej lokalnej wersji kod pokazujemy tutaj/i);
    const code = preview.textContent.match(/\b\d{6}\b/)[0];

    await userEvent.type(screen.getByPlaceholderText("6-cyfrowy kod"), code);
    await userEvent.type(screen.getByPlaceholderText("minimum 6 znakow"), "nowehaslo");
    await userEvent.type(screen.getByPlaceholderText("powtorz haslo"), "nowehaslo");
    await userEvent.click(screen.getByRole("button", { name: "Ustaw nowe haslo" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Zaloguj" })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByPlaceholderText("name@company.com"), "marta@example.com");
    await userEvent.type(screen.getByPlaceholderText("minimum 6 znakow"), "nowehaslo");
    await userEvent.click(screen.getByRole("button", { name: "Zaloguj" }));

    expect(await screen.findByText("Meeting intelligence studio")).toBeInTheDocument();
  });

  test("switches between shared workspaces", async () => {
    seedWorkspaceAppState();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Spotkanie A" }, { timeout: 4000 })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Workspace"), "workspace_2");

    expect(await screen.findByRole("heading", { name: "Spotkanie B" }, { timeout: 4000 })).toBeInTheDocument();
  });

  test("exports meeting notes from the studio view", async () => {
    seedWorkspaceAppState();
    const clickSpy = jest.spyOn(window.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<App />);

    await screen.findByRole("heading", { name: "Spotkanie A" }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: "Notatki TXT" }));

    expect(clickSpy).toHaveBeenCalled();
  });

  test("exports meeting pdf from the studio view", async () => {
    seedWorkspaceAppState();
    const popup = {
      document: {
        write: jest.fn(),
        close: jest.fn(),
      },
      focus: jest.fn(),
      print: jest.fn(),
    };
    const openSpy = jest.spyOn(window, "open").mockReturnValue(popup);

    render(<App />);

    await screen.findByRole("heading", { name: "Spotkanie A" }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: "PDF" }));

    expect(openSpy).toHaveBeenCalled();
    expect(popup.document.write).toHaveBeenCalled();
    expect(popup.print).toHaveBeenCalled();
  });

  test("shows task deadlines in the calendar and opens the task details", async () => {
    seedWorkspaceAppState({
      manualTasks: [
        {
          id: "task_manual_1",
          userId: "user_1",
          workspaceId: "workspace_1",
          createdByUserId: "user_1",
          title: "Przygotuj demo",
          owner: "Anna Nowak",
          group: "Sprint 14",
          description: "",
          dueDate: "2026-03-14T12:00:00.000Z",
          sourceType: "manual",
          sourceMeetingId: "",
          sourceMeetingTitle: "Reczne zadanie",
          sourceMeetingDate: "2026-03-14T12:00:00.000Z",
          sourceRecordingId: "",
          sourceQuote: "",
          createdAt: "2026-03-14T09:00:00.000Z",
          updatedAt: "2026-03-14T09:00:00.000Z",
          status: "todo",
          important: false,
          completed: false,
          notes: "",
          priority: "high",
          tags: ["demo"],
          comments: [],
          history: [],
          dependencies: [],
          recurrence: null,
        },
      ],
    });
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Kalendarz" }));
    await userEvent.click(
      screen
        .getAllByText("Przygotuj demo")
        .find((element) => element.closest(".agenda-card"))
        .closest(".agenda-card")
    );

    const openTaskFields = await screen.findAllByDisplayValue("Przygotuj demo");
    expect(openTaskFields.length).toBeGreaterThan(0);
  });

  test("adds a manual task from the tasks tab", async () => {
    seedWorkspaceAppState();
    render(<App />);

    await userEvent.click(screen.getByRole("button", { name: "Zadania" }));
    await userEvent.type(screen.getByPlaceholderText("Dodaj zadanie"), "Nowy follow-up");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj zadanie" }));

    const createdTaskFields = await screen.findAllByDisplayValue("Nowy follow-up");
    expect(createdTaskFields.length).toBeGreaterThan(0);
  });

  test("restores an autosaved meeting draft after refresh", async () => {
    seedWorkspaceAppState();
    const { unmount } = render(<App />);

    await screen.findByRole("heading", { name: "Spotkanie A" }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: "Nowe" }));
    await userEvent.type(screen.getByLabelText("Tytul"), "Plan retro");
    await userEvent.type(screen.getByLabelText("Kontekst"), "Podsumowanie sprintu");

    unmount();
    render(<App />);

    expect(await screen.findByDisplayValue("Plan retro")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Podsumowanie sprintu")).toBeInTheDocument();
  });

  test("shows notification center items and requests browser notification permission", async () => {
    const NotificationMock = jest.fn();
    NotificationMock.permission = "default";
    NotificationMock.requestPermission = jest.fn().mockImplementation(async () => {
      NotificationMock.permission = "granted";
      return "granted";
    });
    window.Notification = NotificationMock;

    seedWorkspaceAppState({
      manualTasks: [
        {
          id: "task_manual_critical",
          userId: "user_1",
          workspaceId: "workspace_1",
          createdByUserId: "user_1",
          title: "Pilny follow-up",
          owner: "Anna Nowak",
          assignedTo: ["Anna Nowak"],
          group: "Sprint 14",
          description: "",
          dueDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          sourceType: "manual",
          sourceMeetingId: "",
          sourceMeetingTitle: "Reczne zadanie",
          sourceMeetingDate: new Date().toISOString(),
          sourceRecordingId: "",
          sourceQuote: "",
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: "todo",
          important: true,
          completed: false,
          notes: "",
          priority: "urgent",
          tags: ["follow-up"],
          comments: [],
          history: [],
          dependencies: [],
          recurrence: null,
        },
      ],
    });
    render(<App />);

    await screen.findByRole("heading", { name: "Spotkanie A" }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: "Powiadomienia" }));

    expect(await screen.findByText("Pilny follow-up")).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByRole("button", { name: "Wlacz w przegladarce" }));
    });

    await waitFor(() => {
      expect(NotificationMock.requestPermission).toHaveBeenCalled();
      expect(NotificationMock).toHaveBeenCalled();
    });
  });

  test("opens task details from the command palette", async () => {
    seedWorkspaceAppState({
      manualTasks: [
        {
          id: "task_1",
          userId: "user_1",
          workspaceId: "workspace_1",
          createdByUserId: "user_1",
          title: "Przygotuj demo",
          owner: "Anna Nowak",
          assignedTo: ["Anna Nowak"],
          description: "Pokaz dla klienta",
          dueDate: "2026-03-14T12:00:00.000Z",
          sourceType: "manual",
          sourceMeetingId: "",
          sourceMeetingTitle: "Reczne zadanie",
          sourceMeetingDate: "2026-03-14T12:00:00.000Z",
          sourceRecordingId: "",
          sourceQuote: "",
          createdAt: "2026-03-14T09:00:00.000Z",
          updatedAt: "2026-03-14T09:00:00.000Z",
          status: "todo",
          important: false,
          completed: false,
          notes: "",
          priority: "high",
          tags: ["demo"],
          comments: [],
          history: [],
          dependencies: [],
          recurrence: null,
        },
      ],
    });
    render(<App />);

    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByText("Szybkie przejscie")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Zakladka, spotkanie, zadanie, osoba..."), "Przygotuj demo");
    await userEvent.click(screen.getByRole("button", { name: /Przygotuj demo/i }));

    const createdTaskFields = await screen.findAllByDisplayValue("Przygotuj demo");
    expect(createdTaskFields.length).toBeGreaterThan(0);
  });

  test("shows a microphone error for ad hoc recording when permission is blocked", async () => {
    seedWorkspaceAppState();
    jest.spyOn(console, "error").mockImplementation(() => {});
    window.MediaRecorder = jest.fn();
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: {
        getUserMedia: jest.fn().mockRejectedValue({ name: "NotAllowedError" }),
      },
      configurable: true,
    });

    render(<App />);

    await screen.findByRole("heading", { name: "Spotkanie A" }, { timeout: 4000 });
    await userEvent.click(screen.getByRole("button", { name: "Nagranie ad hoc" }));

    await screen.findByText(/Dostep do mikrofonu jest zablokowany/i);
  });
});
