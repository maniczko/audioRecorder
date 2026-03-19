import * as google from "./google";

describe("google lib", () => {
  beforeEach(() => {
    global.window = Object.create(window);
    Object.defineProperty(window, "atob", {
      value: jest.fn(() => JSON.stringify({ name: "Testing" })),
    });
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      })
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("fetchPrimaryCalendarEvents", async () => {
    const res = await google.fetchPrimaryCalendarEvents("token", { timeMin: "2026-01-01", timeMax: "2026-12-01" });
    expect(global.fetch).toHaveBeenCalled();
    expect(res).toBeDefined();
  });

  test("fetchPrimaryCalendarEvents without timeMin/timeMax", async () => {
    const res = await google.fetchPrimaryCalendarEvents("token", {});
    expect(global.fetch).toHaveBeenCalled();
    expect(res).toBeDefined();
  });
  
  test("fetchGoogleTaskLists", async () => {
    const res = await google.fetchGoogleTaskLists("token");
    expect(global.fetch).toHaveBeenCalled();
    expect(res).toBeDefined();
  });

  test("fetchGoogleTasks", async () => {
    await google.fetchGoogleTasks("token", "list1");
    expect(global.fetch).toHaveBeenCalled();
  });

  test("createGoogleTask", async () => {
    await google.createGoogleTask("token", "list1", { title: "New Task" });
    expect(global.fetch).toHaveBeenCalled();
  });

  test("updateGoogleTask", async () => {
    await google.updateGoogleTask("token", "list1", "t1", { status: "completed" });
    expect(global.fetch).toHaveBeenCalled();
  });

  test("signOutGoogleSession handles undefined safely", () => {
    expect(() => google.signOutGoogleSession()).not.toThrow();
  });

  test("buildGoogleCalendarEventPayload creates proper object", () => {
    const payload = google.buildGoogleCalendarEventPayload({ title: "My event", startsAt: "2026-01-01T00:00", endsAt: "2026-01-01T01:00" });
    expect(payload.summary).toBe("My event");
    
    // With attendees
    const withAttendees = google.buildGoogleCalendarEventPayload(
      { title: "My event", startsAt: "2026-01-01T00:00", endsAt: "2026-01-01T01:00" },
      { attendees: [{ email: "test@example.com" }] }
    );
    expect(withAttendees.attendees.length).toBe(1);
  });
});
