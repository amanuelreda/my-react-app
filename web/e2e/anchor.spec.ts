import { test, expect } from '@playwright/test';

// Group messages get batched into a Merkle root anchored via appendCommitment (tamper-evidence).
test('group chat anchors a Merkle commitment after a batch', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button', { hasText: '👥' }).click();
  await expect(page.getByTestId('group-messages')).toBeVisible();

  const input = page.getByPlaceholder('Message');
  // Two messages = one batch (BATCH=2) -> a commitment root is computed.
  await input.fill('first'); await input.press('Enter');
  await input.fill('second'); await input.press('Enter');

  const anchor = page.getByTestId('anchor');
  await expect(anchor).toBeVisible({ timeout: 10_000 });
  await expect(anchor).toContainText(/appendCommitment\(0x[0-9a-f]+/);
});
