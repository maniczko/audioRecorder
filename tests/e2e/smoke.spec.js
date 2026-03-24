// @ts-check
const { test, expect } = require("@playwright/test");
const { seedLoggedInUser, seedMeeting } = require("./helpers/seed");

test.describe("Smoke product flows", () => {
  test("login via registration opens the app", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Rejestracja" }).click();
    await page.getByPlaceholder("np. Anna Nowak").fill("Smoke Tester");
    await page.getByPlaceholder("name@company.com").fill(`smoke.${Date.now()}@example.com`);
    await page.getByPlaceholder("minimum 6 znakow").fill("haslo123");
    await page.getByPlaceholder("np. Zespol sprzedazy").fill("Smoke Workspace");
    await page.getByRole("button", { name: "Wejdz do workspace" }).click();

    await expect(page.getByRole("button", { name: "Tab Studio" })).toBeVisible();
  });

  test("creates a meeting from studio", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto("/");

    const meetingTitle = `Smoke meeting ${Date.now()}`;

    await page.getByRole("button", { name: "Przygotuj brief" }).click();
    await page.locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']").fill(meetingTitle);
    await page.locator(".brief-actions .primary-button").click();

    await expect(page.locator(".ff-header-title")).toHaveText(meetingTitle);
  });

  test("adds a task from tasks tab", async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto("/");

    const taskTitle = `Smoke task ${Date.now()}`;

    await page.getByRole("button", { name: "Tab Zadania" }).click();
    await page.getByPlaceholder("Dodaj zadanie (N)").fill(taskTitle);
    await page.getByRole("button", { name: "Dodaj" }).click();

    await expect(page.getByText(taskTitle)).toBeVisible();
  });

  test("opens recording view for a meeting with recordings", async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, {
      id: "meeting_recording_smoke",
      title: "Meeting with recording",
      recordings: [
        {
          id: "recording_smoke_1",
          createdAt: "2026-03-20T10:00:00.000Z",
          duration: 320,
          pipelineStatus: "done",
          transcript: [],
          analysis: { summary: "OK" },
        },
      ],
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Tab Nagrania" }).click();
    await expect(page.getByText("Meeting with recording").first()).toBeVisible();
  });
});
