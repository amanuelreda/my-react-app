import { test, expect } from '@playwright/test';

test('add a second account and switch between them', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  await page.locator('.rail button[title="Profile"]').click();
  await expect(page.getByTestId('accounts-list').getByTestId('account-row')).toHaveCount(1);
  await expect(page.getByTestId('accounts-list')).toContainText('active');

  // Add a second account via the overlay.
  await page.getByTestId('add-account').click();
  await expect(page.getByTestId('add-account-overlay')).toBeVisible();
  await page.getByTestId('create-identity').click();

  // Back in the app on the new account; Profile now lists two accounts.
  await page.locator('.rail button[title="Profile"]').click();
  await expect(page.getByTestId('account-row')).toHaveCount(2);

  // Switch back to the first account.
  await page.getByTestId('account-row').first().click();
  await page.locator('.rail button[title="Profile"]').click();
  await expect(page.getByTestId('accounts-list').getByText('✓ active').first()).toBeVisible();
});
