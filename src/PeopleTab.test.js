/* eslint-disable testing-library/no-node-access */
import { render, screen, fireEvent } from "@testing-library/react";
import PeopleTab from "./PeopleTab";

describe("PeopleTab", () => {
  const mockProfiles = [
    {
      id: "person_1",
      name: "Anna Nowak",
      summary: "Project Manager in Warsaw",
      meetings: [{ id: "m1", title: "Sync", startsAt: "2026-03-18T10:00:00Z" }],
      tasks: [{ id: "t1", title: "Prepare report", status: "todo", priority: "high", completed: false, tags: ["urgent"] }],
      traits: ["Organized", "Communicative"],
      tags: ["PM", "Warsaw"],
      needs: ["Clear goals"],
      outputs: ["Monthly report"],
      openTasks: 1,
      completedTasks: 0,
    },
    {
      id: "person_2",
      name: "Jan Kowalski",
      summary: "Lead Developer",
      meetings: [],
      tasks: [],
      traits: [],
      tags: ["Dev"],
      needs: [],
      outputs: [],
      openTasks: 0,
      completedTasks: 5,
    }
  ];

  const defaultProps = {
    profiles: mockProfiles,
    onOpenMeeting: jest.fn(),
    onOpenTask: jest.fn(),
    onCreateTask: jest.fn(),
    onCreateMeeting: jest.fn(),
    onUpdatePersonNotes: jest.fn(),
    onAnalyzePersonProfile: jest.fn(),
    externalSelectedPersonId: "",
    onPersonSelectionHandled: jest.fn(),
  };

  test("renders profile sidebar and selected person details", async () => {
    render(<PeopleTab {...defaultProps} />);
    expect(screen.getAllByText("Anna Nowak").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jan Kowalski").length).toBeGreaterThan(0);
    
    // Check main panel (Anna should be selected by default)
    expect(screen.getByRole("heading", { name: "Anna Nowak" })).toBeInTheDocument();
  });

  test("filters people list by search query", async () => {
    render(<PeopleTab {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Szukaj po imieniu/i);
    
    fireEvent.change(searchInput, { target: { value: "Jan" } });
    
    expect(screen.queryByText("Anna Nowak")).not.toBeInTheDocument();
    expect((await screen.findAllByText("Jan Kowalski"))[0]).toBeInTheDocument();
  });

  test("switches between people when sidebar item is clicked", async () => {
    render(<PeopleTab {...defaultProps} />);
    const janText = screen.getByText("Jan Kowalski");
    const janBtn = janText.closest("button");
    
    fireEvent.click(janBtn);
    
    expect(screen.getByRole("heading", { name: "Jan Kowalski" })).toBeInTheDocument();
  });

  test("adds a new need for the selected person", () => {
    render(<PeopleTab {...defaultProps} />);
    
    // Find add need button
    const addBtn = screen.getByTitle("Dodaj potrzebę");
    fireEvent.click(addBtn);
    
    const input = screen.getByPlaceholderText(/np. Jasne priorytety/i);
    fireEvent.change(input, { target: { value: "Quiet space" } });
    fireEvent.submit(input);
    
    expect(defaultProps.onUpdatePersonNotes).toHaveBeenCalledWith("person_1", expect.objectContaining({
      needs: ["Clear goals", "Quiet space"]
    }));
  });

  test("calls onOpenMeeting when history item is clicked", () => {
    render(<PeopleTab {...defaultProps} />);
    const meetingCard = screen.getByText("Sync");
    fireEvent.click(meetingCard);
    
    expect(defaultProps.onOpenMeeting).toHaveBeenCalledWith("m1");
  });
});
