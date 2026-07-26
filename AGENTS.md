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
# Windows / PowerShell
$env:Path = "$PWD\..\runtime\node;$env:Path"; npm test
```

ワークスペース直下で実行する場合は `../runtime` を `runtime` に読み替える。

### 補足

- `npm run` / `npx` から起動される `tsx` / `vitest` / `biome` などは、**runtime の npm を経由すれば自動的に runtime の node を使う**（子プロセスに npm が自分の node ディレクトリを渡すため）。個別に node を指定する必要はない。
- したがって、各スキルのチェックリストにある `npm test` / `npm run dev` / `npx biome ...` などは、上記の「PATH 付与つき」で実行すれば読み替えられる。
- パッケージマネージャの読み替え指示（グローバル設定等）がある場合も、対象バイナリは必ず runtime 配下のものを使う。

## ネットワーク要件（セットアップ時・実行時）

受講者PCから以下へのアウトバウンド疎通を前提とする。社内プロキシ / ファイアウォールでブロックされていると失敗するため、トラブル時はまずここを疑う。

- **npm レジストリ**: `npm install` による依存取得
- **`https://cdn.tailwindcss.com`**: 画面スタイリングに Tailwind CSS の CDN 版を実行時に読み込む（ビルド不要のため生成コードは `<head>` で CDN を参照する）
- **`https://unpkg.com`**: htmx を使う場合に実行時に読み込む

> Node.js 本体は `dist/` 同梱のポータブル版を使うためダウンロード不要だが、上記のとおり**依存インストールとアプリ実行時にはネットワークが必要**。「Node を同梱＝完全オフライン」ではない点に注意。

## ライブラリ
- 標準ライブラリや既存ライブラリで実装できるものは原則追加で導入しない
- 新規にライブラリを導入する場合は、ライセンスはMIT、Apache2.0、BSDのみとする