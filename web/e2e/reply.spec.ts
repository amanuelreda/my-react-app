import { test, expect } from '@playwright/test';

// Reply-to-message: tap the reply affordance, see the quoted preview in the composer, send, and the
// new message renders with the quoted reply attached.
test('reply quotes the target message', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  const original = `original-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(original);
  await input.press('Enter');
  await expect(messages.getByText(original)).toBeVisible();

  // Start a reply to that message.
  await messages.getByText(original).locator('xpath=ancestor::*[.//button[@data-testid="reply-btn"]][1]').getByTestId('reply-btn').first().click();
  const preview = page.getByTestId('reply-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(original);

  // Send the reply; it carries the quoted preview.
  const replyText = `myreply-${Date.now()}`;
  await input.fill(replyText);
  await input.press('Enter');

  await expect(messages.getByText(replyText)).toBeVisible();
  // The quote block (author "You") renders inside the new message.
  await expect(messages.getByText('You').first()).toBeVisible();
  // Composer preview is cleared after sending.
  await expect(page.getByTestId('reply-preview')).toHaveCount(0);
});

test('cancel reply clears the composer preview', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');

  const original = `cancel-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(original);
  await input.press('Enter');

  await messages.getByText(original).locator('xpath=ancestor::*[.//button[@data-testid="reply-btn"]][1]').getByTestId('reply-btn').first().click();
  await expect(page.getByTestId('reply-preview')).toBeVisible();
  await page.getByTestId('cancel-reply').click();
  await expect(page.getByTestId('reply-preview')).toHaveCount(0);
});
