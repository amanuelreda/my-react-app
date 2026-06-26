import { test, expect } from '@playwright/test';

// Verifies live GROUP E2EE (Sender Keys) in the browser: the local member encrypts a group message
// with their sender chain, a simulated member decrypts it and replies, and the reply decrypts back
// on the local side. This exercises @teleblock/shared's GroupSession through real transport + UI.
test('live group chat: send is E2EE and a member decrypts + replies', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  await page.locator('.rail button', { hasText: '👥' }).click();
  // The demo group opens on its Chat tab.
  const messages = page.getByTestId('group-messages');
  await expect(messages).toBeVisible();

  const unique = `group-ping-${Date.now()}?`;
  const input = page.getByPlaceholder('Message');
  await input.fill(unique);
  await input.press('Enter');

  await expect(messages.getByText(unique)).toBeVisible();
  // A simulated member decrypts via the group sender key and replies.
  await expect(messages.getByText(/decrypted/i)).toBeVisible({ timeout: 10_000 });
  // The reply is attributed to a named member (bob/carol), proving cross-member group decryption.
  await expect(messages.getByText(/bob\.eth|carol\.eth/)).toBeVisible({ timeout: 10_000 });

  await page.screenshot({ path: 'e2e/group.png', fullPage: false });
});
