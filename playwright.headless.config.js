import { defineConfig } from '@playwright/test';
import { getBrowserUse } from './playwright.browser.js';

export default defineConfig({
  testDir: './scraping',
  timeout: 7_200_000,
  workers: 1,
  use: {
    // 表示ありと同じく実 Google Chrome を使う。
    // Playwright 同梱 Chromium だと Dell の次ページクリックが無視される。
    ...getBrowserUse({ useChromeChannel: true }),
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    launchOptions: {
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    },
  },
});
