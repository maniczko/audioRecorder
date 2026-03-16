// @ts-check
const { test, expect } = require("@playwright/test");
const { seedLoggedInUser, seedMeeting, seedTask } = require("./helpers/seed");

test.describe("Command Palette — nawigacja", () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, { title: "Spotkanie Demo" });
    await seedTask(page, { title: "Task Demo" });
    await page.goto("/");
    await expect(page.locator(".tab-pill").filter({ hasText: "Studio" })).toBeVisible();
  });

  // ── Open with keyboard shortcut ───────────────────────────────────────────
  test("Ctrl+K otwiera command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();
  });

  // ── Open with toolbar button ──────────────────────────────────────────────
  test("przycisk Ctrl+K na pasku otwiera command palette", async ({ page }) => {
    await page.locator(".command-palette-launcher").click();
    await expect(page.locator(".command-palette")).toBeVisible();
  });

  // ── Search filtering ──────────────────────────────────────────────────────
  test("wpisanie frazy filtruje wyniki", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator(".command-palette input").fill("Demo");

    // At least one result mentioning "Demo" should appear
    await expect(page.locator(".command-result").filter({ hasText: "Demo" }).first()).toBeVisible();
  });

  // ── Navigate to meeting via palette ───────────────────────────────────────
  test("wybranie spotkania z palety otwiera je w Studio", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator(".command-palette input").fill("Spotkanie Demo");

    const firstResult = page.locator(".command-result").first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();

    // Palette should close
    await expect(page.locator(".command-palette")).not.toBeVisible();

    // Studio tab should be active and meeting title visible in main area
    await expect(page.locator(".tab-pill.active").filter({ hasText: "Studio" })).toBeVisible();
  });

  // ── Close with Escape ────────────────────────────────────────────────────
  test("Escape zamyka command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator(".command-palette")).not.toBeVisible();
  });

  // ── Close with backdrop click ─────────────────────────────────────────────
  test("klikniecie tla zamyka command palette", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.locator(".command-palette")).toBeVisible();

    await page.locator(".command-palette-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".command-palette")).not.toBeVisible();
  });

  // ── No results ────────────────────────────────────────────────────────────
  test("nieistniejaca fraza pokazuje komunikat braku wynikow", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await page.locator(".command-palette input").fill("xqzxqz_nieistnieje_123");

    await expect(page.locator(".empty-panel, .command-palette-results .empty")).toBeVisible();
  });
});
