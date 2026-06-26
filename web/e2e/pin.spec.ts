import { test, expect } from '@playwright/test';

// Pinned messages: pin a message -> a pinned bar shows its text; unpin removes it.
test('pin and unpin a message', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  const text = `pin-me-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(text); await input.press('Enter');

  await messages.getByText(text).locator('xpath=ancestor::*[.//button[@data-testid="pin-btn"]][1]').getByTestId('pin-btn').first().click();

  const bar = page.getByTestId('pinned-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText(text);

  await page.getByTestId('unpin').click();
  await expect(page.getByTestId('pinned-bar')).toHaveCount(0);
});
