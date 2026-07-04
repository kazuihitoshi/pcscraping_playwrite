# Dell サイト構造（スクレイピング対象）

`scraping/scraping.spec.js` が巡回する Dell 日本公式サイトのページ構造メモです。  
セレクタ調査の出発点として使い、サイト改修時の差分確認に利用してください。

対象 URL:

```
https://www.dell.com/ja-jp/shop/scc/scr/laptops
```

---

## 巡回の全体像

```mermaid
flowchart TB
  start([開始]) --> listPage[一覧ページ<br/>SCC / laptops]

  listPage --> loopPage{ページ内の<br/>商品を順に処理}
  loopPage --> clickOption[オプションを見る をクリック]
  clickOption --> detailPage[商品詳細ページ]

  detailPage --> hasBasic{基本構成タブ<br/>あり?}
  hasBasic -->|あり| basicTab[基本構成タブを切替]
  basicTab --> getInfo1[商品情報を取得]
  getInfo1 --> hasCustomize{今すぐ<br/>カスタマイズ?}
  hasCustomize -->|あり| customizePage[カスタマイズページ]
  customizePage --> getLinux1[OSオプション取得]
  getLinux1 --> save1[(DB保存)]
  save1 --> backBasic[基本構成ページへ戻る]
  backBasic --> basicTab
  hasCustomize -->|なし| getLinux2[OSオプション取得]
  getLinux2 --> save2[(DB保存)]
  save2 --> backList1[一覧へ戻る]

  hasBasic -->|なし| singlePage[単品詳細ページ]
  singlePage --> getInfo2[商品情報を取得]
  getInfo2 --> getLinux3[OSオプション取得]
  getLinux3 --> save3[(DB保存)]
  save3 --> backList1

  backList1 --> loopPage
  loopPage -->|全商品完了| nextPage{次ページ<br/>あり?}
  nextPage -->|あり| listPage
  nextPage -->|なし| endNode([終了・DB確定])
```

**処理の流れ（要約）**

1. ノート PC 一覧ページを開く
2. 各ページの商品カードを順に処理
3. 「オプションを見る」で商品詳細へ遷移
4. 基本構成の有無で分岐し、商品情報と OS オプション（Linux 等）を取得
5. 一覧 URL に戻る
6. 一覧のページネーションで次ページへ（最終ページまで繰り返し）

---

## ページ種別とページングの有無

```mermaid
flowchart LR
  subgraph scraped [スクレイピング対象]
    listPage["一覧ページ<br/>📄 ページングあり"]
    detailPage["商品詳細<br/>ページングなし"]
    customizePage["カスタマイズ<br/>ページングなし※"]
    singlePage["単品詳細<br/>ページングなし"]
  end

  subgraph excluded [対象外]
    carousel["おすすめ製品<br/>カルーセル<br/>📄 ページングあり"]
    cardDeck["構成カード一覧<br/>📄 ページングあり<br/>未実装"]
  end

  listPage -->|"オプションを見る"| detailPage
  detailPage -->|"基本構成あり"| customizePage
  detailPage -->|"基本構成なし"| singlePage
  listPage -.->|"除外"| carousel
  customizePage -.->|"参考のみ"| cardDeck
```

※ カスタマイズページ内の構成カード（`.card-deck-item`）にはページングが存在する場合がありますが、現行スクリプトでは巡回していません。

| ページ種別 | URL の例 | ページング | 備考 |
|------------|----------|:----------:|------|
| **一覧ページ（SCC）** | `/shop/scc/scr/laptops` | **あり** | 商品リスト全体のページ送り。現状 7 ページ・84 件程度 |
| **商品詳細（バリアントスタック）** | `/shop/.../spd/...?ref=variantstack` | なし | 基本構成タブ（`a.base-config-option`）で構成切替 |
| **カスタマイズページ** | 上記から「今すぐカスタマイズ」遷移後 | 条件付き | 構成カード一覧のページングは未巡回 |
| **単品詳細ページ** | `/shop/.../spd/...`（`cf-*` 系 UI） | なし | 基本構成タブがない商品 |
| **おすすめ製品カルーセル** | 一覧ページ内 | あり | スクレイピング対象外 |

### ページングがあるページの詳細

#### 1. 一覧ページ（メインのページング）

スクレイパーが実際にループするのはここだけです。

```mermaid
flowchart TB
  subgraph listLayout [一覧ページのレイアウト]
    stacks["#sr-product-stacks"]
    stacks --> card1["article 商品カード 1"]
    stacks --> card2["article 商品カード 2"]
    stacks --> cardN["article 商品カード N"]
    card1 --> link1["a: オプションを見る"]
  end

  subgraph pagination [ページネーション領域]
    pagContainer["#scr-pagination-content<br/>または #sr-dds-pagination"]
    pagContainer --> firstBtn[First page]
    pagContainer --> prevBtn[Previous page]
    pagContainer --> pageInput["input ページ"]
    pagContainer --> nextBtn["Next page"]
    pagContainer --> lastBtn[Last page]
  end

  subgraph carouselArea [対象外: おすすめ製品]
    carouselHeader[おすすめ製品]
    carouselHeader --> nestedArticle["article ネスト"]
    nestedArticle --> buyLink["詳細の表示・ご購入"]
    carouselHeader --> carouselNext["Next Page ボタン"]
  end

  listLayout --> pagination
```

| 要素 | セレクタ |
|------|----------|
| ページネーション領域 | `#scr-pagination-content` または `#sr-dds-pagination` |
| 次へボタン | `button[aria-label="Next page"]` または `button.dds__pagination__next-page` |
| 前へボタン | `button.dds__pagination__prev-page` |
| 現在ページ入力 | `input[aria-label="ページ"]` |
| 終端判定 | 次へボタンの `disabled` または `aria-disabled="true"` |

表示例: `ページ [7] of 7`（テキストボックスに現在ページ、横に総ページ数）

#### 2. 一覧内「おすすめ製品」カルーセル（ページングあり・対象外）

一覧ページ下部付近に **別の** ページングがあります。商品リスト本体とは別物です。

| 要素 | 特徴 |
|------|------|
| 見出し | `おすすめ製品` |
| カルーセル内商品 | ネストされた `article`（「詳細の表示・ご購入」リンク） |
| カルーセル送り | `Next Page` / `Previous Page` ボタン |

スクレイパーは `#sr-product-stacks article` のうち **「オプションを見る」リンクを持つカードのみ** を対象とし、カルーセル内 `article` は除外しています。

#### 3. カスタマイズページ内（参考・未実装）

`scraping.md` に記載。カード型の構成一覧を複数ページに分けている場合があります。

| 要素 | セレクタ |
|------|----------|
| 構成カード一覧 | `.card-deck-item` |
| 次ページ（構成一覧） | `button[aria-label="Next page"]` |
| スペック | `.card-specs` |
| 価格 | `.sale-price` |

現行の `scraping.spec.js` はこのページングをループせず、表示中の 1 画面から OS オプションを取得します。

---

## ページ別 DOM 構造

### 一覧ページ

```mermaid
flowchart TB
  main[main]
  main --> stacks["#sr-product-stacks"]
  stacks --> article["article × N（商品カード）"]
  article --> nameLink["h3 > a 商品名"]
  article --> modelInfo["モデル ID・スペック概要"]
  article --> basePrice["基本構成モデル価格"]
  article --> optionLink["a オプションを見る"]

  main --> pagArea["#scr-pagination-content / #sr-dds-pagination"]
  pagArea --> navPag["navigation pagination"]
  navPag --> navBtns["First / Prev / Next / Last"]
  navPag --> pageInput["input aria-label=ページ"]
```

**商品カードの取得（Playwright）:**

```js
page.locator('#sr-product-stacks article').filter({
  has: page.locator('a.variant-customize-button, a:has-text("オプションを見る")'),
});
```

| 項目 | セレクタ・内容 |
|------|----------------|
| 商品リスト容器 | `#sr-product-stacks` |
| 商品カード | `article`（上記フィルタ後） |
| 詳細へ進むリンク（新 UI） | `a:has-text("オプションを見る")` |
| 詳細へ進むリンク（旧 UI） | `a.variant-customize-button` |
| 件数表示 | `84件中73～84件の結果` のようなテキスト（ページごとに変動） |

---

### 商品詳細ページ（基本構成あり）

「オプションを見る」遷移先。複数の基本構成（プリセット）を持つモデル向け。

```mermaid
flowchart TB
  detailEntry[商品詳細ページ] --> basicTabs["a.base-config-option × N"]
  basicTabs --> selectedTab["aria-current=true が選択中"]
  detailEntry --> customizeBtn["span.btn: 今すぐカスタマイズ"]

  subgraph productInfo [getProductInfo デフォルト]
    piName["h1 .page-title"]
    piModel["div.model-id"]
    piPrice[".sale-price"]
    piNote[".card-specs .list-unstyled"]
    piImg["img sharedPolarisHeroPdImage"]
  end

  detailEntry --> productInfo
  customizeBtn --> customizePage[カスタマイズページ]
  customizePage --> uxCell[".ux-cell-text / .ux-cell-delta-price"]
```

```mermaid
sequenceDiagram
  participant List as 一覧ページ
  participant Detail as 商品詳細
  participant Custom as カスタマイズ
  participant DB as pclist.db

  List->>Detail: オプションを見る
  loop 基本構成タブごと
    Detail->>Detail: base-config-option 切替
    Detail->>Detail: getProductInfo
    opt 今すぐカスタマイズあり
      Detail->>Custom: クリック
      Custom->>Custom: checkSearchTexts
      Custom->>DB: saveProduct
      Custom->>Detail: goBack
    end
  end
  Detail->>List: goBack
```

**処理の流れ:**

1. `a.base-config-option` が複数あればタブを切り替えながらループ
2. 各構成で `getProductInfo` 実行
3. 「今すぐカスタマイズ」があればクリックしてカスタマイズページへ
4. OS オプション（Linux / Ubuntu 等）を `checkSearchTexts` で検索
5. `goBack` で基本構成ページ → 一覧へ戻る

---

### カスタマイズページ

「今すぐカスタマイズ」後の構成選択画面。OS や各種オプションの価格差分を取得する。

```mermaid
flowchart LR
  customizePage[カスタマイズページ] --> uxOptions[".ux-cell-options"]
  uxOptions --> uxText[".ux-cell-text"]
  uxOptions --> uxPrice[".ux-cell-delta-price"]
  uxText --> searchKeys["linux / ubuntu / OSなし を検索"]
  searchKeys --> dbSave[(DB: linuxtext / linuxprice)]
```

| 項目 | セレクタ |
|------|----------|
| オプション行（テキスト） | `.ux-cell-text` |
| オプション価格差分 | `.ux-cell-delta-price` |
| オプション領域（参考） | `.ux-cell-options` |

**検索キーワード（OS 関連）:**

```js
['linux', 'ubuntu', 'オペレーティングシステムなし']
```

`.ux-cell-text` のテキストに上記のいずれかが含まれる行を探し、同じ親要素内の `.ux-cell-delta-price` を価格として取得します。

---

### 単品詳細ページ（基本構成なし）

`a.base-config-option` も「今すぐカスタマイズ」も無い場合の分岐。

```mermaid
flowchart TB
  singlePage[単品詳細ページ cf系UI]
  singlePage --> sName["h1.cf-pg-title span"]
  singlePage --> sModel[".cf-model-title"]
  singlePage --> sPrice["div.cf-dell-price > div.cf-price"]
  singlePage --> sNote["div.cf-hero-bts"]
  singlePage --> sImg["img sharedPolarisHeroPdImage"]
  singlePage --> sOsTitle[".ux-cell-title"]
  singlePage --> sOsPrice[".ux-cell-delta-price"]
  sOsTitle --> dbSave[(DB保存)]
```

| 項目 | セレクタ |
|------|----------|
| 商品名 | `h1.cf-pg-title span` |
| モデル | `.cf-model-title` |
| 価格 | `div.cf-dell-price > div.cf-price` |
| スペック概要 | `div.cf-hero-bts` |
| 画像 | `img[data-testid='sharedPolarisHeroPdImage']` |
| OS オプション行 | `.ux-cell-title` |
| OS 価格差分 | `.ux-cell-delta-price` |

---

## 全ページ共通の割り込み UI

`popup-handler.js` が処理する要素です。一覧・詳細のどちらでも出現します。

```mermaid
flowchart TD
  pageLoad[ページ表示 / 遷移] --> checkPopup[handleInitialPopups]
  checkPopup --> cookie["#onetrust-accept-btn-handler<br/>Cookie同意"]
  checkPopup --> email["#email-capture-container<br/>メール登録を閉じる"]
  checkPopup --> survey["アンケート: 実行しない"]
  pageLoad --> waitReady[waitUntilReady]
  waitReady --> loading{"#loading-symbol<br/>表示中?"}
  loading -->|はい| waitHide[非表示まで待機 最大15秒]
  loading -->|いいえ| domReady[domcontentloaded]
  waitHide --> domReady

  interval[5秒ごとの setInterval] -.-> checkPopup
```

| 種類 | セレクタ | 操作 |
|------|----------|------|
| Cookie 同意 | `#onetrust-accept-btn-handler` | クリック（すべて同意） |
| メール登録ポップアップ | `#email-capture-container` | 閉じるボタン / Escape / DOM 除去 |
| メール閉じるボタン | `#email-capture-container button[aria-label="close"]` 等 | クリック |
| アンケート | `.QSIWebResponsive-creative-container-fade button`（テキスト: 実行しない） | クリック |
| ローディング表示 | `#loading-symbol` | 非表示になるまで待機（最大 15 秒） |

5 秒間隔の `setInterval` でも `handleInitialPopups` が呼ばれ、遷移中のポップアップを継続的に閉じます。

---

## ナビゲーションと戻り方

```mermaid
flowchart LR
  subgraph clickLink_fn [clickLink]
    scroll[scrollIntoViewIfNeeded]
    tryClick[click force=true]
    tryClick -->|失敗| gotoHref["page.goto href"]
  end

  subgraph goBack_fn [goBack]
    goBackBrowser[page.goBack]
    goBackBrowser -->|URL不一致| gotoSaved["page.goto 保存URL"]
  end

  subgraph goNext_fn [goNextListPage]
    checkDisabled{次へボタン<br/>disabled?}
    checkDisabled -->|はい| stopLoop[ループ終了]
    checkDisabled -->|いいえ| clickNext[次へクリック]
    clickNext --> waitChange["URL / ページ番号 /<br/>article変化を待機"]
  end
```

| 処理 | 実装 |
|------|------|
| リンククリック | `clickLink` — クリック失敗時は `href` から `page.goto` |
| ブラウザ戻る | `goBack(page, url)` — `page.goBack()` 後、URL が一致しなければ `page.goto(url)` |
| 一覧の次ページ | `goNextListPage` — 次へクリック後、URL・ページ番号・先頭 article テキストの変化を最大 10 秒待つ |

**一覧へ戻るタイミング:** 各商品の詳細取得が終わるたびに、ループ開始時に保存した `currenturl`（一覧ページ URL）へ `goBack` します。

---

## 収集データと DB 項目の対応

```mermaid
flowchart LR
  subgraph pageData [ページから取得]
    url[page.url]
    name[商品名]
    model[モデルID]
    note[スペック]
    price[価格]
    linuxtext[OSオプション名]
    linuxprice[OS価格差分]
  end

  subgraph db [pclist.db / products]
    colUrl[url]
    colName[name]
    colModel[model]
    colNote[note]
    colPrice[price]
    colLinux[linuxtext]
    colLinuxPrice[linuxprice]
  end

  url --> colUrl
  name --> colName
  model --> colModel
  note --> colNote
  price --> colPrice
  linuxtext --> colLinux
  linuxprice --> colLinuxPrice
```

| DB カラム | 取得元 |
|-----------|--------|
| `url` | 保存時点の `page.url()`（カスタマイズ後 URL になる場合あり） |
| `name` | 商品名セレクタ |
| `model` | モデル ID セレクタ |
| `note` | スペック（`extractNoteText` でリストを 1 文字列に整形） |
| `price` | 価格（`,` `円` を除去） |
| `linuxtext` | OS オプション行テキスト |
| `linuxprice` | OS オプション価格差分（`,` `円` を除去） |

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `scraping/scraping.spec.js` | メインの巡回・取得ロジック |
| `scraping/popup-handler.js` | ポップアップ・ローディング待ち |
| `scraping/pclist-db.js` | SQLite への保存 |
| `scraping/text-search.js` | テキスト検索ユーティリティ（補助） |
| `scraping.md` | セレクタの初期メモ（旧 UI 中心） |

---

## サイト改修時のチェックポイント

1. **一覧の詳細リンク** — `a.variant-customize-button` から `オプションを見る` テキストリンクへの変更があった（両方に対応済み）
2. **ページネーション容器 ID** — `#scr-pagination-content` と `#sr-dds-pagination` の二系統（両方に対応済み）
3. **カルーセル混入** — `#sr-product-stacks article` だけではおすすめ製品が含まれるため、リンクでのフィルタが必要
4. **基本構成 UI** — `a.base-config-option` / `今すぐカスタマイズ` の有無で分岐が変わる
5. **タイムアウト** — 全件巡回には 60 分以上かかる場合がある（商品数・構成数に依存）
