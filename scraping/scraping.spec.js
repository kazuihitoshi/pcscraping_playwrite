// ファイル名: scraping.spec.js
const NOTEBOOK_URL = 'https://www.dell.com/ja-jp/shop/scc/scr/laptops';
const DESKTOP_URL = 'https://www.dell.com/ja-jp/shop/scc/scr/desktops';
const osSearchTexts = ['linux', 'ubuntu', 'オペレーティングシステムなし'];

import { test, expect } from '@playwright/test';
import { handleInitialPopups, waitUntilReady } from './popup-handler.js';
import { createPclistDb } from './pclist-db.js';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function cleanText(text) {
  return (text ?? '')
    .replace(/[、,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ul/li などリスト構造から仕様テキストを整形して取得（1つの文字列） */
async function extractNoteText(noteLoc) {
  return noteLoc.evaluate((root) => {
    const clean = (text) => (text ?? '')
      .replace(/[、,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const lis = Array.from(root.querySelectorAll('li'));
    if (lis.length > 0) {
      const items = lis
        .map((li) => {
          const label = li.querySelector('.label, dt, th, [class*="label"]');
          const value = li.querySelector('.value, dd, td, [class*="value"]');
          if (label && value) {
            return `${clean(label.textContent)} ${clean(value.textContent)}`;
          }
          return clean(li.innerText || li.textContent);
        })
        .filter(Boolean);
      return items.length > 0 ? items.join(' ') : null;
    }
    const text = clean(root.innerText || root.textContent);
    return text || null;
  });
}

export async function getProductInfo (scope, nameSelector, modelSelector, priceSelector, noteSelector, imgSelector){
  if (scope.isClosed?.()) return emptyProductInfo();
  if (nameSelector === undefined) nameSelector = 'h1 .page-title';
  if (modelSelector === undefined) modelSelector = 'div.model-id';
  if (priceSelector === undefined) priceSelector = '.sale-price';
  if (noteSelector === undefined) noteSelector = '.card-specs .list-unstyled';
  if (imgSelector === undefined) imgSelector = "img[data-testid='sharedPolarisHeroPdImage']";
  const elementTimeout = 15_000;
  var name = null, model = null, price = null, img = null;
  const imgLoc = scope.locator(imgSelector).first();
  const nameLoc = scope.locator(nameSelector).first();
  if (await nameLoc.count() > 0) {
    await nameLoc.waitFor({ state: 'visible', timeout: elementTimeout }).catch(() => {});
    if (await nameLoc.isVisible().catch(() => false)) {
      name = await nameLoc.textContent();
    }
  }
  const modelLoc = scope.locator(modelSelector).first();
  if (await modelLoc.count() > 0) {
    await modelLoc.waitFor({ state: 'visible', timeout: elementTimeout }).catch(() => {});
    if (await modelLoc.isVisible().catch(() => false)) {
      model = await modelLoc.textContent();
    }
  }
  var priceLoc = scope.locator(priceSelector).first();
  if (await priceLoc.count() > 0) {
    await priceLoc.waitFor({ state: 'visible', timeout: elementTimeout }).catch(() => {});
    if (await priceLoc.isVisible().catch(() => false)) {
      price = await priceLoc.textContent();
    }
  }
  const noteLoc = scope.locator(noteSelector).first();
  let note = null;
  if (await noteLoc.count() > 0) {
    await noteLoc.waitFor({ state: 'visible', timeout: elementTimeout }).catch(() => {});
    if (await noteLoc.isVisible().catch(() => false)) {
      note = await extractNoteText(noteLoc);
    }
  }
  if (await imgLoc.count() > 0) {
    await imgLoc.waitFor({ state: 'visible', timeout: elementTimeout }).catch(() => {});
    if (await imgLoc.isVisible().catch(() => false)) {
      img = await imgLoc.getAttribute('src');
    }
  }
  if(price)price = price.replace(/,|円/g, '');
  return { name, model, note, price, img };
};

function urlsMatch(a, b) {
  if (!a || !b) return false;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
}

function normalizePageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}

function emptyProductInfo() {
  return { name: null, model: null, note: null, price: null, img: null };
}

function isListPageUrl(url) {
  try {
    return /\/shop\/scc\/scr\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function isProductDetailUrl(url) {
  if (!url || isListPageUrl(url)) return false;
  try {
    return /\/spd\//.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

function hasProductData(productInfo) {
  if (!productInfo) return false;
  const name = (productInfo.name ?? '').trim();
  const price = (productInfo.price ?? '').trim();
  const note = (productInfo.note ?? '').trim();
  return Boolean(name || price || note);
}

function saveCollectedData(db, reason) {
  try {
    const n = db.count();
    if (n > 0) {
      console.log(`${reason} — 収集済み ${n} 件を保存します`);
      db.finalize();
    } else {
      db.discard();
    }
  } catch (e) {
    console.log('DB 保存失敗:', e.message);
    db.discard();
  }
}

export async function goBack(page, url) {
  if (url && urlsMatch(page.url(), url)) return;

  try {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    await waitUntilReady(page);
  } catch (e) {
    console.log('戻る失敗:', e.message);
  }

  if (!url) return;
  if (urlsMatch(page.url(), url)) return;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitUntilReady(page);
  } catch (e) {
    if (urlsMatch(page.url(), url) || e.message?.includes('interrupted')) {
      await waitUntilReady(page);
      return;
    }
    console.log('goto失敗:', e.message);
  }

  if (!urlsMatch(page.url(), url)) {
    console.log('戻る後も URL が一致しません:', page.url(), '期待:', url);
  }
}

export async function checkSearchTexts(scope, itemSelector, priceSelector, searchTexts) {
  if (itemSelector === undefined) itemSelector = '.ux-cell-text';
  if (priceSelector === undefined) priceSelector = '.ux-cell-delta-price';
  if (searchTexts === undefined) searchTexts = osSearchTexts;

  return scope.evaluate(
    ({ itemSelector, priceSelector, searchTexts }) => {
      const needles = searchTexts.map((t) => t.toLowerCase());
      for (const itemEl of document.querySelectorAll(itemSelector)) {
        const text = (itemEl.textContent ?? '').trim();
        const lower = text.toLowerCase();
        if (!needles.some((n) => lower.includes(n))) continue;
        const container = itemEl.parentElement ?? itemEl;
        const priceEl = container.querySelector(priceSelector);
        const rawPrice = (priceEl?.textContent ?? '').trim();
        return {
          linuxtext: text,
          linuxprice: rawPrice.replace(/[^\d-]/g, ''),
        };
      }
      return { linuxtext: null, linuxprice: null };
    },
    { itemSelector, priceSelector, searchTexts }
  );
}

function saveProduct(db, url, productInfo, linux) {
  if (isListPageUrl(url)) {
    console.log('一覧ページのため保存スキップ:', url);
    return false;
  }
  if (!hasProductData(productInfo)) {
    console.log('商品情報なしのため保存スキップ:', url);
    return false;
  }
  return db.insert({
    url,
    imgurl: productInfo?.img ?? null,
    name: productInfo?.name ?? null,
    model: productInfo?.model ?? null,
    note: productInfo?.note ?? null,
    price: productInfo?.price ?? null,
    linuxtext: linux?.linuxtext ?? null,
    linuxprice: linux?.linuxprice ?? linux?.price ?? null,
  });
}

function resolveHref(page, href) {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return `https:${href}`;
  return new URL(href, page.url()).href;
}

/** 一覧の商品カードのみ取得（おすすめ製品カルーセル内の article を除外） */
function getProductArticles(page) {
  return page.locator('#sr-product-stacks article').filter({
    has: page.locator('a.variant-customize-button, a:has-text("オプションを見る")'),
  });
}

/** 商品詳細へ進むリンク（旧 UI / 新 UI 両対応） */
function getProductDetailLink(article) {
  return article.locator('a.variant-customize-button, a:has-text("オプションを見る")').first();
}

function getListPagination(page) {
  return page.locator('#scr-pagination-content, #sr-dds-pagination').first();
}

async function getNextPageButton(page) {
  return getListPagination(page).locator(
    'button[aria-label="Next page"], button.dds__pagination__next-page',
  ).first();
}

async function hasListPageChanged(page, { urlBefore, pageBefore, articleTextBefore }) {
  if (!urlsMatch(page.url(), urlBefore)) return true;

  const pageInput = getListPagination(page).locator('input[aria-label="ページ"]');
  if (pageBefore && (await pageInput.count()) > 0) {
    const pageAfter = await pageInput.inputValue();
    if (pageAfter !== pageBefore) return true;
  }

  const articleTextAfter = await page.locator('#sr-product-stacks article').first().textContent().catch(() => null);
  if (articleTextBefore && articleTextAfter && articleTextBefore !== articleTextAfter) return true;

  return false;
}

async function goNextListPage(page) {
  if (page.isClosed()) return false;

  const nextpage = await getNextPageButton(page);
  if (await nextpage.count() === 0) {
    console.log('次へボタンなし。一覧走査を終了します。');
    return false;
  }

  await nextpage.scrollIntoViewIfNeeded();

  const ariaDisabled = await nextpage.getAttribute('aria-disabled');
  if (await nextpage.isDisabled() || ariaDisabled === 'true') {
    console.log('最終ページです。一覧走査を終了します。');
    return false;
  }

  const pageInput = getListPagination(page).locator('input[aria-label="ページ"]');
  const pageBefore = (await pageInput.count()) > 0 ? await pageInput.inputValue() : null;
  const urlBefore = page.url();
  const articleTextBefore = await page.locator('#sr-product-stacks article').first().textContent().catch(() => null);

  await handleInitialPopups(page);
  await waitUntilReady(page);
  await nextpage.click({ force: true });
  await waitUntilReady(page);

  for (let attempt = 0; attempt < 200; attempt++) {
    if (await hasListPageChanged(page, { urlBefore, pageBefore, articleTextBefore })) {
      return true;
    }
    console.log('次ページリトライします...');
    await sleep(5000);
  }

  console.log('次ページへ進めなかったため一覧走査を終了します。');
  return false;
}

async function clickLink(page, locator, hrefOverride) {
  await waitUntilReady(page);
  const href = hrefOverride ?? await locator.getAttribute('href').catch(() => null);

  try {
    await locator.scrollIntoViewIfNeeded({ timeout: 10000 });
    await locator.click({ force: true, timeout: 15000 });
  } catch (e) {
    try {
      await locator.evaluate((el) => el.click());
    } catch (e2) {
      const url = resolveHref(page, href);
      if (!url) throw e;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    }
  }
  await waitUntilReady(page);
}

function getCardDeckItems(page) {
  return page.locator('.card-deck-item');
}

/** 一覧ページのページネーションと区別して構成カードの次へボタンを取得 */
async function getCardDeckNextButton(page) {
  if (await getCardDeckItems(page).count() === 0) return null;

  const buttons = page.locator('button[aria-label="Next page"]');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const isListPagination = await btn
      .evaluate((el) => Boolean(el.closest('#scr-pagination-content, #sr-dds-pagination')))
      .catch(() => true);
    if (isListPagination) continue;
    if (await btn.isVisible().catch(() => false)) return btn;
  }
  return null;
}

async function getCardDeckSignature(page) {
  const cards = getCardDeckItems(page);
  const count = await cards.count();
  const parts = [];
  for (let i = 0; i < count; i++) {
    parts.push(await cards.nth(i).innerText().catch(() => ''));
  }
  return parts.join('\n---\n');
}

async function getCardDeckItemInfo(card) {
  let price = null;
  let note = null;
  const priceLoc = card.locator('.sale-price').first();
  const noteLoc = card.locator('.card-specs .list-unstyled, .card-specs').first();

  if (await priceLoc.count() > 0) {
    price = (await priceLoc.textContent())?.replace(/,|円/g, '').trim() || null;
  }
  if (await noteLoc.count() > 0) {
    note = await extractNoteText(noteLoc);
  }
  return { price, note };
}

async function goNextCardDeckPage(page) {
  const nextBtn = await getCardDeckNextButton(page);
  if (!nextBtn) return false;

  await nextBtn.scrollIntoViewIfNeeded();
  const ariaDisabled = await nextBtn.getAttribute('aria-disabled');
  if (await nextBtn.isDisabled() || ariaDisabled === 'true') return false;

  const signatureBefore = await getCardDeckSignature(page);
  await handleInitialPopups(page);
  await nextBtn.click({ force: true });
  // ページリロードは起こらないが、DOM 差し替えの完了を少し待つ
  await sleep(400);

  const signatureAfter = await getCardDeckSignature(page);
  if (signatureBefore === signatureAfter) {
    console.log('構成カードの次ページへ進めませんでした。');
    return false;
  }
  return true;
}

/**
 * カスタマイズページ等の .card-deck-item をページングしながら収集する。
 * @returns {Promise<boolean>} 構成カードを 1 件以上処理したら true
 */
async function scrapeCardDeckPages(page, db, baseProductInfo) {
  if (await getCardDeckItems(page).count() === 0) return false;

  const maxDeckPages = 50;
  let deckPageNum = 1;
  while (deckPageNum <= maxDeckPages) {
    await handleInitialPopups(page);
    await waitUntilReady(page);

    const cards = getCardDeckItems(page);
    const count = await cards.count();
    console.log(`構成カード ${count} 件（デッキページ ${deckPageNum}）: ${page.url()}`);

    const pageInfo = baseProductInfo ?? await getProductInfo(page);
    const linux = await checkSearchTexts(page);

    for (let i = 0; i < count; i++) {
      const cardInfo = await getCardDeckItemInfo(cards.nth(i));
      const productInfo = {
        name: pageInfo?.name ?? null,
        model: pageInfo?.model ?? null,
        note: cardInfo.note ?? pageInfo?.note ?? null,
        price: cardInfo.price ?? pageInfo?.price ?? null,
        img: pageInfo?.img ?? null,
      };
      console.log(`  [card ${i + 1}]`, productInfo, linux);
      saveProduct(db, page.url(), productInfo, linux);
    }

    if (!(await goNextCardDeckPage(page))) break;
    deckPageNum++;
  }

  return true;
}

async function clickCustomizeButton(page) {
  const btn = page
    .locator('span.btn.btn-outline-primary, a.btn, button')
    .filter({ hasText: '今すぐカスタマイズ' })
    .first();
  if (await btn.count() === 0) return false;

  await handleInitialPopups(page);
  await waitUntilReady(page);
  await btn.scrollIntoViewIfNeeded();
  try {
    await btn.click({ force: true, timeout: 30_000 });
  } catch (e) {
    console.log('今すぐカスタマイズ クリック失敗、再試行:', e.message);
    await btn.evaluate((el) => el.click());
  }
  await waitUntilReady(page);
  await page
    .locator('.card-deck-item, .ux-cell-text, .ux-cell-title, h1 .page-title, h1.cf-pg-title')
    .first()
    .waitFor({ state: 'attached', timeout: 30_000 })
    .catch(() => {});
  return true;
}

async function scrapeCustomizeView(page, db, baseProductInfo) {
  await handleInitialPopups(page);
  await waitUntilReady(page);

  try {
    if (await scrapeCardDeckPages(page, db, baseProductInfo)) return;
  } catch (e) {
    console.log('構成カード収集エラー:', e.message);
  }

  try {
    const productInfo = baseProductInfo ?? await getProductInfo(page);
    const linux = await checkSearchTexts(page);
    console.log(page.url(), productInfo, linux);
    saveProduct(db, page.url(), productInfo, linux);
  } catch (e) {
    console.log('カスタマイズページ収集エラー:', e.message);
    if (baseProductInfo) {
      saveProduct(db, page.url(), baseProductInfo, { linuxtext: null, linuxprice: null });
    } else {
      throw e;
    }
  }
}

export async function getDellScraping(page, url, db, pctyp) {
  db.setPctyp(pctyp);
  console.log(`スクレイピング開始 [${pctyp}]: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await handleInitialPopups(page);
  console.log('本来のスクレイピング処理を開始します。');

  async function getItems(page) {
    const items = getProductArticles(page);
    try {
      await items.first().waitFor({ state: 'visible', timeout: 30000 });
      const count = await items.count();
      console.log(`商品 ${count} 件を検出しました (${page.url()})`);
      return { items, count };
    } catch (e) {
      console.log('商品が見つからない、または読み込みがタイムアウトしました。');
      return { items, count: 0 };
    }
  }

  let productInfo = null;
  let linux = null;
  const visitedProducts = new Set();
  const visitedScrapeUrls = new Set();
  while (true) {
    if (page.isClosed()) break;
    let { items, count } = await getItems(page);
    const currenturl = page.url();

    for (let i = 0; i < count; i++) {
      if (page.isClosed()) break;
      const custompage = getProductDetailLink(items.nth(i));
      if (await custompage.count() > 0) {
        const customHref = await custompage.getAttribute('href').catch(() => null);
        const detailKey = resolveHref(page, customHref) ?? customHref;
        if (detailKey && visitedProducts.has(detailKey)) {
          console.log(`スキップ（既に処理済み）: ${detailKey}`);
          continue;
        }
        await handleInitialPopups(page);
        await clickLink(page, custompage, customHref);
        await handleInitialPopups(page);
        await waitUntilReady(page);

        if (!isProductDetailUrl(page.url())) {
          console.log(`商品詳細へ遷移できませんでした (${i + 1}/${count}):`, page.url());
          if (!urlsMatch(page.url(), currenturl)) {
            await goBack(page, currenturl);
          }
          continue;
        }
        if (detailKey) visitedProducts.add(detailKey);

        let basicOptions = page.locator('a.base-config-option');
        let nowcustomize = page.locator(
          'span.btn.btn-outline-primary',
          { hasText: '今すぐカスタマイズ' },
        );
        let basicurl = page.url();

        if (await basicOptions.count() > 0 || await nowcustomize.count() > 0) {
          let jMax = 0;
          if (await basicOptions.count() > 0) {
            jMax = await basicOptions.count();
          }
          if (jMax == 0 && await nowcustomize.count() > 0) {
            jMax = 1;
          }
          for (let j = 0; j < jMax; j++) {
            if (await basicOptions.count() > 0 &&
              await basicOptions.nth(j).getAttribute('aria-current') != 'true') {
              await handleInitialPopups(page);
              basicurl = page.url();
              await clickLink(page, basicOptions.nth(j));
            }
            productInfo = await getProductInfo(page);
            if (page.isClosed()) break;
            nowcustomize = page.locator(
              'span.btn.btn-outline-primary',
              { hasText: '今すぐカスタマイズ' },
            );

            let customizeurl = null;
            const scrapeUrl = normalizePageUrl(page.url());
            if (scrapeUrl && visitedScrapeUrls.has(scrapeUrl)) {
              console.log(`スキップ（このページは収集済み）: ${scrapeUrl}`);
            } else if (await nowcustomize.count() > 0) {
              customizeurl = page.url();
              await clickCustomizeButton(page);
              await scrapeCustomizeView(page, db, productInfo);
              if (scrapeUrl) visitedScrapeUrls.add(scrapeUrl);
            } else if (await getCardDeckItems(page).count() > 0) {
              await scrapeCardDeckPages(page, db, productInfo);
              if (scrapeUrl) visitedScrapeUrls.add(scrapeUrl);
            } else {
              linux = await checkSearchTexts(page);
              console.log(page.url(), productInfo, linux);
              saveProduct(db, page.url(), productInfo, linux);
              if (scrapeUrl) visitedScrapeUrls.add(scrapeUrl);
            }
            if (customizeurl && page.url() != customizeurl) {
              await goBack(page, customizeurl);
            }
            if (basicurl && page.url() != basicurl) {
              await goBack(page, basicurl);
            }
            basicOptions = page.locator('a.base-config-option');
          }
        } else {
          productInfo = await getProductInfo(page,
            'h1.cf-pg-title span',
            '.cf-model-title',
            'div.cf-dell-price > div.cf-price', 'div.cf-hero-bts',
            "img[data-testid='sharedPolarisHeroPdImage']",
          );
          linux = await checkSearchTexts(page, '.ux-cell-title', '.ux-cell-delta-price');
          console.log(page.url(), productInfo, linux);
          saveProduct(db, page.url(), productInfo, linux);
        }
        await sleep(300);
        await handleInitialPopups(page);
        await goBack(page, currenturl);
        await waitUntilReady(page);
        await handleInitialPopups(page);
        if (!urlsMatch(page.url(), currenturl)) {
          console.log('一覧へ戻れなかったため goto で復帰します:', currenturl);
          await page.goto(currenturl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
          await waitUntilReady(page);
        }
        if (!isListPageUrl(page.url())) {
          console.log('一覧ページに戻れていないため goto を再試行します:', currenturl);
          await page.goto(currenturl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
          await waitUntilReady(page);
        }
        ({ items, count } = await getItems(page));
      }
    }

    if (!(await goNextListPage(page))) break;
  }

  console.log(`スクレイピング完了 [${pctyp}]`);
}

let scrapeDb = null;

test.afterEach(async () => {
  if (!scrapeDb) return;
  saveCollectedData(scrapeDb, 'テスト終了（未保存データあり）');
  scrapeDb = null;
});

test('Dell Scraping', async ({ page }) => {
  test.setTimeout(0);
  scrapeDb = createPclistDb({ finalDbName: 'pclist.db' });
  const db = scrapeDb;
  const popupWatcher = setInterval(async () => {
    if (page.isClosed()) return;
    await handleInitialPopups(page).catch(() => {});
  }, 30_000);

  try {
    await getDellScraping(page, NOTEBOOK_URL, db, 'notepc');
    await getDellScraping(page, DESKTOP_URL, db, 'pc');
    db.finalize();
    scrapeDb = null;
  } catch (e) {
    saveCollectedData(db, `エラー中断 (${e.message})`);
    scrapeDb = null;
    throw e;
  } finally {
    clearInterval(popupWatcher);
  }
});
