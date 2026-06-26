import { test, expect } from '@playwright/test';

// Proves the real @teleblock/shared crypto runs IN THE BROWSER: provision an identity, send a
// message over the live E2EE conversation, receive a decrypted peer reply, and confirm the frame on
// the wire is ciphertext that does NOT contain the plaintext.
test('live end-to-end encrypted chat works in the browser', async ({ page }) => {
  await page.goto('/');

  // Login gate: create a real (burner) identity — exercises SIWE-style key derivation + libsodium.
  await page.getByTestId('create-identity').click();

  // The chat shell appears with the live DM selected by default.
  const messages = page.getByTestId('messages');
  await expect(messages).toBeVisible();

  // Send a message on the live conversation.
  const unique = `ping-${Date.now()}`;
  const input = page.getByPlaceholder('Message');
  await input.fill(unique);
  await input.press('Enter');

  // Our own message renders…
  await expect(messages.getByText(unique)).toBeVisible();

  // …and the simulated peer decrypts it and auto-replies (proves the receive path decrypts).
  await expect(messages.getByText(/decrypted/i)).toBeVisible({ timeout: 10_000 });

  // Open the encryption inspector and assert the on-wire frame is ciphertext, not plaintext.
  await page.getByTestId('toggle-inspector').click();
  const inspector = page.getByTestId('inspector');
  await expect(inspector).toBeVisible();
  const wire = (await inspector.textContent()) ?? '';
  expect(wire).toMatch(/ciphertext/); // label present
  expect(wire).toContain('"ciphertext"'); // the frame JSON has a ciphertext field
  expect(wire).not.toContain(unique); // the plaintext never appears on the wire

  await page.screenshot({ path: 'e2e/screenshot.png', fullPage: false });
});
