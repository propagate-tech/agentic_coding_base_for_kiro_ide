---
inclusion: fileMatch
fileMatchPattern: ["app/**/*"]
---

# テストルール

`/app` 配下にてアプリケーションファイルを作成・編集した後は必ず本ファイルの規約を遵守したテストを実施すること。

---

## テスト
> `npm` はグローバルではなく **runtime 配下**（`runtime/node/bin`、Windows は `runtime\node`）のものを使う。実行時に PATH へ runtime の bin を付与すること（詳細は `AGENTS.md`「実行環境（Node.js / npm / npx）」）。Windows では `npm.cmd` と `.cmd` を明示する（裸だと `npm.ps1` に解決され ExecutionPolicy で失敗する）。以下のコマンドはこの前提で読み替える。
>
> **ローカルツール（vitest / biome）は `npx` ではなく `package.json` の script 経由で呼ぶ。** `npx` はローカルに見つからないと判断するとレジストリから別バージョンを取得して実行するため、意図しないバージョンが走る。直接実行が必要なときのみ `npm exec --no -- <cmd>` を使う。

- TDDを順守
    - 処理変更の都度、`npm run test`を実行し常に成功させる
    - Formatter/Linterも常に通す（`npm run lint`。出力が空なら成功。詳細は `code-conventions.md` §2.1）
- テストには'Vitest'を用いる
- テストカバレッジは10%以上を必達とし100%を目指すこと
    - カバレッジ取得コマンド: `npm run test:coverage`（`package.json` に `"test:coverage": "vitest --run --coverage"` を定義しておく）
- 全てのコード作成、修正完了時に Hono の `app.request()` を用いた結合テストでシナリオ検証を行う
    - 結合テストは全ての単体テスト完了後に最終チェックとして実施する
    - 主要ユーザーシナリオ1〜2本に絞る（ハンズオンの時間内に収めるため）
    - 結合テストも Vitest で実行し、`tests/integration/` 配下に配置する（HTTPリクエスト→レスポンスの流れを丸ごと検証する）
    - **Playwright 等ブラウザ操作型の E2E は使用しない**（受講者PCへの数百MBのブラウザダウンロードが必要になるため。`npx playwright install` を実行しないこと）
    - 画面表示の最終確認は、開発サーバを起動して受講者自身がブラウザで行う
- テストデータは毎回リセット可能にし他テストと状態を共有しない