import { test, expect } from '@playwright/test';

// On-chain achievement badges (gamification) render on the Discover people list.
test('discover shows a user achievement badge', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🧭' }).click();

  const users = page.getByTestId('top-users');
  // bob has the seeded badge #1 (Top Contributor) and ranks first by reputation.
  const bob = users.locator('.row', { hasText: 'bob.eth' });
  await expect(bob.getByTestId('badge').first()).toBeVisible();
  await expect(bob.getByTestId('badge').first()).toHaveText('🏅');
});
