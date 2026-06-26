import { test, expect } from '@playwright/test';

// Voice message: synthesized clip runs through the encrypted media path and renders a playable
// voice bubble (the <audio> src is a blob URL of the decrypted-back bytes).
test('send a voice message and render a playable bubble', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await expect(page.getByTestId('messages')).toBeVisible();

  // With an empty composer, the send button becomes the mic.
  await page.getByTestId('voice').click();

  const voice = page.getByTestId('voice-message').first();
  await expect(voice).toBeVisible({ timeout: 10_000 });
  const audio = page.getByTestId('voice-audio').first();
  const src = await audio.getAttribute('src');
  expect(src).toMatch(/^blob:/);

  // The audio element actually has loadable media (non-zero duration after metadata loads).
  const ok = await audio.evaluate((el: HTMLAudioElement) =>
    new Promise<boolean>((resolve) => {
      if (el.readyState >= 1) return resolve(el.duration > 0);
      el.onloadedmetadata = () => resolve(el.duration > 0);
      setTimeout(() => resolve(el.readyState >= 1), 3000);
    }),
  );
  expect(ok).toBeTruthy();
});
