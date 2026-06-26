import { test, expect } from '@playwright/test';

// Forum moderation: pin (moves to top), hide (removed), lock (disables replies) — applied to the
// indexer with matching ForumManager.moderate() calldata.
test('pin, hide and lock a thread', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🗂️' }).click();

  // Pin the lower-ranked thread → it jumps to the top with a 📌.
  const mls = page.getByTestId('thread').filter({ hasText: 'MLS vs Sender Keys for large' });
  await mls.getByTestId('mod-pin').click();
  await expect(page.getByTestId('thread').first()).toContainText('📌');
  await expect(page.getByTestId('last-tx')).toContainText(/moderate\(.*3\)/); // status 3 = pinned

  // Expand it, then lock → the reply box is replaced by a "locked" note.
  const first = page.getByTestId('thread').first();
  await first.locator('.name').click(); // expand
  await expect(first.getByTestId('reply-input')).toBeVisible();
  await first.getByTestId('mod-lock').click();
  await expect(page.getByTestId('locked-note').first()).toBeVisible();

  // Hide the other thread → it disappears from the list.
  const gov = page.getByTestId('thread').filter({ hasText: 'reputation-gated forum visibility' });
  await gov.getByTestId('mod-hide').click();
  await expect(page.getByTestId('threads').getByText('reputation-gated forum visibility')).toHaveCount(0);
});
