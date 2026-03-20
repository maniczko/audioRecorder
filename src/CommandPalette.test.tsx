/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommandPalette from "./CommandPalette";
import { vi, describe, test, expect } from "vitest";

function renderCommandPalette(overrides = {}) {
  const defaultProps = {
    open: true,
    items: [
      { id: "mock_meeting", title: "Spotkanie Test", subtitle: "Wczoraj", type: "meeting", group: "Spotkania", payload: { meetingId: "m1" } },
      { id: "mock_task", title: "Zadanie Test", subtitle: "Dzisiaj", type: "task", group: "Zadania", payload: { taskId: "t1" } },
      { id: "mock_person", title: "Jan Kowalski", subtitle: "Członek", type: "person", group: "Osoby", payload: { personId: "p1" } },
    ],
    onClose: vi.fn(),
    onSelect: vi.fn(),
  };

  const props = { ...defaultProps, ...overrides };
  return { ...render(<CommandPalette {...props} />), props };
}

describe("CommandPalette", () => {
  test("does not render when closed", () => {
    const { container } = renderCommandPalette({ open: false });
    expect(container.firstChild).toBeNull();
  });

  test("renders groups and items when open", () => {
    renderCommandPalette();
    expect(screen.getByText("Spotkanie Test")).toBeInTheDocument();
    expect(screen.getByText("Zadanie Test")).toBeInTheDocument();
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText("Spotkania")).toBeInTheDocument();
  });

  test("filters results via input query", async () => {
    renderCommandPalette();
    const searchInput = screen.getByPlaceholderText("Zakladka, spotkanie, zadanie, osoba...");
    await userEvent.type(searchInput, "Kowalski");
    
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.queryByText("Spotkanie Test")).not.toBeInTheDocument();
    expect(screen.queryByText("Zadanie Test")).not.toBeInTheDocument();
  });

  test("calls onSelect when an item is clicked", async () => {
    const { props } = renderCommandPalette();
    const btn = screen.getByRole("button", { name: /Spotkanie Test/i });
    await userEvent.click(btn);
    
    // items[0] in original list is mock_meeting
    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "mock_meeting" }));
  });

  test("calls onClose when escape is pressed", async () => {
    const { props } = renderCommandPalette();
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    });
    
    expect(props.onClose).toHaveBeenCalled();
  });
  
  test("supports keyboard arrow navigation", async () => {
    const { props } = renderCommandPalette();
    // Default sorting is by title (when scores are 0): Jan (0), Spotkanie (1), Zadanie (2)
    
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown", code: "ArrowDown" });
    });
    // activeIndex should be 1 (Spotkanie Test)
    
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    });

    expect(props.onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "mock_meeting" }));
  });
});
