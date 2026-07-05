import { defineConfig, devices } from '@playwright/test';
import { getBrowserUse } from './playwright.browser.js';

export default defineConfig({
  testDir: './scraping',
  timeout: 7_200_000,
  workers: 1,
  use: {
    ...getBrowserUse({ useChromeChannel: false }),
    ...devices['Desktop Chrome'],
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },
  },
});
