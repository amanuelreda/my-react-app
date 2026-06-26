import { test, expect } from '@playwright/test';

// Creating a group applies a GroupCreated event to the in-browser indexer (you become owner) and
// builds the on-chain createGroup() calldata.
test('create a group: appears in the list with the creator as owner', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '👥' }).click();

  const name = `My Group ${Date.now()}`;
  await page.getByTestId('new-group-input').fill(name);
  await page.getByTestId('create-group').click();

  // It shows in the list and opens on its Members tab with the creator as owner.
  await expect(page.getByTestId('groups-list').getByText(name)).toBeVisible();
  await expect(page.getByTestId('group-members').getByText('owner')).toBeVisible();
  await expect(page.getByTestId('group-tx')).toContainText(/createGroup/);
});
