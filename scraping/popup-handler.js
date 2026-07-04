// ファイル名: popup-handler.js

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * ページの初期表示時に割り込んでくるポップアップや同意ボタンを処理する関数
 * @param {import('@playwright/test').Page} page - Playwrightのpageオブジェクト
 */
let handleInitialPopupsRunning = false;

async function dismissEmailCapture(page) {
  const emailContainer = page.locator('#email-capture-container');
  const closeSelectors = [
    '#email-capture-container button[aria-label="close"]',
    '#email-capture-container button[aria-label="Close"]',
    '#email-capture-container button.close',
    '#email-capture-container [aria-label="閉じる"]',
    '#email-capture-container button[aria-label="close"] svg',
    '#email-capture-container button[aria-label="close"] use',
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    const visible = await emailContainer.isVisible().catch(() => false);
    if (!visible) return true;

    if (attempt === 0) {
      await sleep(1500);
      if (!(await emailContainer.isVisible().catch(() => false))) return true;
    }

    console.log(`メールポップアップ検出 (attempt ${attempt + 1})`);
    const usedSelector = await clickCloseButton(page, closeSelectors);
    if (usedSelector) {
      const closed = await emailContainer
        .waitFor({ state: 'hidden', timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      if (closed) {
        console.log(`✓ メール登録ポップアップを閉じました (${usedSelector})`);
        return true;
      }
      console.log(`メールポップアップ: クリック後も表示中 (${usedSelector})`);
    }

    await page.keyboard.press('Escape');
    await sleep(500);
    if (!(await emailContainer.isVisible().catch(() => false))) {
      console.log('✓ メール登録ポップアップを閉じました (Escape)');
      return true;
    }

    const removed = await page.evaluate(() => {
      const el = document.getElementById('email-capture-container');
      if (!el) return true;
      const btn = el.querySelector('button[aria-label="close"], button[aria-label="Close"]');
      btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      if (el.offsetParent !== null && getComputedStyle(el).display !== 'none') {
        el.remove();
      }
      return !document.getElementById('email-capture-container');
    });
    if (removed) {
      console.log('✓ メール登録ポップアップを閉じました (DOM remove)');
      return true;
    }

    await sleep(1000);
  }

  return !(await emailContainer.isVisible().catch(() => false));
}

export async function waitUntilReady(page) {
  const loading = page.locator('#loading-symbol');
  if (await loading.isVisible().catch(() => false)) {
    await loading.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  }
  await page.waitForLoadState('domcontentloaded').catch(() => {});
}

async function clickCloseButton(page, selectors) {
  for (const selector of selectors) {
    const btn = page.locator(selector).first();
    if ((await btn.count()) === 0) continue;
    if (!(await btn.isVisible().catch(() => false))) continue;

    for (const mode of ['normal', 'force', 'evaluate']) {
      try {
        if (mode === 'normal') {
          await btn.click({ timeout: 5000 });
        } else if (mode === 'force') {
          await btn.click({ force: true, timeout: 5000 });
        } else {
          await btn.evaluate((el) => el.click());
        }
        return selector;
      } catch {
        // 次のクリック方法を試す
      }
    }
  }
  return null;
}

export async function handleInitialPopups(page) {
  if (handleInitialPopupsRunning) return;
  handleInitialPopupsRunning = true;

  try {
    console.log('ポップアップのチェックを開始します...');

    // 1. クッキー同意ボタン（すべて同意）
    try {
      const cookieBtn = page.locator('#onetrust-accept-btn-handler');
      if (await cookieBtn.count() > 0) {
        await cookieBtn.click({ force: true });
        console.log('✓ クッキー同意ボタンをクリックしました。');
        await sleep(1500);
      }
    } catch (e) {
      console.log('クッキー同意失敗:', e.message);
    }

    // 2. 「今すぐ登録」のメールキャプチャを閉じる
    await dismissEmailCapture(page);

    // 3. アンケート「実行しない」
    try {
      const skipSurveyBtn = page.locator('.QSIWebResponsive-creative-container-fade button', {
        hasText: '実行しない',
      });
      if (await skipSurveyBtn.count() > 0) {
        await skipSurveyBtn.click({ force: true });
        console.log('✓ アンケートを「実行しない」で閉じました。');
      }
    } catch (e) {
      console.log('アンケート close 失敗:', e.message);
    }
  } finally {
    handleInitialPopupsRunning = false;
  }
}

export async function debugEmailPopup(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#email-capture-container');
    const buttons = Array.from(document.querySelectorAll('#email-capture-container button')).map((b) => ({
      ariaLabel: b.getAttribute('aria-label'),
      className: b.className,
      text: b.textContent?.trim(),
      visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length),
    }));
    return {
      containerExists: !!container,
      containerVisible: container
        ? !!(container.offsetWidth || container.offsetHeight || container.getClientRects().length)
        : false,
      containerDisplay: container ? getComputedStyle(container).display : null,
      buttons,
    };
  });
}
