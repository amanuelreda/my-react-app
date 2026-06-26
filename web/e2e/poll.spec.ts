import { test, expect } from '@playwright/test';

// Polls: create a poll, vote, see tallied results (and a peer vote on the live chat).
test('create a poll, vote, and see results', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  await page.getByTestId('poll-btn').click();
  const poll = messages.getByTestId('poll').first();
  await expect(poll).toBeVisible();
  await expect(poll).toContainText('Which L2');

  // Vote for the second option (Arbitrum).
  await poll.getByTestId('poll-option').nth(1).click();
  // Our vote is recorded (checkmark) and a percentage appears.
  await expect(poll.getByText('✓ Arbitrum')).toBeVisible();
  await expect(poll.getByTestId('poll-total')).toContainText(/vote/);

  // The simulated peer also votes (total grows beyond 1).
  await expect(poll.getByTestId('poll-total')).toContainText('2 votes', { timeout: 5000 });
});
