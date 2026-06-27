import { test, expect } from '@playwright/test';

// Features synthesized from Status/Session/EXTRA SAFE/Mixin/ChatLink.
test('Mixin-style: send an in-chat crypto payment', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await expect(page.getByTestId('messages')).toBeVisible();

  await page.getByTestId('pay-btn').click();
  await page.getByTestId('pay-asset').selectOption('USDC');
  await page.getByTestId('pay-amount').fill('12.5');
  await page.getByTestId('pay-memo').fill('lunch');
  await page.getByTestId('pay-send').click();

  const pay = page.getByTestId('payment-bubble').last();
  await expect(pay).toBeVisible();
  await expect(pay).toContainText('12.5 USDC');
  await expect(pay).toContainText('zero-fee');
});

test('ChatLink-style: save a message on-chain (tamper-proof proof)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');
  const text = `terms-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(text); await input.press('Enter');

  await messages.getByText(text).click({ button: 'right' });
  await page.getByTestId('context-menu').getByTestId('menu-item').filter({ hasText: 'Save on-chain' }).click();
  await expect(page.getByTestId('crosspost-banner')).toContainText(/Anchored tamper-proof/);
});

test('EXTRA SAFE-style: verify a contact safety number', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.getByTestId('open-contacts').click();
  await page.getByTestId('contact-row').first().locator('.meta').click();

  await page.getByTestId('verify-safety').click();
  const num = page.getByTestId('safety-number');
  await expect(num).toBeVisible();
  await expect(num).toHaveText(/(\d{5}\s){11}\d{5}/);
  await page.getByTestId('mark-verified').click();
  await expect(page.getByTestId('contact-profile')).toContainText('verified');
});

test('Status-style: claim a username', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button[title="Profile"]').click();

  await page.getByTestId('username-input').fill('satoshi');
  await page.getByTestId('claim-username').click();
  await expect(page.getByTestId('username')).toHaveText('@satoshi');
});

test('Session-style: metadata-min mode shows a Session ID and hides the address', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.locator('.rail button[title="Profile"]').click();

  // Default: wallet address shown.
  await expect(page.getByTestId('profile-address')).not.toHaveText(/^05[0-9a-f]/);
  // Enable metadata-min → a 66-char "05…" Session ID replaces the address.
  await page.getByTestId('toggle-stealth').click();
  await expect(page.getByTestId('profile-address')).toHaveText(/^05[0-9a-f]{64}$/);
});

test('Wispr VOBP: the call screen shows a per-call ephemeral key', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.getByTestId('open-contacts').click();
  await page.getByTestId('contact-row').first().locator('.meta').click();
  await page.getByTestId('profile-call').click();

  await expect(page.getByTestId('vobp-key')).toContainText(/VOBP key/);
  await expect(page.getByTestId('vobp-key')).toContainText(/destroyed on end/);
});
