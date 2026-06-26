import { test, expect } from '@playwright/test';

test('contacts: search, open profile, message and call', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();

  // Open contacts from the chat list.
  await page.getByTestId('open-contacts').click();
  await expect(page.getByTestId('contacts')).toBeVisible();

  // Search filters the list.
  await page.getByTestId('contacts-search').fill('bob');
  await expect(page.getByTestId('contact-row')).toHaveCount(1);
  await expect(page.getByTestId('contacts-list')).toContainText('bob.eth');

  // Open the contact profile (avatar/meta), see address + actions.
  await page.getByTestId('contact-row').first().locator('.meta').click();
  await expect(page.getByTestId('contact-profile')).toBeVisible();
  await expect(page.getByTestId('contact-address')).toBeVisible();

  // Call from the profile → call modal with status; end it.
  await page.getByTestId('profile-call').click();
  const call = page.getByTestId('call-modal');
  await expect(call).toBeVisible();
  await expect(page.getByTestId('call-status')).toContainText(/Calling|call/);
  await page.getByTestId('call-end').click();
  await expect(page.getByTestId('call-modal')).toHaveCount(0);
});

test('contacts: message opens (creates) a 1:1 chat', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.getByTestId('open-contacts').click();

  // Message a contact with no existing chat → a chat opens.
  await page.getByTestId('contacts-search').fill('carol');
  await page.getByTestId('contact-message').first().click();
  await expect(page.getByTestId('messages')).toBeVisible();
  // Send a message in the newly-created chat.
  const input = page.getByPlaceholder('Message');
  await input.fill('hi carol'); await input.press('Enter');
  await expect(page.getByTestId('messages').getByText('hi carol')).toBeVisible();
});
