import { test, expect } from '@playwright/test';

// Settings: theme switching (persisted) + privacy toggles.
test('theme switcher changes and persists the theme', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button[title="Profile"]').click();

  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'dark'); // default

  await page.getByTestId('theme-light').click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  // Background actually changes (light bg is near-white).
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(255, 255, 255)');

  await page.getByTestId('theme-amoled').click();
  await expect(html).toHaveAttribute('data-theme', 'amoled');

  // Persists across reload.
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'amoled');
});

test('privacy toggles flip state', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button[title="Profile"]').click();

  const receipts = page.getByTestId('toggle-receipts');
  await expect(receipts).toHaveAttribute('aria-pressed', 'true');
  await receipts.click();
  await expect(receipts).toHaveAttribute('aria-pressed', 'false');
});
