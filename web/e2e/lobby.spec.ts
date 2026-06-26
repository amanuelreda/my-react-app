import { test, expect } from '@playwright/test';

// Real multi-user E2EE: two windows (same browser context → shared BroadcastChannel) discover each
// other, perform an X3DH handshake, and exchange an encrypted message that decrypts on the other side.
test('two tabs connect and message end-to-end', async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();

  for (const p of [a, b]) {
    await p.goto('/');
    await p.getByTestId('create-identity').click();
  }

  // Open the Lobby chat in both.
  const openLobby = async (p: typeof a) => {
    await p.locator('.rail button', { hasText: '💬' }).click();
    await p.locator('.row', { hasText: 'Lobby' }).click();
  };
  await openLobby(a);
  await openLobby(b);

  // Both report a live peer connection.
  await expect(a.getByTestId('lobby-status')).toContainText(/Connected to/, { timeout: 15_000 });
  await expect(b.getByTestId('lobby-status')).toContainText(/Connected to/, { timeout: 15_000 });

  // A message sent from tab A decrypts and renders in tab B.
  const msg = `cross-tab-${Date.now()}`;
  const input = a.getByPlaceholder('Message');
  await input.fill(msg);
  await input.press('Enter');

  await expect(b.getByTestId('messages').getByText(msg)).toBeVisible({ timeout: 15_000 });

  // And the reverse direction.
  const reply = `reply-${Date.now()}`;
  await b.getByPlaceholder('Message').fill(reply);
  await b.getByPlaceholder('Message').press('Enter');
  await expect(a.getByTestId('messages').getByText(reply)).toBeVisible({ timeout: 15_000 });
});
