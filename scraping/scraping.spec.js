// ファイル名: dell-test.spec.js
const targeturl = 'https://www.dell.com/ja-jp/shop/scc/scr/laptops';
const osSearchTexts = ['linux', 'ubuntu','オペレーティングシステムなし'];

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
  if (nameSelector === undefined) nameSelector = 'h1 .page-title';
  if (modelSelector === undefined) modelSelector = 'div.model-id';
  if (priceSelector === undefined) priceSelector = '.sale-price';
  if (noteSelector === undefined) noteSelector = '.card-specs .list-unstyled';
  if (imgSelector === undefined) imgSelector = "img[data-testid='sharedPolarisHeroPdImage']";
  var name = null, model = null, price = null, img = null;
  const imgLoc = scope.locator(imgSelector).first();
  const nameLoc = scope.locator(nameSelector).first();
  if (await nameLoc.count() > 0) {
    await nameLoc.waitFor({ state: 'visible', timeout: 40000 });
    name = await nameLoc.textContent();
  }
  const modelLoc = scope.locator(modelSelector).first();
  if (await modelLoc.count() > 0) {
    await modelLoc.waitFor({ state: 'visible', timeout: 40000 });
    model = await modelLoc.textContent();
  }
  var priceLoc = scope.locator(priceSelector).first();
  if (await priceLoc.count() > 0) {
    await priceLoc.waitFor({ state: 'visible', timeout: 40000 });
    price = await priceLoc.textContent();
  }
  const noteLoc = scope.locator(noteSelector).first();
  let note = null;
  if (await noteLoc.count() > 0) {
    await noteLoc.waitFor({ state: 'visible', timeout: 40000 });
    note = await extractNoteText(noteLoc);
  }
  if (await imgLoc.count() > 0) {
    await imgLoc.waitFor({ state: 'visible', timeout: 40000 });
    img = await imgLoc.getAttribute('src');
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

export async function goBack(page, url) {
  if (url && urlsMatch(page.url(), url)) return;

  try {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (e) {
    console.log('戻る失敗:', e.message);
  }

  if (!url) return;
  if (urlsMatch(page.url(), url)) return;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (e) {
    if (urlsMatch(page.url(), url) || e.message?.includes('interrupted')) {
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      return;
    }
    console.log('goto失敗:', e.message);
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
        return {
          linuxtext: text,
          linuxprice: (priceEl?.textContent ?? '').trim(),
        };
      }
      return { linuxtext: null, linuxprice: null };
    },
    { itemSelector, priceSelector, searchTexts }
  );
}

function saveProduct(db, url, productInfo, linux) {
  db.insert({
    url,
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

  for (let attempt = 0; attempt < 20; attempt++) {
    if (await hasListPageChanged(page, { urlBefore, pageBefore, articleTextBefore })) {
      return true;
    }
    await sleep(500);
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
    const url = resolveHref(page, href);
    if (!url) throw e;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  }
  await waitUntilReady(page);
}

test('Dellのページネーションテスト', async ({ page }) => {
  const db = createPclistDb();
  const popupWatcher = setInterval(async () => {
    if (page.isClosed()) return;
    await handleInitialPopups(page).catch(() => {});
  }, 5000);

  try {
  // 1. ターゲットページへ移動
  await page.goto(targeturl, { waitUntil: 'domcontentloaded' });
  // 2. ポップアップ処理を呼び出す（ここでクッキー同意やアンケートを自動処理）
  // 3. 本来のスクレイピング処理（次へボタンを連打）
  console.log('本来のスクレイピング処理を開始します。');
  async function getItems(page){
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
  // ページループ
  var productInfo = null;
  var linux = null;
  while (true) {
    // 商品リスト
    var {items,count} = await getItems(page);
    var currenturl = page.url();
    
    for (let i = 0; i < count; i++) {  
      const custompage = getProductDetailLink(items.nth(i));
      // 商品別ページ情報の取得
      if (await custompage.count() > 0) {
        const customHref = await custompage.getAttribute('href').catch(() => null);
        await handleInitialPopups(page);
        await clickLink(page, custompage, customHref);
        await handleInitialPopups(page);
        // 詳細を取得する
        // 基本構成がある場合
        var basicOptions = page.locator('a.base-config-option');
        var nowcustomize = page.locator(
          'span.btn.btn-outline-primary',
           { hasText: '今すぐカスタマイズ' })
        var basicurl = page.url();
        if (await basicOptions.count() > 0 || await nowcustomize.count() > 0) {
          var jMax = 0;
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
              await waitUntilReady(page);
              basicurl = page.url();
              await basicOptions.nth(j).click({ force: true });
              await waitUntilReady(page);
            }
            productInfo = await getProductInfo(page);              
            // 今すぐカスタマイズがある場合

            var customizeurl = null;
            if (await nowcustomize.count() > 0) {
              customizeurl = page.url();
              await handleInitialPopups(page);
              await waitUntilReady(page);
              await nowcustomize.click({ force: true });
              await waitUntilReady(page);
            }
            linux = await checkSearchTexts(page);
            console.log(page.url(), productInfo, linux);
            saveProduct(db, page.url(), productInfo, linux);
            if (customizeurl && page.url() != customizeurl) {
              await goBack(page, customizeurl);
            }
            if (basicurl && page.url() != basicurl) {
              await goBack(page, basicurl);
            }
            basicOptions = page.locator('a.base-config-option');
          }
        } else {
        // 単品の場合
          productInfo = await getProductInfo(page,
            'h1.cf-pg-title span',
            '.cf-model-title',
            'div.cf-dell-price > div.cf-price','div.cf-hero-bts',
            "img[data-testid='sharedPolarisHeroPdImage']"
          );   
          linux = await checkSearchTexts(page,'.ux-cell-title','.ux-cell-delta-price');
          console.log(page.url(), productInfo, linux);
          saveProduct(db, page.url(), productInfo, linux);
        }
        await sleep(1000);
        // 戻る
        await handleInitialPopups(page);
        await goBack(page, currenturl);
        await waitUntilReady(page);
        await handleInitialPopups(page);
        ({items,count} = await getItems(page));  
      }
    }

    if (!(await goNextListPage(page))) break;
  }
    db.finalize();
  } catch (e) {
    db.discard();
    throw e;
  } finally {
    clearInterval(popupWatcher);
  }
});