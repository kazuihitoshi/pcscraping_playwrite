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

  const needles = searchTexts.map((t) => t.toLowerCase());
  const items = scope.locator(itemSelector);
  const count = await items.count();

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const text = ((await item.textContent()) ?? '').trim();
    const lower = text.toLowerCase();
    if (!needles.some((n) => lower.includes(n))) continue;

    const container = item.locator('xpath=..');
    const price = ((await container.locator(priceSelector).first().textContent()) ?? '').trim();
    return { linuxtext: text, linuxprice: price };
  }

  return { linuxtext: null, linuxprice: null };
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

async function clickLink(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await waitUntilReady(page);
  try {
    await locator.click({ force: true, timeout: 15000 });
  } catch (e) {
    const href = await locator.getAttribute('href');
    if (!href) throw e;
    const url = href.startsWith('http') ? href : new URL(href, page.url()).href;
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
    const items = await page.locator('#sr-product-stacks article');
    try {
      await items.first().waitFor({ state: 'visible', timeout: 40000 });
      // 2. 画面に表示された状態で個数を数える
      const count = await items.count();
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
      const item = items.nth(i);
      const custompage = item.locator('a.variant-customize-button');
      // 商品別ページ情報の取得
      if (await custompage.count()>0){
        await handleInitialPopups(page);
        await clickLink(page, custompage);
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

    // ページング遷移
    await handleInitialPopups(page);
    const nextpage = page.locator('#sr-dds-pagination button.dds__pagination__next-page');
    if (await nextpage.count() === 0) {
      console.log('次へボタンなし。一覧走査を終了します。');
      break;
    }
    if (await nextpage.getAttribute('aria-disabled') === 'true') {
      console.log('最終ページです。一覧走査を終了します。');
      break;
    }
    await handleInitialPopups(page);
    await waitUntilReady(page);
    await nextpage.scrollIntoViewIfNeeded();
    await nextpage.click({ force: true });
    await waitUntilReady(page);
  }
    db.finalize();
  } catch (e) {
    db.discard();
    throw e;
  } finally {
    clearInterval(popupWatcher);
  }
});