import { test, expect } from '@playwright/test';

// Real local media: a video call acquires a MediaStream (fake device in CI), and mute/camera toggle
// the real tracks.
test('video call captures local media and mute toggles the audio track', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-identity').click();
  await page.getByTestId('open-contacts').click();
  await page.getByTestId('contact-row').first().locator('.meta').click();
  await page.getByTestId('profile-video').click();

  const video = page.getByTestId('call-video');
  await expect(video).toBeVisible();

  // The <video> has a live MediaStream with a video track.
  await expect.poll(async () =>
    video.evaluate((el: HTMLVideoElement) => {
      const s = el.srcObject as MediaStream | null;
      return s instanceof MediaStream ? s.getVideoTracks().length : 0;
    }),
  ).toBeGreaterThan(0);

  await expect(page.getByTestId('call-status')).toContainText(/live/);

  // Mute disables the audio track (track.enabled === false).
  await page.getByTestId('call-mute').click();
  await expect.poll(async () =>
    video.evaluate((el: HTMLVideoElement) => {
      const s = el.srcObject as MediaStream | null;
      return s ? s.getAudioTracks()[0]?.enabled : true;
    }),
  ).toBe(false);

  await page.getByTestId('call-end').click();
  await expect(page.getByTestId('call-modal')).toHaveCount(0);
});
