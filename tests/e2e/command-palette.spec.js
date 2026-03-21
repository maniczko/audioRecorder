// @ts-check
const { test, expect } = require("@playwright/test");
const { seedLoggedInUser, seedMeeting, seedTask } = require("./helpers/seed");

async function openPalette(page) {
  await page.locator(".command-palette-launcher").click();
  await expect(page.locator(".command-palette")).toBeVisible();
}

test.describe("Command Palette - nawigacja", () => {
  test.beforeEach(async ({ page }) => {
    await seedLoggedInUser(page);
    await seedMeeting(page, { title: "Spotkanie Demo" });
    await seedTask(page, { title: "Task Demo" });
    await page.goto("/");
    await expect(page.locator(".tab-pill").filter({ hasText: "Studio" })).toBeVisible();
  });

  test("przycisk na pasku otwiera command palette", async ({ page }) => {
    await openPalette(page);
  });

  test("wpisanie frazy filtruje wyniki", async ({ page }) => {
    await openPalette(page);
    await page.locator(".command-palette input").fill("Demo");
    await expect(page.locator(".command-result").filter({ hasText: "Demo" }).first()).toBeVisible();
  });

  test("wybranie spotkania z palety otwiera je w Studio", async ({ page }) => {
    await openPalette(page);
    await page.locator(".command-palette input").fill("Spotkanie Demo");

    const firstResult = page.locator(".command-result").first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();

    await expect(page.locator(".command-palette")).not.toBeVisible();
    await expect(page.locator(".tab-pill.active").filter({ hasText: "Studio" })).toBeVisible();
  });

  test("Escape zamyka command palette", async ({ page }) => {
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(".command-palette")).not.toBeVisible();
  });

  test("klikniecie tla zamyka command palette", async ({ page }) => {
    await openPalette(page);
    await page.locator(".command-palette-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(page.locator(".command-palette")).not.toBeVisible();
  });

  test("nieistniejaca fraza pokazuje komunikat braku wynikow", async ({ page }) => {
    await openPalette(page);
    await page.locator(".command-palette input").fill("xqzxqz_nieistnieje_123");
    await expect(page.locator(".empty-panel, .command-palette-results .empty")).toBeVisible();
  });
});
