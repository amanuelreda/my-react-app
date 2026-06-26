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

test('network switcher and data export', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button[title="Profile"]').click();

  // Network switcher.
  const net = page.getByTestId('network-select');
  await expect(net).toHaveValue('base-sepolia');
  await net.selectOption('base');
  await expect(net).toHaveValue('base');

  // Data export downloads a JSON file.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-data').click(),
  ]);
  expect(download.suggestedFilename()).toBe('teleblock-export.json');
});

test('on-chain identity section reflects demo mode by default', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button[title="Profile"]').click();

  // No VITE_IDENTITY_REGISTRY configured -> demo mode, Publish disabled with a runbook hint.
  await expect(page.getByTestId('onchain-status')).toContainText(/Demo mode/);
  await expect(page.getByTestId('publish-onchain')).toBeDisabled();
});
