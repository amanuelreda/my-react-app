import { test, expect } from '@playwright/test';

// With a connected wallet and a real recipient address, an in-chat payment settles on-chain (native
// ETH value transfer) and the bubble shows the transaction hash. The viem-backed test provider
// (window.__TB_TEST_PK__) returns a well-formed hash so the full submit path runs without a chain.
const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const RECIPIENT = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // anvil account #1

test('Mixin-style payment settles on-chain and shows a tx hash', async ({ page }) => {
  await page.addInitScript((pk) => {
    (window as unknown as { __TB_TEST_PK__: string }).__TB_TEST_PK__ = pk;
  }, TEST_PK);

  await page.goto('/');
  await page.getByTestId('connect-wallet').click();
  await expect(page.getByTestId('messages')).toBeVisible({ timeout: 10_000 });

  // Add a contact by its real wallet address, then open a 1:1 chat with it.
  await page.getByTestId('open-contacts').click();
  await page.getByTestId('add-contact-input').fill(RECIPIENT);
  await page.getByTestId('add-contact-btn').click();
  await page.getByTestId('contact-row').first().getByTestId('contact-message').click();
  await expect(page.getByTestId('messages')).toBeVisible();

  // Send native ETH in chat.
  await page.getByTestId('pay-btn').click();
  await page.getByTestId('pay-asset').selectOption('ETH');
  await page.getByTestId('pay-amount').fill('0.01');
  await page.getByTestId('pay-send').click();

  const pay = page.getByTestId('payment-bubble').last();
  await expect(pay).toContainText('0.01 ETH');
  // The on-chain tx hash link appears once submitted.
  await expect(pay.getByTestId('payment-tx')).toBeVisible({ timeout: 10_000 });
  await expect(pay.getByTestId('payment-tx')).toContainText('0x');
});

test('demo payment (no wallet) stays local — no tx hash', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await expect(page.getByTestId('messages')).toBeVisible();

  await page.getByTestId('pay-btn').click();
  await page.getByTestId('pay-amount').fill('5');
  await page.getByTestId('pay-send').click();

  const pay = page.getByTestId('payment-bubble').last();
  await expect(pay).toBeVisible();
  await expect(pay.getByTestId('payment-tx')).toHaveCount(0);
});
