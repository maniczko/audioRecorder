import {
  buildWorkspaceActivityFeed,
  getMeetingLastActivity,
  getTaskLastActivity,
} from "./activityFeed";

describe("activityFeed helpers", () => {
  test("picks the latest task activity entry", () => {
    const task = {
      id: "task_1",
      title: "Przygotuj demo",
      createdAt: "2026-03-15T08:00:00.000Z",
      updatedAt: "2026-03-15T10:00:00.000Z",
      history: [
        {
          id: "history_1",
          type: "created",
          actor: "Anna",
          message: "Utworzono zadanie.",
          createdAt: "2026-03-15T08:00:00.000Z",
        },
        {
          id: "history_2",
          type: "status",
          actor: "Bartek",
          message: "Przeniesiono zadanie do kolumny \"W toku\".",
          createdAt: "2026-03-15T10:00:00.000Z",
        },
      ],
    };

    expect(getTaskLastActivity(task)).toMatchObject({
      actor: "Bartek",
      message: "Przeniesiono zadanie do kolumny \"W toku\".",
    });
  });

  test("builds a combined workspace feed sorted from newest to oldest", () => {
    const meeting = {
      id: "meeting_1",
      title: "Daily sync",
      createdAt: "2026-03-15T08:00:00.000Z",
      updatedAt: "2026-03-15T09:00:00.000Z",
      activity: [
        {
          id: "meeting_activity_1",
          type: "updated",
          actorName: "Anna",
          message: "Zmieniono brief spotkania.",
          createdAt: "2026-03-15T09:00:00.000Z",
        },
      ],
    };
    const feed = buildWorkspaceActivityFeed(
      [meeting],
      [
        {
          id: "task_1",
          title: "Przygotuj demo",
          createdAt: "2026-03-15T08:00:00.000Z",
          updatedAt: "2026-03-15T10:00:00.000Z",
          history: [
            {
              id: "history_1",
              type: "status",
              actor: "Bartek",
              message: "Przeniesiono zadanie do kolumny \"W toku\".",
              createdAt: "2026-03-15T10:00:00.000Z",
            },
          ],
        },
      ]
    );

    expect(feed[0]).toMatchObject({
      entityType: "task",
      actor: "Bartek",
    });
    expect(getMeetingLastActivity(meeting)).toMatchObject({
      actor: "Anna",
      message: "Zmieniono brief spotkania.",
    });
    expect(feed[1]).toMatchObject({
      entityType: "meeting",
      actor: "Anna",
    });
  });
});
