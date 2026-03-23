import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import Topbar from "./Topbar";

vi.mock("./store/workspaceStore", () => ({
  useWorkspaceSelectors: () => ({
    currentWorkspacePermissions: { canRecordAudio: true },
    currentWorkspaceId: "ws1",
    currentWorkspace: { name: "Workspace One" },
    currentWorkspaceMembers: [],
    currentWorkspaceRole: "admin",
    currentUser: { name: "Anna", avatarUrl: "", role: "PM", provider: "local" },
    availableWorkspaces: [{ id: "ws1", name: "Workspace One" }],
  }),
}));

// Mock GoogleContext properly - return a valid context object
vi.mock("./context/GoogleContext", () => ({
  useGoogleCtx: () => ({
    googleEnabled: false,
    googleSession: null,
    connectGoogle: vi.fn(),
    disconnectGoogle: vi.fn(),
  }),
}));

vi.mock("./context/RecorderContext", () => ({
  useRecorderCtx: () => ({
    isRecording: false,
    startRecording: vi.fn(),
  }),
}));

vi.mock("./hooks/useUI", () => ({
  default: () => ({
    navigateBack: vi.fn(),
    canGoBack: false,
    activeTab: "studio",
    openStudio: vi.fn(),
    setActiveTab: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    setNotificationCenterOpen: vi.fn(),
    dismissNotification: vi.fn(),
    activateNotification: vi.fn(),
    unreadNotificationCount: 0,
    notificationItems: [],
    notificationPermission: "default",
    browserNotificationsSupported: false,
    requestBrowserNotificationPermission: vi.fn(),
    notificationCenterOpen: false,
    switchWorkspace: vi.fn(),
  }),
}));

vi.mock("./NotificationCenter", () => ({
  default: () => null,
}));

describe("Topbar accessibility", () => {
  test("renders labelled controls and supports keyboard shortcuts", async () => {
    render(<Topbar />);

    expect(screen.getByRole("button", { name: "Nagraj ad hoc" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Otworz ustawienia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Szukaj" })).toBeInTheDocument();

    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("button", { name: "Szukaj" })).toBeInTheDocument();
  });
});
