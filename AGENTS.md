# Agentic Coding開発環境
Hono単体のフルスタック構成で任意のアプリケーションをAgenticCodingを用いて開発を行う

## アーキテクチャ

- '/app': アプリケーション本体
- '/app/specs': アプリケーションを実装する上での仕様書
- '/app/specs/archive': 実装が完了した仕様書を格納する
- '/docs': 実装に必要なドキュメントなど

### app/ の位置づけ（重要）
- `app/` は受講者がハンズオン中に新規作成する作業領域
- 本ハンズオンでは **git を使わない**（受講者PCに git が無い前提で動くこと。`git init` / `git commit` 等を提案・実行しない）
- 本ハンズオンでは **zip 等によるアーカイブ・バックアップも使わない**（成果物は受講者PCの `app/` 配下にそのまま残るため。zip 化・持ち帰り用アーカイブの作成を提案・実行しない）

## 実行環境（Node.js / npm / npx）— 重要

本ハンズオンの Node.js は**グローバルにインストールされていない**。`setup` skill が展開した **`runtime/node` 配下のポータブル版**を使う。各スキル・steering ドキュメント・チェックリストに現れる `node` / `npm` / `npx` は、**すべてこの runtime 配下のものを指す**。グローバルの `node` / `npm` を呼んではならない（存在しない、または別バージョンの可能性がある）。

### バイナリの場所

| OS | node | npm | npx |
|---|---|---|---|
| macOS / Linux | `runtime/node/bin/node` | `runtime/node/bin/npm` | `runtime/node/bin/npx` |
| Windows | `runtime\node\node.exe` | `runtime\node\npm.cmd` | `runtime\node\npx.cmd` |

（`runtime` はワークスペース直下。フォルダ名は `setup` skill が `node` に統一している）

### 実行方法

PATH は**永続設定しない**（受講者の環境を変更しない）。コマンド実行のたびに、runtime の bin ディレクトリを **その場で PATH 先頭に付与**して実行する。シェルの状態はコマンド間で保持されないため、`node`/`npm`/`npx` を使うコマンドごとに付与する。

`app/` 配下で実行する場合（runtime は1つ上の階層にある）:

```bash
# macOS / Linux
PATH="$PWD/../runtime/node/bin:$PATH" npm test
```

```powershell
# Windows / PowerShell（npm ではなく npm.cmd と書く。理由は下の「Windows では必ず .cmd」参照）
$env:Path = "$PWD\..\runtime\node;$env:Path"; npm.cmd test
```

ワークスペース直下で実行する場合は `../runtime` を `runtime` に読み替える。

### Windows では必ず `.cmd` を明示する（重要）

**Windows / PowerShell では `npm` / `npx` と裸で書いてはならない。必ず `npm.cmd` / `npx.cmd` と書く。**

理由:

- Windows 版 Node には npm のランチャが3つ同梱されている（`npm`＝sh 用 / `npm.cmd`＝cmd.exe 用 / `npm.ps1`＝PowerShell 用）
- PowerShell はコマンド解決時、自身のスクリプト拡張子 `.ps1` を `PATHEXT`（`.COM;.EXE;.BAT;.CMD;…`）より**優先**するため、`npm` は `npm.ps1` に解決される
- `.ps1` は実行ポリシー（ExecutionPolicy）の管理対象。Windows クライアントの既定は `Restricted`（社内配布PCでは GPO で固定されていることも多い）なので読み込みが拒否され、次のエラーで失敗する:

  ```
  このシステムではスクリプトの実行が無効になっているため、ファイル ...\npm.ps1 を読み込むことができません。
  ```

- ExecutionPolicy が規制するのは `.ps1` / `.psm1` / `.ps1xml` **のみ**。`.cmd` は cmd.exe が解釈するバッチなので対象外 → `npm.cmd` は必ず動く

**受講者PCの ExecutionPolicy を変更して回避しない**（`Set-ExecutionPolicy` を実行しない）。受講者の環境を変えてしまううえ、GPO 固定環境では変更自体が失敗する。`.cmd` を明示するだけで解決する。

なお `node` は `node.exe` なのでこの問題は起きない（`runtime\node\node.exe` をそのまま呼べる）。

### npm キャッシュもリポジトリ内に閉じ込める（重要）

npm のキャッシュは既定では受講者PCのホームディレクトリ（macOS: `~/.npm`、Windows: `%LocalAppData%\npm-cache`）に書き込まれてしまう。受講者PCに痕跡を残さないため、**キャッシュもワークスペース内（`runtime/npm-cache/`）に閉じ込める**。

- `app/` を初期化する際（最初の `npm install` より**前**）に、`app/.npmrc` を次の内容で作成する:

  ```
  cache=../runtime/npm-cache
  ```

- npm コマンドは必ず `app/` 内で実行する前提（上記「実行方法」参照）のため、この相対パスはワークスペース直下の `runtime/npm-cache/` に解決される
- `npx` の実行キャッシュ（`_npx`）やログ（`_logs`）も同キャッシュ配下に収まる
- `runtime/` は Git 追跡外のため、キャッシュがリポジトリの配布物に混入することもない

### 補足

- **PATH 付与は省略できない。** `npm.cmd` / `runtime/node/bin/npm` 自体は自分の隣にある node を使うが、`npm run dev` から起動される `node_modules/.bin/tsx` などの shim は**裸の `node` を呼ぶ**（npm が子プロセスへ渡す PATH には `node_modules/.bin` 系しか追加されず、node 自身のディレクトリは含まれない）。runtime の bin を PATH 先頭に付与しているから `tsx` / `vitest` / `biome` が runtime の node で動く。
- したがって、各スキルのチェックリストにある `npm test` / `npm run dev` / `npm run lint` などは、上記の「PATH 付与つき」（Windows は加えて `.cmd` 明示）で実行すれば読み替えられる。
- **ローカルツール（biome / vitest / tsx）は `npx` で呼ばず、`package.json` の script 経由（`npm run <script>`）で呼ぶ。** `npx` はローカルに目的のパッケージを見つけられないと判断すると**レジストリから別バージョンを取得して実行**するため、設定形式の不一致（例: Biome v1 形式の biome.json に v2 が当たる／その逆）を引き起こす。ネットワークアクセスも増える。どうしても直接実行が必要な場合は `npm exec --no -- <cmd>` を使う（`--no` = 未検出時にダウンロードせず失敗させる）。
- パッケージマネージャの読み替え指示（グローバル設定等）がある場合も、対象バイナリは必ず runtime 配下のものを使う。
- `npm install -g` は使わない（ポータブル版の prefix は `runtime/node` 配下を指すためリポジトリ内には収まるが、本ハンズオンでグローバルインストールが必要になる場面はない）。

## ネットワーク要件（セットアップ時・実行時）

受講者PCから以下へのアウトバウンド疎通を前提とする。社内プロキシ / ファイアウォールでブロックされていると失敗するため、トラブル時はまずここを疑う。

- **npm レジストリ**: `npm install` による依存取得
- **`https://cdn.tailwindcss.com`**: 画面スタイリングに Tailwind CSS の CDN 版を実行時に読み込む（ビルド不要のため生成コードは `<head>` で CDN を参照する）
- **`https://unpkg.com`**: htmx を使う場合に実行時に読み込む

> Node.js 本体は `dist/` 同梱のポータブル版を使うためダウンロード不要だが、上記のとおり**依存インストールとアプリ実行時にはネットワークが必要**。「Node を同梱＝完全オフライン」ではない点に注意。

## ライブラリ
- 標準ライブラリや既存ライブラリで実装できるものは原則追加で導入しない
- 新規にライブラリを導入する場合は、ライセンスはMIT、Apache2.0、BSDのみとする