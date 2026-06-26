import { test, expect } from '@playwright/test';

// Reputation-gated visibility: a post downvoted below zero collapses by default and can be revealed.
test('low-score post collapses and can be shown', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🗂️' }).click();

  // Create a fresh thread (score 0), then downvote it to -1.
  const title = `gated-${Date.now()}`;
  await page.getByTestId('new-thread-input').fill(title);
  await page.getByTestId('post-thread').click();

  // The new thread is last; downvote it.
  const newRow = page.getByTestId('thread').last();
  await newRow.getByTestId('downvote').click();

  // It collapses behind a "low-reputation post hidden" notice.
  const collapsed = page.getByTestId('collapsed');
  await expect(collapsed.first()).toBeVisible();
  await expect(page.getByTestId('threads').getByText(title)).toHaveCount(0);

  // Reveal it.
  await page.getByTestId('show-collapsed').first().click();
  await expect(page.getByTestId('threads').getByText(title)).toBeVisible();
});
