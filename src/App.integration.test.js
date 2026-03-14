import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { registerUser } from "./lib/auth";
import { STORAGE_KEYS } from "./lib/storage";

function writeStorage(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function seedWorkspaceAppState() {
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
  writeStorage(STORAGE_KEYS.manualTasks, []);
  writeStorage(STORAGE_KEYS.taskState, {});
  writeStorage(STORAGE_KEYS.taskBoards, {});
  writeStorage(STORAGE_KEYS.session, {
    userId: "user_1",
    workspaceId: "workspace_1",
  });
}

describe("App integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
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

    expect(await screen.findByRole("heading", { name: "Spotkanie A" })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Workspace"), "workspace_2");

    expect(await screen.findByRole("heading", { name: "Spotkanie B" })).toBeInTheDocument();
  });

  test("exports meeting notes from the studio view", async () => {
    seedWorkspaceAppState();
    const clickSpy = jest.spyOn(window.HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<App />);

    await screen.findByRole("heading", { name: "Spotkanie A" });
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

    await screen.findByRole("heading", { name: "Spotkanie A" });
    await userEvent.click(screen.getByRole("button", { name: "PDF" }));

    expect(openSpy).toHaveBeenCalled();
    expect(popup.document.write).toHaveBeenCalled();
    expect(popup.print).toHaveBeenCalled();
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

    await screen.findByRole("heading", { name: "Spotkanie A" });
    await userEvent.click(screen.getByRole("button", { name: "Nagranie ad hoc" }));

    await waitFor(() =>
      expect(screen.getByText(/Dostep do mikrofonu jest zablokowany/i)).toBeInTheDocument()
    );
  });
});
