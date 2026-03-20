import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotesTab from "./NotesTab";
import { vi, describe, test, expect } from "vitest";

const mockMeetings = [
  {
    id: "m1",
    title: "Spotkanie zespołu",
    startsAt: "2026-03-10T10:00:00Z",
    tags: ["zespół", "ważne"],
    attendees: ["Anna", "Bartek"],
    context: "Omówienie planów kwartalnych",
    analysis: {
      summary: "Ustaliliśmy najważniejsze cele.",
      decisions: ["Więcej budżetu na marketing"],
      actionItems: ["Anna: Wyślij raport"],
      followUps: ["Do weryfikacji za tydzień"],
      answersToNeeds: [{ need: "Cel?", answer: "Sprecyzowany." }],
    },
    recordings: [
      { createdAt: "2026-03-10T10:05:00Z", markers: [{ timestamp: 120, label: "Ważne", note: "Tutaj mówimy o kosztach" }] }
    ]
  },
  {
    id: "m2",
    title: "Spotkanie z klientem",
    createdAt: "2026-02-15T15:00:00Z",
    tags: ["klient"],
    attendees: ["Jan"],
    context: "Omówienie problemów <b>technicznych</b>",
  }
];

describe("NotesTab", () => {
  test("renders empty state", () => {
    render(<NotesTab userMeetings={[]} />);
    expect(screen.getByText("Brak notatek")).toBeInTheDocument();
  });

  test("renders list of notes and allows filtering, grouping and selecting", async () => {
    const handleOpenMeeting = vi.fn();
    const handleCreateNote = vi.fn();

    render(
      <NotesTab
        userMeetings={mockMeetings as any}
        onOpenMeeting={handleOpenMeeting}
        onCreateNote={handleCreateNote}
      />
    );

    // Initial load: One in sidebar, one in detail (since m1 is auto-selected)
    expect(screen.getAllByText("Spotkanie zespołu").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Spotkanie z klientem")).toBeInTheDocument();

    // Select note m1 (click the card in the sidebar)
    const card = screen.getAllByText("Spotkanie zespołu").find(el => el.classList.contains("note-card-title"));
    await userEvent.click(card as HTMLElement);
    
    expect(screen.getAllByText("Ustaliliśmy najważniejsze cele.")[0]).toBeInTheDocument();
    
    // Open in studio
    await userEvent.click(screen.getByRole("button", { name: /Otwórz w Studio/i }));
    expect(handleOpenMeeting).toHaveBeenCalledWith("m1");

    // Search
    const searchInput = screen.getByPlaceholderText(/Szukaj w notatkach/i);
    await userEvent.type(searchInput, "klientem");
    expect(screen.getByText("Spotkanie z klientem")).toBeInTheDocument();

    // Clear search
    await userEvent.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(screen.getAllByText("Spotkanie zespołu").length).toBeGreaterThanOrEqual(1);

    // Filter by tag - use text matching and class to avoid encoding/aria issues without using container
    const tagFilterBtn = screen.queryAllByRole("button")
        .find(btn => btn.classList.contains("notes-filter-tag") && btn.textContent?.includes("wa"));
    
    expect(tagFilterBtn).toBeDefined();
    await userEvent.click(tagFilterBtn as HTMLElement);
    expect(screen.getAllByText("Spotkanie zespołu").length).toBeGreaterThanOrEqual(1);

    // Grouping
    await userEvent.click(screen.getByRole("button", { name: "Tagu" }));
    await userEvent.click(screen.getByRole("button", { name: "Osoby" }));
    await userEvent.click(screen.getByRole("button", { name: "Brak" }));

    // Create new note panel
    await userEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));
    expect(screen.getByPlaceholderText(/Tytuł notatki/i)).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/Tytuł notatki/i), "Nowy manualny wpis");
    const tagInput = screen.getByPlaceholderText(/Tagi/i);
    await userEvent.type(tagInput, "nowytag{enter}");
    expect(screen.getByText("#nowytag")).toBeInTheDocument();
    
    // Remove tag
    await userEvent.click(screen.getByRole("button", { name: "×" }));
    
    await userEvent.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    expect(handleCreateNote).toHaveBeenCalled();
  }, 15000);
});
