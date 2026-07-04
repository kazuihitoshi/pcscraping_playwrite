# PC情報スクレイピング収集ツール

Dell 公式サイトのノート PC 一覧ページを [Playwright](https://playwright.dev/) で自動巡回し、商品情報を収集するツールです。

対象 URL（`scraping/scraping.spec.js`）:

```
https://www.dell.com/ja-jp/shop/scc/scr/laptops
```

## 収集する情報

各商品について、次の項目を取得し SQLite データベース `pclist.db` に保存します。

| 項目 | 内容 |
|------|------|
| `url` | 商品ページの URL |
| `name` | 商品名 |
| `model` | モデル ID |
| `note` | スペック（CPU・メモリなど） |
| `price` | 価格 |
| `linuxtext` | Linux / Ubuntu など OS オプションの表示テキスト |
| `linuxprice` | OS オプションの価格差分 |

一覧ページをページネーションで巡回し、各商品のカスタマイズページまで遷移して情報を取得します。Cookie 同意やメール登録ポップアップなども自動で閉じます。

---

## Windows 開発環境の整備

このプロジェクトは **WSL（Ubuntu）上に置き、Windows の VS Code / Cursor から U: ドライブ経由で操作する** 構成を想定しています。

### 1. 必要なソフトウェア

- **Windows** に [Node.js](https://nodejs.org/)（LTS 推奨）をインストール
- **WSL2** に Ubuntu をインストール
- **VS Code** または **Cursor**

### 2. WSL ドライブのマップ

PowerShell（管理者不要）で次を実行し、WSL のファイルシステムを `U:` ドライブとしてマウントします。

```powershell
net use U: \\wsl$\Ubuntu
```

プロジェクトのパス:

```
U:\home\disk\pcscraping_playwrite
```

VS Code / Cursor ではこのフォルダをワークスペースとして開いてください。

### 3. 依存パッケージのインストール

プロジェクトルートで次を実行します。

```powershell
cd U:\home\disk\pcscraping_playwrite
npm install
npx playwright install
```

### 4. （任意）セレクタの調査

ページ上の要素を調べるときは、Playwright のコード生成ツールが使えます。

```powershell
npx playwright codegen https://www.dell.com/ja-jp/shop/scc/scr/laptops
```

---

## VS Code / Cursor からの実行方法

`.vscode/launch.json` に 3 つの起動設定があります。

### 設定の選び方

1. 左サイドバーの **「実行とデバッグ」**（`Ctrl + Shift + D`）を開く
2. 上部のドロップダウンから設定を選択
3. **▶（デバッグの開始）** または **`F5`** で実行

起動前に `Verify WSL drive (U:)` タスクが走り、U: ドライブのマウントを確認します。

### 起動設定一覧

| 設定名 | ブラウザ | 用途 |
|--------|----------|------|
| **Playwright: ヘッドレス実行** | 非表示 | 通常のスクレイピング実行。バックグラウンドでデータ収集するとき |
| **Playwright: ブレークポイントでステップ実行** | 表示 | VS Code のブレークポイント + F10/F11 でコードを追いながらデバッグするとき |
| **Playwright: Inspectorでステップ実行** | 表示 | Playwright Inspector の GUI でブラウザ操作を確認しながらデバッグするとき |

#### Playwright: ヘッドレス実行

- 設定ファイル: `playwright.headless.config.js`（`headless: true`）
- ブラウザウィンドウは開かず、ターミナルにログが出力されます
- **普段の収集作業はこちらを使います**

#### Playwright: ブレークポイントでステップ実行

- 設定ファイル: `playwright.config.js`（`headless: false` + `--headed`）
- `scripts/debug-transform.cjs` により、各文に `debugger` を挿入
- エディタ上にブレークポイントを置き、変数の値を確認しながらステップ実行できます

#### Playwright: Inspectorでステップ実行

- `--debug` フラグで Playwright Inspector を起動
- ブラウザの動きを目で見ながら、ロケーターの選択や操作の確認ができます

---

## コマンドラインからの実行

VS Code を使わず、ターミナルから直接実行することもできます。

### ヘッドレス実行（ブラウザ非表示）

```powershell
cd U:\home\disk\pcscraping_playwrite
npx playwright test scraping/scraping.spec.js --workers=1 --config playwright.headless.config.js
```

### ブラウザ表示での実行

```powershell
npx playwright test scraping/scraping.spec.js --headed --workers=1
```

### npm スクリプト

```powershell
npm run test:scraping   # ブラウザ表示で実行（--headed 付き）
npm run test:debug      # Inspector でデバッグ実行
```

---

## Docker での実行

Node.js や Playwright をローカルにインストールせず、Docker コンテナ上でヘッドレス実行できます。WSL の `U:` ドライブマップも不要です。

### 前提

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) がインストール済みであること
- Docker デーモンが起動していること

### 初回実行（ビルド + 実行）

プロジェクトルートで次を実行します。

```powershell
cd U:\home\disk\pcscraping_playwrite
docker compose up --build
```

初回は Chromium のインストールを含むため、ビルドに数分かかることがあります。

### 2 回目以降

```powershell
docker compose up
```

### バックグラウンド実行

```powershell
docker compose up --build -d
docker compose logs -f
```

停止・削除:

```powershell
docker compose down
```

### 動作の概要

| 項目 | 内容 |
|------|------|
| 設定ファイル | `docker-compose.yml` / `Dockerfile` |
| 実行モード | ヘッドレス（`playwright.headless.config.js`） |
| Node.js | 22（`node:sqlite` 利用のため） |
| 出力 | 完了後にホスト側の `pclist.db` に保存 |

プロジェクトフォルダをコンテナの `/app` にマウントしているため、収集結果はホスト上の `pclist.db` として残ります。

### 補足

- デバッグ（ブラウザ表示・Inspector）は Docker ではなく、ローカル環境の VS Code / Cursor から行う想定です
- イメージを作り直すときは `docker compose build --no-cache` を使います

---

## 出力ファイル

| ファイル | 説明 |
|----------|------|
| `pclist.db` | 収集した商品データ（SQLite） |

スクレイピングのセレクタや DOM 構造のメモは `scraping.md` を参照してください。
