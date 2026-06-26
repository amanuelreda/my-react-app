import { test, expect } from '@playwright/test';

// In-chat search filters the conversation to matching messages.
test('searching within a chat filters messages', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  const input = page.getByPlaceholder('Message');
  await input.fill('apple pie recipe'); await input.press('Enter');
  await input.fill('banana bread'); await input.press('Enter');

  await page.getByTestId('toggle-chat-search').click();
  const search = page.getByTestId('chat-search-input');
  await search.fill('banana');

  await expect(messages.getByText('banana bread')).toBeVisible();
  await expect(messages.getByText('apple pie recipe')).toHaveCount(0);
  await expect(page.getByTestId('chat-search-count')).toContainText('1 found');
});
