import React from "react";
import useUI from "../hooks/useUI";
import { Stack } from "../ui/LayoutPrimitives";
import "./WorkspaceSidebar.css";

export default function WorkspaceSidebar() {
  const ui = useUI();

  return (
    <div className="workspace-sidebar ui-sidebar">
      <Stack gap="sm">
        <button
          type="button"
          className={ui.activeTab === "studio" ? "sidebar-item active" : "sidebar-item"}
          onClick={ui.openStudio}
          aria-label="Tab Studio"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          Studio
        </button>

        <button
          type="button"
          className={ui.activeTab === "recordings" ? "sidebar-item active" : "sidebar-item"}
          onClick={() => ui.setActiveTab("recordings")}
          aria-label="Tab Nagrania"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 19V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2z"/><path d="M7 21v-4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/><path d="M11 3v4"/><path d="M15 3v4"/><path d="M3 11h18"/></svg>
          Nagrania
        </button>

        <button
          type="button"
          className={ui.activeTab === "calendar" ? "sidebar-item active" : "sidebar-item"}
          onClick={() => ui.setActiveTab("calendar")}
          aria-label="Tab Kalendarz"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          Kalendarz
        </button>

        <button
          type="button"
          className={ui.activeTab === "tasks" ? "sidebar-item active" : "sidebar-item"}
          onClick={() => ui.setActiveTab("tasks")}
          aria-label="Tab Zadania"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Zadania
        </button>

        <button
          type="button"
          className={ui.activeTab === "people" ? "sidebar-item active" : "sidebar-item"}
          onClick={() => ui.setActiveTab("people")}
          aria-label="Tab Osoby"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Osoby
        </button>

        <button
          type="button"
          className={ui.activeTab === "notes" ? "sidebar-item active" : "sidebar-item"}
          onClick={() => ui.setActiveTab("notes")}
          aria-label="Tab Notatki"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
          Notatki
        </button>
      </Stack>
    </div>
  );
}
