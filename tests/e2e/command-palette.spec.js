```javascript
import { test, expect } from '@playwright/test';

test.describe('Command Palette - nawigacja', () => {
  test('przycisk na pasku otwiera command palette', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('#command-palette-button');
    await expect(page.locator('.command-palette')).toBeVisible();
  });

  test('wpisanie frazy filtruje wyniki', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('#command-palette-button');
    await page.fill('.command-palette input', 'search term');
    await expect(page.locator('.command-palette-results')).toContainText('Expected Result');
  });

  test('wybranie spotkania z palety otwiera je w Studio', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('#command-palette-button');
    await page.fill('.command-palette input', 'meeting name');
    await page.click('.command-palette-results .result-item');
    await expect(page).toHaveURL(/.*meeting-name/);
  });

  test('Escape zamyka command palette', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('#command-palette-button');
    await page.press('.command-palette input', 'Escape');
    await expect(page.locator('.command-palette')).not.toBeVisible();
  });

  test('klikniecie tla zamyka command palette', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('#command-palette-button');
    await page.click('.overlay'); // Assuming there's an overlay to close the palette
    await expect(page.locator('.command-palette')).not.toBeVisible();
  });

  test('nieistniejaca fraza pokazuje komunikat braku wynikow', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('#command-palette-button');
    await page.fill('.command-palette input', 'nonexistent term');
    await expect(page.locator('.no-results')).toHaveText('No results found');
  });
});
```
