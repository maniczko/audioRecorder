import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ProfileTab from "./ProfileTab";

const apiRequestMock = vi.fn();
const apiBaseUrlConfiguredMock = vi.fn(() => false);

vi.mock("./services/httpClient", () => ({
  apiRequest: (...args: any[]) => apiRequestMock(...args),
}));

vi.mock("./services/config", () => ({
  apiBaseUrlConfigured: () => apiBaseUrlConfiguredMock(),
}));

describe("ProfileTab voice profiles", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    apiBaseUrlConfiguredMock.mockReset();
    apiBaseUrlConfiguredMock.mockReturnValue(false);
  });

  function renderProfileTab() {
    return render(
      <ProfileTab
        currentUser={{ email: "anna@example.com", provider: "local", passwordHash: "hash" }}
        profileDraft={{
          name: "Anna",
          role: "",
          company: "",
          phone: "",
          location: "",
          avatarUrl: "",
          team: "",
          timezone: "Europe/Warsaw",
          googleEmail: "",
          preferredInsights: "",
          bio: "",
          notifyDailyDigest: false,
          autoTaskCapture: false,
          preferredTaskView: "list",
        }}
        setProfileDraft={vi.fn()}
        saveProfile={(e: any) => e?.preventDefault?.()}
        profileMessage=""
        googleEnabled={false}
        googleCalendarStatus="idle"
        googleCalendarMessage=""
        googleCalendarEventsCount={0}
        googleCalendarLastSyncedAt=""
        connectGoogleCalendar={vi.fn()}
        disconnectGoogleCalendar={vi.fn()}
        refreshGoogleCalendar={vi.fn()}
        passwordDraft={{ currentPassword: "", newPassword: "", confirmPassword: "" }}
        setPasswordDraft={vi.fn()}
        updatePassword={(e: any) => e?.preventDefault?.()}
        securityMessage=""
        googleTasksEnabled={false}
        googleTasksStatus="idle"
        googleTasksMessage=""
        googleTasksLastSyncedAt=""
        googleTaskLists={[]}
        selectedGoogleTaskListId=""
        onSelectGoogleTaskList={vi.fn()}
        onConnectGoogleTasks={vi.fn()}
        onImportGoogleTasks={vi.fn()}
        onExportGoogleTasks={vi.fn()}
        onRefreshGoogleTasks={vi.fn()}
        workspaceRole="owner"
        onLogout={vi.fn()}
        theme="dark"
        onSetTheme={vi.fn()}
        layoutPreset="default"
        onSetLayoutPreset={vi.fn()}
        allTags={[]}
        onRenameTag={vi.fn()}
        onDeleteTag={vi.fn()}
        vocabulary={[]}
        onUpdateVocabulary={vi.fn()}
        sessionToken=""
        apiBaseUrl=""
      />
    );
  }

  test("shows a clear backend configuration message and disables recording when api is unavailable", async () => {
    renderProfileTab();

    expect(screen.getByText(/Profile glosowe wymagaja backend API/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nagraj/i })).toBeDisabled();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });
});
