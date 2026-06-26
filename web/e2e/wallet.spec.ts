import { test, expect } from '@playwright/test';

// Verifies the full wallet login path in the browser: a deterministic test account (injected via
// window.__TB_TEST_PK__) signs the SIWE message, the app verifies it, derives the identity from the
// fixed challenge, and lands in the app. This exercises buildLoginMessage + verifyLogin +
// provisionIdentity with a real secp256k1 signature — no browser extension required.

// anvil account #0 — well-known dev key, address 0xf39F…2266.
const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ADDR = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';

test('wallet (SIWE) login provisions identity and shows the wallet address', async ({ page }) => {
  await page.addInitScript((pk) => {
    (window as unknown as { __TB_TEST_PK__: string }).__TB_TEST_PK__ = pk;
  }, TEST_PK);

  await page.goto('/');

  const connect = page.getByTestId('connect-wallet');
  await expect(connect).toBeEnabled(); // wallet detected via the injected test hook
  await connect.click();

  // Lands in the app (chat shell visible).
  await expect(page.getByTestId('messages')).toBeVisible({ timeout: 10_000 });

  // Profile shows the wallet's address — proving SIWE login used the injected account.
  await page.locator('.rail button[title="Profile"]').click();
  const addr = page.getByTestId('profile-address');
  await expect(addr).toBeVisible();
  expect((await addr.textContent())?.toLowerCase()).toBe(TEST_ADDR);
});

test('without a wallet, connect is disabled and burner login still works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('connect-wallet')).toBeDisabled();
  await page.screenshot({ path: 'e2e/login.png', fullPage: false });
  await page.getByTestId('create-identity').click();
  await expect(page.getByTestId('messages')).toBeVisible({ timeout: 10_000 });
});
