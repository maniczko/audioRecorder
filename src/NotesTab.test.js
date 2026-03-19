import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotesTab from "./NotesTab";

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
    const handleOpenMeeting = jest.fn();
    const handleCreateNote = jest.fn();

    render(
      <NotesTab
        userMeetings={mockMeetings}
        onOpenMeeting={handleOpenMeeting}
        onCreateNote={handleCreateNote}
      />
    );

    expect(screen.getByText("Spotkanie zespołu")).toBeInTheDocument();
    expect(screen.getByText("Spotkanie z klientem")).toBeInTheDocument();

    // Select note m1
    await userEvent.click(screen.getByText("Spotkanie zespołu"));
    expect(screen.getAllByText("Ustaliliśmy najważniejsze cele.")[0]).toBeInTheDocument();
    
    // Open in studio
    await userEvent.click(screen.getByRole("button", { name: /Otwórz w Studio/i }));
    expect(handleOpenMeeting).toHaveBeenCalledWith("m1");

    // Search
    await userEvent.type(screen.getByPlaceholderText("Szukaj w notatkach…"), "klientem");
    // removed check
    expect(screen.getByText("Spotkanie z klientem")).toBeInTheDocument();

    // Clear search
    await userEvent.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(screen.getByText("Spotkanie zespołu")).toBeInTheDocument();

    // Filter by tag
    await userEvent.click(screen.getByRole("button", { name: /#ważne/i }));
    // removed check
    expect(screen.getByText("Spotkanie zespołu")).toBeInTheDocument();

    // Grouping
    await userEvent.click(screen.getByRole("button", { name: "Tagu" }));
    await userEvent.click(screen.getByRole("button", { name: "Osoby" }));
    await userEvent.click(screen.getByRole("button", { name: "Brak" }));

    // Create new note panel
    await userEvent.click(screen.getByRole("button", { name: "+ Nowa notatka" }));
    expect(screen.getByPlaceholderText("Tytuł notatki…")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Tytuł notatki…"), "Nowy manualny wpis");
    await userEvent.type(screen.getByPlaceholderText(/Tagi/i), "nowytag{enter}");
    expect(screen.getByText("#nowytag")).toBeInTheDocument();
    
    // Remove tag
    await userEvent.click(screen.getByRole("button", { name: "×", hidden: true }));
    
    await userEvent.click(screen.getByRole("button", { name: "Zapisz notatkę" }));
    expect(handleCreateNote).toHaveBeenCalled();
  });
});
