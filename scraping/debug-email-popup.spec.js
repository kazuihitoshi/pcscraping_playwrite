import { test } from '@playwright/test';
import { handleInitialPopups, debugEmailPopup } from './popup-handler.js';

const targeturl = 'https://www.dell.com/ja-jp/shop/scc/scr/laptops';

test('debug email popup', async ({ page }) => {
  await page.goto(targeturl, { waitUntil: 'domcontentloaded' });

  // cookie 同意
  const cookieBtn = page.locator('#onetrust-accept-btn-handler');
  if (await cookieBtn.count() > 0) {
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  console.log('=== before close ===');
  console.log(JSON.stringify(await debugEmailPopup(page), null, 2));

  await handleInitialPopups(page);

  console.log('=== after handleInitialPopups ===');
  console.log(JSON.stringify(await debugEmailPopup(page), null, 2));

  await page.screenshot({ path: 'test-results/debug-email-popup.png', fullPage: false });
});
