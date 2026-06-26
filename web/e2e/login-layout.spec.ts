import { test, expect } from '@playwright/test';

test('login: Create account is primary, Connect wallet secondary', async ({ page }) => {
  await page.goto('/');

  const create = page.getByTestId('create-identity');
  const connect = page.getByTestId('connect-wallet');
  await expect(create).toHaveText(/Create account/);
  await expect(connect).toHaveText(/Connect wallet/);

  // Create account is above Connect wallet in the DOM/visual order.
  const createBox = await create.boundingBox();
  const connectBox = await connect.boundingBox();
  expect(createBox!.y).toBeLessThan(connectBox!.y);

  // No wallet in headless → connect is disabled with a hint; create still works.
  await expect(connect).toBeDisabled();
  await expect(page.getByTestId('no-wallet-hint')).toBeVisible();

  await page.screenshot({ path: 'e2e/login2.png' });

  await create.click();
  await expect(page.getByTestId('messages')).toBeVisible({ timeout: 10_000 });
});
