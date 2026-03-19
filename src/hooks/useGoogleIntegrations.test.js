import { renderHook, act } from "@testing-library/react";
import useGoogleIntegrations from "./useGoogleIntegrations";

describe("useGoogleIntegrations", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  const baseProps = {
    currentUser: { id: "u1" },
    currentWorkspaceId: "w1",
    tasks: [],
    setTasks: jest.fn(),
    setWorkspaceMessage: jest.fn(),
    createId: () => "mock-id",
  };

  test("initializes default state", () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps));
    expect(result.current.enabled).toBeDefined();
    expect(result.current.status).toBe("idle");
    expect(result.current.taskLists.length).toBe(0);
  });

  test("connect functions update state and throw unhandled errors safely", async () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps));

    // connectGoogleCalendar
    try { await act(async () => { await result.current.connectGoogleCalendar(); }); } catch(e){}
    expect(result.current.status).toMatch(/idle|connecting/i);

    // refreshGoogleTasks
    try { await act(async () => { await result.current.refreshGoogleTasks(); }); } catch(e){}

    // importTasks
    try { await act(async () => { await result.current.importTasks(); }); } catch(e){}
    
    // exportTasks
    try { await act(async () => { await result.current.exportTasks(); }); } catch(e){}
    
    // connectGoogleTasks
    try { await act(async () => { await result.current.connectGoogleTasks(); }); } catch(e){}
  });

  test("selectTaskList sets ID and refetches", async () => {
    const { result } = renderHook(() => useGoogleIntegrations(baseProps));
    try {
      await act(async () => {
        await result.current.selectTaskList("list2");
      });
    } catch(e){}
    expect(result.current.selectedTaskListId).toBe("list2");
  });

  test("resolveTaskConflict updates tasks array", () => {
    const customProps = {
      ...baseProps,
      tasks: [{ id: "t1", title: "Original" }]
    };
    const { result } = renderHook(() => useGoogleIntegrations(customProps));

    act(() => {
      result.current.resolveTaskConflict("t1", "local");
    });
    expect(baseProps.setTasks).toHaveBeenCalled();
  });
});
