import { test, expect } from '@playwright/test';

// 1x1 transparent PNG.
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('encrypted media attachment: encrypt → store → decrypt → render in the browser', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await expect(page.getByTestId('messages')).toBeVisible();

  // Attach an image; the engine encrypts it to the store, sends a media frame, and renders the
  // decrypted-back bytes — so a visible <img> proves the full encrypt→store→decrypt path ran.
  await page.getByTestId('file-input').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  });

  const img = page.getByTestId('bubble-image').first();
  await expect(img).toBeVisible({ timeout: 10_000 });
  const src = await img.getAttribute('src');
  expect(src).toMatch(/^blob:/); // rendered from decrypted bytes, not a data/remote URL

  // The simulated peer fetched the CID and decrypted it too.
  await expect(page.getByTestId('messages').getByText(/fetched the CID and decrypted/i)).toBeVisible({
    timeout: 10_000,
  });
  await page.screenshot({ path: 'e2e/media.png', fullPage: false });
});

test('self-destruct: a 5s message disappears from the thread', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  const messages = page.getByTestId('messages');

  // Turn the self-destruct timer to 5s, then send.
  await page.getByTestId('ttl-toggle').click(); // off -> 5s
  const unique = `vanish-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(unique);
  await input.press('Enter');

  await expect(messages.getByText(unique)).toBeVisible();
  // After the ttl elapses, the sweep removes it (poll up to ~9s).
  await expect(messages.getByText(unique)).toHaveCount(0, { timeout: 9_000 });
});
