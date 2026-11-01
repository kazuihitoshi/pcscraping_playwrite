import { defineConfig } from '@playwright/test';
import { getBrowserUse, getOutputDir } from './playwright.browser.js';

export default defineConfig({
  testDir: './scraping',
  timeout: 7_200_000,
  workers: 1,
  outputDir: getOutputDir(),
  use: {
    ...getBrowserUse(),
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
  },
});
