import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use the sandbox's pre-installed Chromium when present; otherwise fall back to Playwright's
// managed browser (e.g. in CI, installed via `npx playwright install --with-deps chromium`).
const PINNED_CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// Fake camera/mic so WebRTC getUserMedia works (and is auto-granted) in headless CI.
const mediaArgs = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'];
const launchOptions = existsSync(PINNED_CHROMIUM)
  ? { executablePath: PINNED_CHROMIUM, args: mediaArgs }
  : { args: mediaArgs };

// E2E config. Builds + serves the production bundle, then drives Chromium.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
