import { defineConfig } from '@playwright/test';
import { getBrowserUse } from './playwright.browser.js';

export default defineConfig({
  testDir: './scraping',
  timeout: 3_600_000,
  workers: 1,
  use: {
    ...getBrowserUse(),
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
  },
});
