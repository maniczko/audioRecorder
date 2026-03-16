// @ts-check
const { test, expect } = require("@playwright/test");
const { seedLoggedInUser } = require("./helpers/seed");

test.describe("Studio — tworzenie i edycja spotkania", () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await page.goto("/");
    // Ensure we are on Studio tab
    await expect(page.locator(".tab-pill").filter({ hasText: "Studio" })).toBeVisible();
  });

  // ── Create meeting — happy path ───────────────────────────────────────────
  test("utworzenie spotkania z tytulem zapisuje je do listy", async ({ page }) => {
    const meetingTitle = `E2E Spotkanie ${Date.now()}`;

    // The sidebar meeting form should be visible
    await expect(page.locator(".workspace-sidebar")).toBeVisible();

    // Fill in the title
    await page.locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']").fill(meetingTitle);

    // Save
    await page.locator(".brief-actions .primary-button").click();

    // The meeting title should now appear somewhere in the sidebar recordings or header
    await expect(page.locator(".workspace-sidebar").getByText(meetingTitle)).toBeVisible();
  });

  // ── Create meeting — error: empty title ──────────────────────────────────
  test("przycisk zapisu jest nieaktywny gdy tytul jest pusty", async ({ page }) => {
    // Clear the title field (should be empty by default for a new draft)
    const titleInput = page.locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']");
    await titleInput.fill("");

    // The save button should be disabled
    await expect(page.locator(".brief-actions .primary-button")).toBeDisabled();
  });

  // ── Create meeting — fill datetime ────────────────────────────────────────
  test("uzupelnienie terminu spotkania i zapis dziala poprawnie", async ({ page }) => {
    const meetingTitle = `Spotkanie z datą ${Date.now()}`;
    await page.locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']").fill(meetingTitle);

    // Set a start time using datetime-local input
    const dateInput = page.locator(".workspace-sidebar input[type='datetime-local']");
    await dateInput.fill("2026-06-15T10:00");

    await page.locator(".brief-actions .primary-button").click();

    await expect(page.locator(".workspace-sidebar").getByText(meetingTitle)).toBeVisible();
  });

  // ── New meeting draft button ──────────────────────────────────────────────
  test("klikniecie Nowe resetuje formularz", async ({ page }) => {
    const titleInput = page.locator(".workspace-sidebar input[placeholder='np. Spotkanie z klientem']");
    await titleInput.fill("Tymczasowy tytul");

    await page.locator(".panel-header button").filter({ hasText: "+ Nowe" }).click();

    await expect(titleInput).toHaveValue("");
  });
});
