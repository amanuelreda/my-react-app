import { test, expect } from '@playwright/test';

// "Crystallize" a chat message into a forum thread (chat → forum), a TeleBlock innovation.
test('crosspost a chat message to a forum thread', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  const text = `idea-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(text);
  await input.press('Enter');

  // Crystallize that message.
  await messages.getByText(text).locator('xpath=ancestor::*[.//button[@data-testid="crosspost-btn"]][1]').getByTestId('crosspost-btn').first().click();
  await expect(page.getByTestId('crosspost-banner')).toBeVisible();

  // It now appears as a thread in the Protocol & Governance forum.
  await page.locator('.rail button', { hasText: '🗂️' }).click();
  await expect(page.getByTestId('threads').getByText(`From chat: ${text}`)).toBeVisible();
});
