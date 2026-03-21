// @ts-check
const { test, expect } = require("@playwright/test");
async function seedUi(page, { theme = "dark", layoutPreset = "default" } = {}) {
  await page.addInitScript(({ payload }) => {
    localStorage.setItem(
      "voicelog_ui_store",
      JSON.stringify({
        state: {
          theme: payload.theme,
          layoutPreset: payload.layoutPreset,
          notificationState: { dismissedIds: [], deliveredIds: [] },
        },
        version: 0,
      })
    );
  }, { payload: { theme, layoutPreset } });
}

test.describe("Layout visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("auth layout w dark/default pozostaje stabilny", async ({ page }) => {
    await seedUi(page, { theme: "dark", layoutPreset: "default" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto("/");

    await expect(page.locator(".auth-shell")).toHaveScreenshot("auth-dark-default.png");
  });

  test("auth layout w wariancie beaver/bobr pozostaje spojny", async ({ page }) => {
    await seedUi(page, { theme: "beaver", layoutPreset: "bobr" });
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto("/");

    await expect(page.locator(".auth-shell")).toHaveScreenshot("auth-beaver-bobr.png");
  });
});
