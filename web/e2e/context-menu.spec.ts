import { test, expect } from '@playwright/test';

test('right-click a message opens a context menu with actions', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  const text = `ctx-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(text); await input.press('Enter');

  // Right-click the message bubble.
  await messages.getByText(text).click({ button: 'right' });
  const menu = page.getByTestId('context-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toContainText('Reply');
  await expect(menu).toContainText('Pin');
  await expect(menu).toContainText('Delete');

  // Pin via the menu → pinned bar appears.
  await menu.getByTestId('menu-item').filter({ hasText: 'Pin' }).click();
  await expect(page.getByTestId('pinned-bar')).toBeVisible();
  await expect(page.getByTestId('context-menu')).toHaveCount(0); // menu closed

  // Right-click again → Delete removes the message.
  await messages.getByText(text).click({ button: 'right' });
  await page.getByTestId('context-menu').getByTestId('menu-item').filter({ hasText: 'Delete' }).click();
  await expect(messages.getByText(text)).toHaveCount(0);
});
