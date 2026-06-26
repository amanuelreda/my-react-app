import { test, expect } from '@playwright/test';

// Interactive forums: voting and new-thread posting mutate the in-browser indexer (live re-rank) and
// build on-chain ForumManager calldata (shown as a tx hint).
test('upvoting a thread increments its score and toggles', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🗂️' }).click();

  const row = page.getByTestId('thread').filter({ hasText: 'MLS vs Sender Keys for large' });
  await expect(row.getByTestId('thread-score')).toHaveText('3'); // seeded: a weight-3 upvote

  await row.getByTestId('upvote').click();
  await expect(row.getByTestId('thread-score')).toHaveText('4'); // +1 (new user weight 1)
  // A tx hint shows the encoded vote() calldata.
  await expect(page.getByTestId('last-tx')).toContainText(/vote\(/);

  // Toggling the same upvote removes it.
  await row.getByTestId('upvote').click();
  await expect(row.getByTestId('thread-score')).toHaveText('3');

  // Downvote subtracts.
  await row.getByTestId('downvote').click();
  await expect(row.getByTestId('thread-score')).toHaveText('2');
});

test('posting a new thread adds it to the forum', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '🗂️' }).click();

  const title = `New proposal ${Date.now()}`;
  await page.getByTestId('new-thread-input').fill(title);
  await page.getByTestId('post-thread').click();

  await expect(page.getByTestId('threads').getByText(title)).toBeVisible();
  await expect(page.getByTestId('last-tx')).toContainText(/createPost\(/);
});
