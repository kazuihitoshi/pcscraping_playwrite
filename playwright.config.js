import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scraping',
  timeout: 600_000,
  workers: 1,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
  },
});
