import { test, expect } from '@playwright/test';

test('create a custom forum with a governance mode', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🗂️' }).click();

  await page.getByTestId('new-forum-input').fill('My Research Forum');
  await page.getByTestId('forum-gov').selectOption('2'); // DAO
  await page.getByTestId('new-forum-input').press('Enter');

  await expect(page.getByTestId('forums-list').getByText('My Research Forum')).toBeVisible();
  await expect(page.getByTestId('last-tx')).toContainText(/createForum/);
});
