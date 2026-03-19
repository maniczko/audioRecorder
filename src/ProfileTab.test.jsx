import { render, screen, fireEvent } from "@testing-library/react";
import ProfileTab from "./ProfileTab";

describe("ProfileTab", () => {
  const mockUser = {
    id: "user_1",
    email: "anna@example.com",
    passwordHash: "some_hash",
    provider: "local",
  };

  const mockProfileDraft = {
    name: "Anna Nowak",
    role: "Product Manager",
    company: "Acme Corp",
    phone: "123456789",
    location: "Warsaw",
    avatarUrl: "",
    team: "Product Team",
    timezone: "Europe/Warsaw",
    googleEmail: "anna.google@example.com",
    preferredInsights: "Risks\nDecisions",
    bio: "Test bio",
    notifyDailyDigest: true,
    autoTaskCapture: true,
    preferredTaskView: "list",
  };

  const defaultProps = {
    currentUser: mockUser,
    profileDraft: mockProfileDraft,
    setProfileDraft: jest.fn(),
    saveProfile: jest.fn(e => e.preventDefault()),
    profileMessage: "",
    googleEnabled: true,
    googleCalendarStatus: "idle",
    googleCalendarMessage: "",
    googleCalendarEventsCount: 0,
    googleCalendarLastSyncedAt: null,
    connectGoogleCalendar: jest.fn(),
    disconnectGoogleCalendar: jest.fn(),
    refreshGoogleCalendar: jest.fn(),
    passwordDraft: { currentPassword: "", newPassword: "", confirmPassword: "" },
    setPasswordDraft: jest.fn(),
    updatePassword: jest.fn(e => e.preventDefault()),
    securityMessage: "",
    googleTasksEnabled: true,
    googleTasksStatus: "idle",
    googleTasksMessage: "",
    googleTasksLastSyncedAt: null,
    googleTaskLists: [],
    selectedGoogleTaskListId: "",
    onSelectGoogleTaskList: jest.fn(),
    onConnectGoogleTasks: jest.fn(),
    onImportGoogleTasks: jest.fn(),
    onExportGoogleTasks: jest.fn(),
    onRefreshGoogleTasks: jest.fn(),
    workspaceRole: "owner",
    onLogout: jest.fn(),
    theme: "dark",
    onToggleTheme: jest.fn(),
    allTags: [{ tag: "important", taskCount: 2, meetingCount: 1 }],
    onRenameTag: jest.fn(),
    onDeleteTag: jest.fn(),
    vocabulary: ["Antigravity"],
    onUpdateVocabulary: jest.fn(),
    sessionToken: "test_token",
    apiBaseUrl: "http://localhost:4000",
  };

  test("renders profile information correctly", () => {
    render(<ProfileTab {...defaultProps} />);
    expect(screen.getByText("Anna Nowak")).toBeInTheDocument();
    expect(screen.getByText(/Product Manager/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Anna Nowak")).toBeInTheDocument();
  });

  test("calls onToggleTheme when theme button is clicked", () => {
    render(<ProfileTab {...defaultProps} />);
    const themeBtn = screen.getByText(/Jasny/i); // Current is dark, button shows "Jasny"
    fireEvent.click(themeBtn);
    expect(defaultProps.onToggleTheme).toHaveBeenCalled();
  });

  test("renames a tag in the tag manager", () => {
    render(<ProfileTab {...defaultProps} />);
    const tagBtn = screen.getByText("#important");
    fireEvent.click(tagBtn);
    
    const input = screen.getByDisplayValue("important");
    fireEvent.change(input, { target: { value: "critical" } });
    fireEvent.keyDown(input, { key: "Enter" });
    
    expect(defaultProps.onRenameTag).toHaveBeenCalledWith("important", "critical");
  });

  test("adds a term to vocabulary", () => {
    render(<ProfileTab {...defaultProps} />);
    const input = screen.getByPlaceholderText(/np. Antigravity/i);
    fireEvent.change(input, { target: { value: "Kubernetes" } });
    fireEvent.submit(input);
    
    expect(defaultProps.onUpdateVocabulary).toHaveBeenCalledWith(["Antigravity", "Kubernetes"]);
  });

  test("calls onLogout when logout button is clicked", () => {
    render(<ProfileTab {...defaultProps} />);
    const logoutBtn = screen.getByText("Wyloguj");
    fireEvent.click(logoutBtn);
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });
});
