---
name: spec-implementing
description: app/specs/<feature-name>/ 配下にある仕様書群（scope.md 以外の全 *.md。ファイル名・数は機能ごとに変動）を入力として、TDD で段階的に実装を進める skill。scope.md は読み込まず、仕様書群と AGENTS.md・steering の規約に沿って Hono 単体構成の TypeScript アプリを完成させる。spec-writing skill の後段で、ユーザーが「実装を開始して」と指示したときに使う想定。ビジネスパーソン・初学者向け。
---

# spec-implementing skill

## このスキルが目指すゴール

[[spec-writing]] が生成した `app/specs/<feature-name>/` 配下の **仕様書群** を読み込み、Hono 単体構成 (TypeScript) のフルスタックアプリを **TDD で段階的に実装** して完成まで持っていく。

- **入力ディレクトリ**: `app/specs/<feature-name>/` （仕様書の配置場所は常にここ）
- **入力ファイル**: 上記ディレクトリ配下の `scope.md` **以外** の `*.md` 全部
  - **ファイル名・数は機能によって変動する**。`00-overview.md` / `01-data-model.md` / `02-backend-api.md` / `03-frontend-view.md` / `04-integration.md` は典型例だが、機能によっては減ったり増えたりする
  - 例: フロントエンド不要なバッチ機能なら `03-frontend-view.md` が無い / 外部 API 連携があれば `02-external-api.md` が追加される 等
  - ファイル名の **番号プレフィックス（`00-` / `01-` / ...）が実装着手順序** を示す
  - ファイル名の **キーワード（`data-model` / `backend-api` / `frontend-view` / `integration` 等）が各ファイルの責務** を示す
- **読まないファイル**: 同ディレクトリの `scope.md`（スコープ調整用なので参照しない）
- **出力**: `app/` 配下の動くアプリ + Vitest 単体テスト + Hono `app.request()` による結合テスト
- **完成条件**: 仕様書の「Definition of Done」を満たした状態

## 起動トリガー

[[spec-writing]] による仕様書生成完了後、ユーザーが以下のように明示指示したとき:

- 「実装を開始して」「実装に着手して」「実装してOK」
- 「仕様書通りに作って」「これで実装に進んで」
- 「コーディング始めて」

### 対象 feature の指定方法

`app/specs/<feature-name>/` は **複数 feature が並んで配置される前提**（例: `app/specs/daily-budget/`, `app/specs/weather-notifier/` が同居）。

skill 起動時、対象 feature の指定は以下のいずれかで受け取る:

1. **引数で明示**: 「`daily-budget` の実装を開始して」「`app/specs/daily-budget/` で実装」など、ユーザー発話に feature 名・パスが含まれる場合は **その値を使う**
2. **対話で文脈から特定**: 直前のターンで [[spec-writing]] が特定の feature に対して仕様書生成を完了している場合、その feature 名を **候補として提示** したうえで **必ずユーザーに確認**
3. **明示も文脈も無い**: 候補数に関わらず **必ず `AskUserQuestion` でユーザーに確認**

> 候補が1件しか無くても **自動で進めない**。誤った feature への実装着手は影響が大きいため、必ず明示同意を得る。

逆に、仕様書がまだ揃っていない・ユーザーが仕様調整を続けたい意向のときは発動しない。

## 想定ユーザー

- ビジネスパーソン、または初学者エンジニア
- 専門用語の初出時はカッコ書きで1行補足する
- 「いま何をしているか」「次に何をするか」を毎フェーズで1行で示す

## 絶対に守る制約

### 1. scope.md は読まない
- `app/specs/<feature-name>/scope.md` は **スコープ調整用** のファイル。実装フェーズでは参照しない
- 実装の根拠は **必ず同ディレクトリの仕様書群（`scope.md` 以外の `*.md` 全部）** に置く
- 仕様書と scope.md に食い違いがあったら、仕様書を正とする（scope.md を直しに行かない）

### 2. AGENTS.md と steering を遵守
- ルートの `AGENTS.md`（プロジェクト方針）と `.kiro/steering/` 配下の各規約（`code-conventions.md` / `testing-unit-patterns.md`）を必ず読み、その規約に従う
- 特に以下を厳守:
  - **TypeScript strict**（`any` 禁止、Non-null assertion 禁止、`@ts-ignore` 禁止）
  - **型ファースト**: 外部入力は Zod で検証
  - **Biome** で format / lint（`npm run lint`。`npx biome ...` は使わない。理由は Step 3 参照）
  - **ディレクトリ構成**: `src/index.ts` / `src/routes/` / `src/lib/` / `src/schemas/` / `src/components/` / `src/middleware/` / `src/types/`
  - **テストは `tests/` 配下に `src/` と対応する階層で配置**
  - **`enum` 禁止**: `as const` + Union Type を使う
  - **戻り値型を明示**（export 関数）

> **コマンド実行の前提**: 本スキル内の `npm` / `node`（`npm install` / `npm test` / `npm run dev` / `npm run lint` など）は、すべて **runtime 配下**（`runtime/node/bin`、Windows は `runtime\node`）のものを使う。グローバルの node/npm は無い前提。実行時は PATH に runtime の bin を付与する。具体的な方法は [AGENTS.md](../../../AGENTS.md) の「実行環境（Node.js / npm / npx）」を参照。以降のコマンドはこの読み替えを前提に記載する。
>
> **ローカルツール（biome / vitest / tsx）の実行は `npx` ではなく `package.json` の script 経由（`npm run <script>`）で行う。** `npx` はローカルに目的のパッケージを見つけられないと判断するとレジストリから**別バージョンを取得して実行**するため、設定形式の不一致（Biome v1/v2 の差分など）を引き起こす。どうしても直接実行が必要な場合は `npm exec --no -- <cmd>`（`--no` = 未検出時にダウンロードせず失敗させる）を使う。
>
> **Windows では `npm` / `npx` と裸で書かず、必ず `npm.cmd` / `npx.cmd` と書く。** PowerShell は `.ps1` を `.cmd` より優先して解決するため `npm.ps1` が選ばれ、ExecutionPolicy（既定 `Restricted`）に阻まれて「このシステムではスクリプトの実行が無効になっているため…`npm.ps1` を読み込むことができません」で失敗する。`.cmd` はポリシー対象外なので確実に動く。**`Set-ExecutionPolicy` で受講者PCのポリシーを変更して回避しない。** 詳細は [AGENTS.md](../../../AGENTS.md) の「Windows では必ず `.cmd` を明示する」を参照。

### 3. TDD を順守
- 機能ごとに **テストを先に書く → 失敗を確認 → 実装 → テスト通過** の順
- 処理変更の都度 `npm test` を実行し、常にグリーンを維持
- カバレッジ 10% 以上を必達。`npm run test:coverage` で確認（script は Step 3 で定義する）
- 単体テスト完了後、最終チェックとして Hono `app.request()` による結合テストを実施（**主要シナリオ1〜2本に絞る**。ハンズオンの時間内に収めるため。Playwright 等ブラウザ E2E は使わない）

### 4. ライブラリの追加方針
- 既存ライブラリ・標準ライブラリで済むものは追加導入しない
- 新規導入時のライセンスは **MIT / Apache-2.0 / BSD のみ**

### 5. Hono 単体構成を絶対に崩さない
- サーバー / ビュー / ルーティングはすべて Hono
- ビューは Hono JSX（サーバーサイドレンダリング）
- スタイリングは **Tailwind CSS (CDN版)** を Layout の `<head>` で読み込む（ビルド不要）
- クライアント JS は最小限の vanilla JS / htmx のみ
- **React / Next.js / Vue / Svelte などのフロントエンドフレームワークは絶対に導入しない**

### 6. セキュリティ
- XSS: Hono JSX の自動エスケープに任せる。`dangerouslySetInnerHTML` 系は使わない
- 入力バリデーション: サーバー側で Zod を必ず通す
- シークレット: `.env` に置き、キー名だけ書いた `.env.example` を併せて作成する（`.env` は他者と共有・配布しない）
- 仕様書の「セキュリティ要件」セクションを必ず反映

### 7. 仕様書にないものを勝手に追加しない
- 「あったほうが良さそう」「将来こうしたい」と感じても、仕様書にない機能は実装しない
- どうしても必要だと判断したら、実装に進まず **ユーザーに確認**

## 対話フロー

### Step 0: 対象 feature の特定と仕様書ファイルの動的検出

#### 0-1. 候補ディレクトリの列挙

1. `app/specs/` 配下のディレクトリを `ls` で確認（`archive/` は除外）
2. 各候補ディレクトリで **`scope.md` 以外の `*.md` が 1 件以上ある** ディレクトリを「実装可能な feature」として候補リストに加える
   - 候補が 0 件なら「[[spec-writing]] skill を先に実行して仕様書を整えてください」と案内して停止

#### 0-2. 対象 feature の確定（必ず明示同意を得る）

`app/specs/<feature-name>/` には **複数 feature が同居している可能性** があるため、以下のルールで対象を確定する:

- **ユーザー発話に feature 名・パスが明示されている場合**:
  - 例: 「`daily-budget` の実装を開始して」「`app/specs/daily-budget/` を実装して」
  - その feature が候補リストに **存在することを確認** したうえで採用
  - 存在しなければ「`app/specs/<feature-name>/` が見つかりません。実装可能な候補は次の通りです」と案内し、改めて確認
- **ユーザー発話に明示が無い場合**:
  - **候補が1件しか無くても勝手に進めない**
  - `AskUserQuestion` で候補を選択肢として提示し、対象を確定する
  - 質問例: 「どの feature を実装しますか? (A) `daily-budget` / (B) `weather-notifier` / ...」

> **重要**: 単数候補でも自動進行しない。誤った feature への実装着手は影響が大きいため、必ず明示同意を得る。

#### 0-3. 仕様書ファイルの動的検出

`<feature-name>` 確定後、対象ディレクトリ内のファイル一覧を取得して **仕様書ファイル名のリスト** を確定する:

- `ls app/specs/<feature-name>/*.md` → `scope.md` を除外
- 確定したファイル一覧を 1 行で提示し「これから読み込みます」と宣言

> ファイル名・数は機能ごとに違う前提で動く。`00-overview.md` が無かったり `05-` 以降があったりしても問題ない。

### Step 1: 仕様書群の読み込み（scope.md は読まない）

Step 0 で確定したファイル一覧を **並列に Read** する。具体的には:

- `app/specs/<feature-name>/` 配下の **`scope.md` 以外の `*.md` 全部**
- ルート `AGENTS.md`（プロジェクト方針）
- `.kiro/steering/code-conventions.md` / `.kiro/steering/testing-unit-patterns.md`（コーディング・テスト規約）

> `scope.md` は **読まない**。実装の根拠はすべて仕様書群に置く。

読み込み後、各仕様書の「位置づけ」と「依存関係」（先頭の `> このファイルの位置づけ:` / `> 依存:` / `> 並列可能:`）を抽出し、以下を 3〜5 行で要約:

- 何を作るか（概要系の仕様書から）
- ユーザーストーリーの数とID
- **どのファイルが何の責務か** と **並列着手可能ペア**
- 完成の定義（DoD）

> 仕様書に依存関係の記述が無い場合は、ファイル名の **番号プレフィックス** と **キーワード** から推定する（例: `data-model` を含むファイルは基盤、`integration` を含むファイルは最終フェーズ）。

### Step 2: 実装計画の提示（タスク管理ツールで可視化）

各仕様書の「実装着手順序」「実装手順（順序付きタスク）」「依存関係」を統合して、環境で利用可能なタスク管理ツール（TodoWrite / TaskCreate など）で **フェーズ単位** のタスクを登録する。

フェーズの作り方:

1. **Phase 0**: プロジェクトセットアップ（package.json / 依存関係 / tsconfig / biome / vitest）
2. **Phase 1 以降**: 仕様書ファイルの **番号プレフィックス順** に Phase を割り当てる
   - `data-model` 系ファイル → 基盤実装フェーズ（TDD）
   - `backend-api` / `frontend-view` 系ファイル → 仕様書側で「並列可能」と書かれていれば並列フェーズに、そうでなければ順次フェーズに
   - `integration` 系ファイル → 統合・結合テストフェーズ
   - 上記キーワードに当てはまらない仕様書（例: `external-api.md` / `cli.md` 等）は、その仕様書の冒頭にある「依存」「並列可能」記述を元に位置を決める
3. **最終 Phase**: 最終チェック（Biome / カバレッジ / DoD 確認 / 結合テスト）

典型例（spec-writing が生成した 5 ファイル構成のとき）:

```
Phase 0: プロジェクトセットアップ
Phase 1: データモデル実装（01-data-model.md ベース、TDD）
Phase 2A: バックエンド API 実装（02-backend-api.md ベース、TDD）
Phase 2B: フロントエンド ビュー実装（03-frontend-view.md ベース）
Phase 3: 統合・結合テスト（04-integration.md ベース）
Phase 4: 最終チェック（Biome / カバレッジ / DoD 確認）
```

各 Phase の終わりには「ここで一度動作確認・テスト通過の確認」を入れる。フェーズ構成は仕様書群の実態に合わせて柔軟に組み直す。

### Step 3: Phase 0 — プロジェクトセットアップ

`app/package.json` が存在するか確認。無ければ初期化、あれば不足を追加する形で進める。

1. `app/` 配下に `package.json` / `tsconfig.json` / `biome.json` / `vitest.config.ts` を整える。あわせて **`app/.npmrc` を必ず作成**する（npm キャッシュをワークスペース内に閉じ込めるため。最初の `npm install` より前に置くこと。詳細は [AGENTS.md](../../../AGENTS.md) の「npm キャッシュもリポジトリ内に閉じ込める」）:

   ```
   cache=../runtime/npm-cache
   ```
2. 必要な依存（すべて MIT / Apache-2.0 / BSD のものに限る）:
   - 本体: `hono`
   - ランタイム検証: `zod`, `@hono/zod-validator`
   - データ層: 仕様書の指定に従う（例: `better-sqlite3`、ファイル系なら不要）
   - 開発: `typescript`, `tsx`, **`@biomejs/biome@^2`**, `vitest`, `@vitest/coverage-v8`

   > **Biome は必ずメジャーを固定（`@^2`）して入れる。** バージョン指定なしで入れると将来 v3 以降が降ってきて、code-conventions.md の biome.json テンプレート（v2 形式）と食い違い、設定パースエラーで `biome check` が即失敗する。
3. `package.json` の `scripts` に **最低限この4つ** を定義する（ローカルツールは必ず script 経由で呼ぶ。`npx` は使わない）:

   ```json
   {
     "scripts": {
       "dev": "tsx watch src/index.ts",
       "test": "vitest --run",
       "test:coverage": "vitest --run --coverage",
       "lint": "biome check --write ."
     }
   }
   ```
4. `tsconfig.json` は code-conventions.md の通り（`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, パスエイリアス `@/* → src/*`）
5. `biome.json` は code-conventions.md のテンプレート（**v2 形式**）に準拠。特に次の3キーは**書かない**:
   - `$schema` — バージョン固定 URL でメンテ負債になる
   - `organizeImports`（トップレベル） — v2 で削除済みキー。書くと `Found an unknown key 'organizeImports'` で設定のパースに失敗し `biome check` が即エラー終了する
   - `linter.rules.recommended` — v2 では既定で有効。明示すると deprecated 警告が出る
6. `.env.example` を作成（中身が必要なら）
7. `npm install` を実行（runtime の npm を使う。`app/` 配下で実行する例）:

```bash
# macOS / Linux
cd app && PATH="$PWD/../runtime/node/bin:$PATH" npm install
```

```powershell
# Windows / PowerShell（npm ではなく npm.cmd。裸の npm は npm.ps1 に解決され ExecutionPolicy で落ちる）
cd app; $env:Path = "$PWD\..\runtime\node;$env:Path"; npm.cmd install
```

#### Phase 0 の完了条件（4つすべて通るまで Phase 1 に進まない）

セットアップ後、**ツールチェーンが実際に動くこと**を以下の順で確認する。1つでも失敗したら Phase 1 に進まず、原因を解決する（いずれも runtime の npm を PATH 付与で実行。Windows は `npm.cmd ...`）。

| # | 確認 | コマンド | 失敗したときの対処 |
|---|---|---|---|
| 1 | Biome が起動する | `npm exec --no -- biome --version` | バージョンが出ない → `@biomejs/biome@^2` が devDependencies に入り `npm install` が完了しているか確認 |
| 2 | Biome の設定が読める | `npm run lint` | `Found an unknown key ...` 等が出たら biome.json が v1 形式。上記5の3キーを削除する。`npm exec --no -- biome migrate` でも直る場合がある |
| 3 | テストが走る | `npm test` | 空テスト（`expect(true).toBe(true)` 程度）でも良いので正常終了させる |
| 4 | dev サーバが起動する | `npm run dev` → 起動確認後すぐ停止 | ポート衝突・`tsx` 未解決などを解消する |

> **Biome の実行結果の読み方（重要）**: Biome はエラーが無いとき stdout にほぼ何も出さない。**空出力は成功**であって失敗ではない。設定形式の誤りは必ず stderr にメッセージが出る。空出力を「失敗したのかも」と解釈して実行方法を次々変えて試さないこと。

> **なぜ先に確認するのか**: Phase 1 以降は「テスト → 実装 → テスト」の TDD サイクルを高速に回す。ツールチェーンが壊れた状態で実装に入ると、失敗がコードの問題かツールの問題か切り分けられなくなり、大きく時間を失う。

### Step 4: Phase 1 — データモデル（TDD）

> 仕様書群の中で **責務が「データモデル」** のファイル（典型的には `01-data-model.md` だが、ファイル名は機能によって変動）の「実装手順（順序付きタスク）」に従う。データモデル系ファイルが存在しない機能（例: 純粋な計算ツールで永続化が不要）ではこの Phase をスキップし、Step 2 で組んだ次のフェーズへ進む。

1. `src/types/` または対応モデル直下に型定義を追加
2. `src/schemas/` に Zod スキーマを追加（バリデーションルールは仕様書 §6 を反映）
3. **先にテストを書く**: `tests/lib/<entity>.test.ts` か `tests/models/<entity>.test.ts`（coding.md のディレクトリ規約に合わせる）
4. テスト失敗を確認
5. 実装を書く（保存先初期化 → list / get → create / update / remove → バリデーション）
6. テスト通過を確認
7. `npm run lint` で format / lint（出力が空なら成功。判定基準は Step 3 の「Biome の実行結果の読み方」参照）

> テストデータは毎テストでリセット可能にする（仕様書 §4 のリセット手段に従う / 一時ファイルや in-memory を活用）。

### Step 5: Phase 2A & 2B — バックエンド & フロントエンド（並列でも可）

> **責務が「バックエンド API」「フロントエンド ビュー」** のファイル（典型的には `02-backend-api.md` / `03-frontend-view.md` だが、ファイル名は機能によって変動）を扱う。仕様書冒頭の「並列可能」記述があれば並列、無ければ順次で進める。**該当する仕様書が無いフェーズはスキップ**（例: バックエンド不要な静的サイトなら 2A 無し / ヘッドレスのバッチなら 2B 無し）。

これらは **依存がデータモデルのみ** であることが多く、コンテキストが許せば順次・あるいは並列で進める。初学者向けには **2A → 2B の順次** で進めるのが分かりやすい（混乱を避けるため）。

#### Phase 2A: バックエンド API（`*backend-api*.md` 系）

1. `src/routes/<feature>.ts` を作成（`Hono` インスタンスを export）
2. `src/index.ts` に `app.route('/...', featureRoutes)` でマウント
3. 各エンドポイントに `zValidator` を組み合わせる（リクエスト検証）
4. `tests/routes/<feature>.test.ts` に Vitest テスト（Hono の `app.request()` でテスト）
5. 受け入れ基準（Given / When / Then）をテストケース化
6. テスト通過 → `npm run lint`

> エラーレスポンスは仕様書通りのステータスコード・JSON 形式を厳守。`app.onError()` で 500 系を共通化。

#### Phase 2B: フロントエンド ビュー（`*frontend-view*.md` 系）

1. `src/components/layouts/Layout.tsx` を作成（共通レイアウト）
   - `<head>` に Tailwind CDN を読み込む: `<script src="https://cdn.tailwindcss.com"></script>`
   - `<head>` に `meta viewport` を必要に応じて入れる
2. `c.setRenderer((content) => c.html(<Layout>{content}</Layout>))` でレンダラ登録
3. 各画面コンポーネントを `src/components/` に作成（仕様書の画面構成・JSX コンポーネント分割案に従う）
4. `src/routes/` の画面用ルートで `c.render(<Page />)` を返す
5. フォーム送信先・遷移は仕様書 §4 通り
6. スタイリングは Tailwind のユーティリティクラスを JSX の `class="..."` に書く（Hono JSX は `className` ではなく `class`）
   - 表現できない部分のみ `<style>` タグでインラインに最小限追加

> クライアント JS が必要な箇所（削除確認の `confirm()` 等）はインラインで最小限。htmx を使う指定があれば CDN 読み込みで対応（SRI 推奨。ただし Tailwind CDN は SRI 非提供）。

### Step 6: Phase 3 — 統合・結合テスト（`*integration*.md` 系）

> 責務が「統合・最終確認」のファイル（典型的には `04-integration.md`）を扱う。ファイル名は機能によって変動。

1. `tests/integration/<feature>.test.ts` に Hono `app.request()` を使った結合テストを書く
   - **主要ユーザーシナリオ1〜2本に絞る**（仕様書のシナリオ観点から最重要のもの。全観点の網羅はしない）
   - 画面遷移を伴うシナリオは「GET でページ取得 → フォーム相当の POST → 結果ページの HTML に期待する文字列が含まれる」の形で HTTP レベルで検証する
2. `npm test` で通過確認
3. `npm run dev` で起動し、主要シナリオを **ユーザー自身のブラウザで通してもらう**（「ブラウザで http://localhost:3000 を開いて、◯◯ができるか試してください」と具体的に案内する）
4. README.md（プロジェクト直下 or `app/README.md`）に起動手順と「個人の自己責任」明記を追記

> **Playwright 等ブラウザ操作型の E2E は使わない**（受講者PCへのブラウザダウンロードが必要になるため）。`npx playwright install` を提案・実行しないこと。

### Step 7: Phase 4 — 最終チェック

1. `npm run lint` を最終実行（出力が空なら成功）
2. `npm test` 全件成功を確認（単体テスト + 結合テスト）
3. `npm run test:coverage` でカバレッジ 10% 以上を確認
4. **統合系の仕様書**（典型: `04-integration.md`、無い機能では概要系仕様書）の「最終チェックリスト（Definition of Done）」を1項目ずつ確認し、未達があれば対応

### Step 8: 完成報告とアーカイブ提案

完成したら以下を 5〜10 行で報告:

- 実装したファイル一覧（主要ファイルだけ）
- テスト結果（単体・結合・カバレッジ）
- 動作確認手順（`npm run dev` → ブラウザで URL）
- DoD のチェック結果
- **アーカイブ提案**: 「`app/specs/<feature-name>/` を丸ごと `app/specs/archive/<feature-name>/` に移動しますか?」と確認（AGENTS.md 準拠。即実行はしない）

## 例外処理・つまずきポイント

### テストが何度も落ちるとき
- 「とりあえず通す」コードを書かない。**原因を診断**してから直す
- フックや CI を `--no-verify` などで迂回しない
- 落ち続けるテストがあれば、仕様書のどの受け入れ基準に対応するか再確認し、解釈に迷ったらユーザーに確認

### Biome が動かない / 出力が読めないとき

**まず「出力が空＝成功」を思い出す。** Biome はエラーが無いとき stdout にほぼ何も出さない。空出力を失敗と誤認して、実行方法（`npx` に変える、バイナリを直叩きする等）を次々試すのが最も時間を失うパターン。**エラーがあるときは必ず stderr にメッセージが出る。**

症状別の対処:

| 症状 | 原因 | 対処 |
|---|---|---|
| `Found an unknown key 'organizeImports'` 等で即エラー終了 | biome.json が v1 形式のまま（インストール済みは v2） | biome.json から `organizeImports` / `linter.rules.recommended` / `$schema` を削除する。`npm exec --no -- biome migrate` でも直る場合がある |
| `recommended` に関する deprecated 警告 | v2 では既定で有効なため明示不要 | `linter.rules.recommended` を削除 |
| コマンド自体が見つからない | `npm install` 未完了、または script 定義漏れ | `package.json` の `scripts.lint` と devDependencies を確認して `npm install` をやり直す |
| Windows で「スクリプトの実行が無効…`npm.ps1`」 | 裸の `npm` が `npm.ps1` に解決された | `npm.cmd` と書く（[AGENTS.md](../../../AGENTS.md) 参照）。`Set-ExecutionPolicy` は実行しない |

- **exit code だけで判断しない。** ターミナルラッパーの都合で実際の終了コードと表示が食い違うことがある。stderr のメッセージ内容を根拠にする
- 実行方法を変えて試すのは、上表の原因を潰し切ってからにする

### 仕様書に書かれていない判断が必要になったとき
- 既存の仕様書群とコーディング規約から **演繹できる範囲なら自走** する（例: 命名規則・ファイル配置）
- できないとき（例: バリデーションメッセージの文言、UI の色など）は **AskUserQuestion でまとめて確認**
- 勝手に追加機能を作らない

### 依存ライブラリのライセンスが疑わしいとき
- MIT / Apache-2.0 / BSD 以外なら **絶対に入れない**
- 代替が見つからなければユーザーに相談（標準ライブラリで代替できないか先に検討）

### Auto Mode で進めるとき
- 「明らかに無難な判断」（命名、配置、テスト追加など）は自走
- 「仕様書の解釈が割れる」「外部要素の選定」「破壊的な変更」は確認する

## 出力ルール

- ユーザーへの説明は **必ず日本語**で、簡潔に
- 専門用語の初出時はカッコ書きで補足
- Phase 移行時は「Phase X 完了 → Phase Y に進みます」と 1 行で宣言
- 大量のファイル生成中は進捗を 1〜2 行でこまめに報告
- テスト実行結果は **要点だけ**（通過件数・失敗件数）。フル出力はユーザーが求めたときだけ
- 仕様書を更新したい場合は、実装に進む前に必ずユーザーへ確認

## やってはいけないこと

- `app/specs/<feature-name>/scope.md` を読み込むこと（**スコープ調整用なので実装フェーズでは禁止**）
- **対象 feature の明示同意なしに実装着手すること**（引数指定が無い場合は候補が単数でも必ず `AskUserQuestion` で確認）
- 仕様書群が揃っていないのに実装に進むこと（[[spec-writing]] を先に促す）
- 仕様書にない機能を勝手に追加すること（必要なら必ずユーザーに確認）
- TypeScript の `any` / Non-null assertion (`!`) / `@ts-ignore` を使うこと
- `enum` を使うこと（`as const` + Union Type を使う）
- バリデーションを省略すること（外部入力は必ず Zod）
- React / Next.js / Vue / Svelte など Hono 単体構成を破る代替案を入れること
- MIT / Apache-2.0 / BSD 以外のライセンスのライブラリを追加すること
- 結合テスト（Hono `app.request()`）を省略すること（steering のテスト方針と矛盾する）
- Playwright 等ブラウザ E2E の導入や `npx playwright install` を提案・実行すること（本ハンズオンでは使わない方針）
- カバレッジ 10% 未満で「完成」とすること
- **Phase 0 の完了条件（Biome 起動 / Biome 設定パース / テスト実行 / dev 起動）を1つでも満たさないまま Phase 1 に進むこと**
- **`biome.json` に `$schema` / トップレベル `organizeImports` / `linter.rules.recommended` を書くこと**（v2 では不要、`organizeImports` は設定パースエラーの直接原因）
- **`@biomejs/biome` をバージョン指定なしで入れること**（必ず `@^2`。テンプレートとメジャーを揃える）
- **ローカルツールを `npx` で実行すること**（`npx biome` / `npx vitest`。`package.json` の script 経由で呼ぶ。直接実行が必要なら `npm exec --no -- <cmd>`）
- **Biome の出力が空なのを理由に、実行方法を次々変えて試すこと**（空出力は成功。エラーは必ず stderr に出る）
- `git init` / `git commit` など git 操作を行うこと（本ハンズオンでは git を使わない方針。受講者PCに git が無い前提で動く）
- `app/` の zip 化・持ち帰り用アーカイブの作成を提案・実行すること（本ハンズオンでは zip も使わない方針。成果物は `app/` 配下にそのまま残す）
- 仕様書を実装フェーズで勝手に書き換えること（変更が必要なら必ずユーザー確認の上で仕様書も更新）
- スコープを膨らませること（「ついでにこれも」を慎む）
