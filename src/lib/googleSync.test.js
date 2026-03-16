import {
  areCalendarSyncSnapshotsEqual,
  areGoogleTaskSnapshotsEqual,
  buildCalendarSyncSnapshot,
  buildGoogleTaskSnapshot,
  createGoogleCalendarConflictState,
  createGoogleTaskConflictState,
  detectGoogleTaskConflict,
} from "./googleSync";

describe("googleSync helpers", () => {
  test("detects a Google Task conflict when local and remote diverged", () => {
    const existingTask = {
      title: "Domknac budzet",
      dueDate: "2026-03-15T10:00:00.000Z",
      notes: "Wersja lokalna",
      completed: false,
      updatedAt: "2026-03-15T09:00:00.000Z",
      googleSyncedAt: "2026-03-15T08:00:00.000Z",
      googleSyncStatus: "local_changes",
    };
    const importedTask = {
      title: "Domknac budzet klienta",
      dueDate: "2026-03-15T11:00:00.000Z",
      notes: "Wersja z Google",
      completed: false,
      updatedAt: "2026-03-15T09:30:00.000Z",
      googleUpdatedAt: "2026-03-15T09:30:00.000Z",
      sourceMeetingTitle: "Google Tasks",
    };

    const result = detectGoogleTaskConflict(existingTask, importedTask);
    const conflictState = createGoogleTaskConflictState(existingTask, importedTask);

    expect(result.hasConflict).toBe(true);
    expect(conflictState.localSnapshot.title).toBe("Domknac budzet");
    expect(conflictState.remoteSnapshot.title).toBe("Domknac budzet klienta");
  });

  test("treats matching Google Task snapshots as equal", () => {
    expect(
      areGoogleTaskSnapshotsEqual(
        buildGoogleTaskSnapshot({
          title: "Follow up",
          dueDate: "2026-03-15T12:00:00.000Z",
          notes: "Notatka",
          completed: false,
        }),
        buildGoogleTaskSnapshot({
          title: "Follow up",
          due: "2026-03-15T12:00:00.000Z",
          description: "Notatka",
          status: "needsAction",
        })
      )
    ).toBe(true);
  });

  test("creates a calendar sync conflict when local and remote event changed after sync", () => {
    const localSnapshot = buildCalendarSyncSnapshot({
      title: "Weekly sync",
      startsAt: "2026-03-15T10:00:00.000Z",
      endsAt: "2026-03-15T11:00:00.000Z",
      durationMinutes: 60,
      location: "Studio",
    });
    const remoteSnapshot = buildCalendarSyncSnapshot({
      summary: "Weekly sync updated",
      start: { dateTime: "2026-03-15T11:00:00.000Z" },
      end: { dateTime: "2026-03-15T12:00:00.000Z" },
      location: "Google Meet",
    });

    const conflict = createGoogleCalendarConflictState({
      entryType: "meeting",
      localSnapshot,
      remoteSnapshot,
      localUpdatedAt: "2026-03-15T09:30:00.000Z",
      remoteUpdatedAt: "2026-03-15T09:40:00.000Z",
      lastSyncedAt: "2026-03-15T09:00:00.000Z",
    });

    expect(conflict).not.toBeNull();
    expect(areCalendarSyncSnapshotsEqual(conflict.localSnapshot, conflict.remoteSnapshot)).toBe(false);
  });

  test("task-event snapshot has endsAt = startsAt + 1h when endsAt not provided", () => {
    const snapshot = buildCalendarSyncSnapshot(
      { title: "Zrob raport", dueDate: "2026-03-15T10:00:00.000Z" },
      { type: "task" }
    );

    expect(snapshot.startsAt).toBe("2026-03-15T10:00:00.000Z");
    expect(snapshot.endsAt).toBe("2026-03-15T11:00:00.000Z");
    expect(snapshot.durationMinutes).toBe(60);
    expect(snapshot.startsAt).not.toBe(snapshot.endsAt);
  });

  test("task-event snapshot respects explicit endsAt when provided", () => {
    const snapshot = buildCalendarSyncSnapshot(
      { title: "Zrob raport", dueDate: "2026-03-15T10:00:00.000Z", endsAt: "2026-03-15T10:30:00.000Z" },
      { type: "task" }
    );

    expect(snapshot.endsAt).toBe("2026-03-15T10:30:00.000Z");
  });
});
