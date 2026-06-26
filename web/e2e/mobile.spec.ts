import { test, expect } from '@playwright/test';

// Responsive/mobile: at a phone viewport the list and detail swap with a back button, and a bottom
// tab bar replaces the side rail.
test.use({ viewport: { width: 390, height: 800 } });

test('mobile: list↔conversation swap with back + bottom nav', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  // Bottom tab bar is visible on mobile; the side rail is hidden.
  await expect(page.getByTestId('mobile-nav')).toBeVisible();

  // The chat list is shown; the conversation pane is hidden until a chat is opened.
  const list = page.locator('.list');
  await expect(list).toBeVisible();
  await expect(page.getByTestId('messages')).toBeHidden();

  // Open a chat → detail pane shows with a back button.
  await page.locator('.row', { hasText: 'Nadia' }).click();
  await expect(page.getByTestId('messages')).toBeVisible();
  const back = page.getByTestId('mobile-back');
  await expect(back).toBeVisible();

  // Back returns to the list.
  await back.click();
  await expect(page.locator('.list')).toBeVisible();
  await expect(page.getByTestId('messages')).toBeHidden();

  // Bottom nav switches sections.
  await page.getByTestId('mobile-nav').locator('button', { hasText: '🗂️' }).click();
  await expect(page.getByTestId('forums-list')).toBeVisible();
});
