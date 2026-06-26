import { test, expect } from '@playwright/test';

// Typing indicator + quick reaction in the live 1:1 chat.
test('peer typing indicator shows before the reply', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await expect(page.getByTestId('messages')).toBeVisible();

  const input = page.getByPlaceholder('Message');
  await input.fill('are you there?');
  await input.press('Enter');

  // The simulated peer shows a typing indicator, then sends its reply.
  await expect(page.getByTestId('chat-subtitle')).toHaveText(/typing/i, { timeout: 5000 });
  await expect(page.getByTestId('messages').getByText(/decrypted|encrypted/i)).toBeVisible({ timeout: 10_000 });
  // After replying, the indicator clears.
  await expect(page.getByTestId('chat-subtitle')).not.toHaveText(/typing/i, { timeout: 5000 });
});

test('double-tap adds a 👍 reaction and tapping again removes it', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  const unique = `react-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(unique);
  await input.press('Enter');

  const bubble = messages.getByText(unique);
  await bubble.dblclick();
  await expect(messages.getByText('👍 1')).toBeVisible();

  await bubble.dblclick();
  await expect(messages.getByText('👍 1')).toHaveCount(0);
});
