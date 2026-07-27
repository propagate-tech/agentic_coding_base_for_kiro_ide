---
inclusion: fileMatch
fileMatchPattern: ["app/**/*"]
---

# コーディングルール

`/app` 配下のファイルを作成・編集する際は、本ファイルの規約をすべて遵守すること。

---

## 1. TypeScript 規約

### 1.1 厳格設定
- `tsconfig.json` で `strict: true` を必須とし、以下も有効化する。
  - `noUncheckedIndexedAccess: true`
  - `noImplicitOverride: true`
  - `exactOptionalPropertyTypes: true`
- `target` は `ES2022` 以上、`module` は `ESNext`、`moduleResolution` は `Bundler`。

### 1.2 型の使い分け
- 原則 `type` を使用する。宣言マージが必要な場合のみ `interface`。
- `enum` は使用禁止。代わりに `as const` オブジェクト + Union Type を使う。
  ```ts
  // NG
  enum Status { Active, Inactive }

  // OK
  const Status = { Active: 'active', Inactive: 'inactive' } as const;
  type Status = (typeof Status)[keyof typeof Status];
  ```

### 1.3 禁止事項
- `any` 禁止。やむを得ず外部由来の型不明値を扱う場合は `unknown` + 型ガードで絞る。
- Non-null assertion (`!`) 禁止。事前に `if` で絞り込む、もしくは Zod で検証する。
- `@ts-ignore` 禁止。やむを得ない場合は `@ts-expect-error` + 理由コメント必須。

### 1.4 型の明示
- export される関数の戻り値型は明示する（型推論に頼らない）。
- 内部 helper の戻り値型は推論に任せてよい。

### 1.5 ランタイム検証
- 外部入力（HTTP リクエスト、環境変数、外部 API レスポンス）は必ず Zod でバリデーション。
- スキーマからの型生成は `z.infer<typeof schema>` を使う。型と検証ロジックの二重管理を避ける。

---

## 2. コーディングスタイル

### 2.1 Formatter / Linter
- **Biome** を採用する（`@biomejs/biome`）。**インストールはメジャーを固定して `@biomejs/biome@^2` で行う**（下記テンプレートは v2 系の設定形式。バージョンが揃っていないと設定パースエラーになる）。
- 設定ファイル: `app/biome.json`
- **実行は必ず `package.json` の script 経由**にする。`package.json` に次を定義し、`npm run test` 前に必ず `npm run lint` を実行する:
  ```json
  { "scripts": { "lint": "biome check --write ." } }
  ```
  - **`npx biome ...` は使わない。** `npx` はローカルに目的のパッケージを見つけられないと判断するとレジストリから**別バージョンを取得して実行**してしまい、設定形式の不一致（後述の v1 / v2 差分）を再発させる。script 経由なら `node_modules/.bin` の固定バージョンだけが走る。
  - `npm` は **runtime 配下**（`runtime/node/bin`、Windows は `runtime\node`）のものを使い、実行時に PATH へ runtime の bin を付与する（詳細は `AGENTS.md`「実行環境（Node.js / npm / npx）」）。Windows では `npm.cmd run lint` と `.cmd` を明示する（裸だと `npm.ps1` に解決され ExecutionPolicy で失敗する）。
- 推奨設定（**Biome v2.x 前提**）:
  ```json
  {
    "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
    "javascript": {
      "formatter": {
        "quoteStyle": "single",
        "semicolons": "always",
        "trailingCommas": "all"
      }
    },
    "linter": {
      "enabled": true,
      "rules": {
        "style": { "noNonNullAssertion": "error" }
      }
    }
  }
  ```
- **biome.json に書いてはいけないキー（v2）**:
  - `$schema` — バージョン固定 URL になりメンテ負債。省略しても動作に影響しない
  - `organizeImports`（トップレベル） — v2 で**削除済み**。書くと `Found an unknown key 'organizeImports'` で設定のパースに失敗し、`biome check` が即エラー終了する（import 整理は §2.3 のとおり既定で有効）
  - `linter.rules.recommended` — v2 では既定で有効。明示すると deprecated 警告が出る

  > v1.x を使わざるを得ない場合のみ、`organizeImports: { enabled: true }` をトップレベルに、`linter.rules` に `"recommended": true` を追加する。**ただし本ハンズオンでは v2 固定（`@^2`）を前提とする。**

- **実行結果の判定**: Biome はエラーが無いとき stdout にほぼ何も出さない。**空出力は成功**であって失敗ではない。設定形式の誤りは必ず stderr にメッセージ（`Found an unknown key ...` 等）が出る。空出力を失敗と誤認して実行方法を次々変えないこと。設定形式のエラーが出た場合は上記「書いてはいけないキー」に沿って手で直すか、`npm exec --no -- biome migrate` を試す（`--no` はローカルに無いときレジストリから取得せず失敗させるフラグ。意図しない別バージョンの実行を防ぐ）。

### 2.2 命名規則

| 対象 | ルール | 例 |
|---|---|---|
| ファイル名 | kebab-case | `user-service.ts`, `login-form.tsx` |
| 変数 / 関数 | camelCase | `getUserById`, `isActive` |
| 型 / クラス / コンポーネント | PascalCase | `UserProfile`, `LoginForm` |
| 定数（モジュール定数） | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| boolean 変数 | `is` / `has` / `can` プレフィックス | `isLoading`, `hasError` |
| Zod スキーマ | `xxxSchema` 接尾辞 | `userSchema` |

### 2.3 import 順序
Biome の import 整理に任せる（v2 では `assist.actions.source.organizeImports` が担当。**既定で有効なので biome.json への設定記述は不要**。§2.1 のとおりトップレベルの `organizeImports` は書かない）。手動で書く場合は以下の順:
1. Node.js 標準モジュール (`node:fs` 等)
2. 外部パッケージ (`hono`, `zod` 等)
3. 内部エイリアス (`@/...`)
4. 相対パス (`./`, `../`)
5. 型のみ import (`import type { ... }`)

### 2.4 関数とファイルの粒度
- 1 ファイル 1 責務。1 関数あたり 50 行を目安に、超える場合は分割を検討。
- 引数が 4 個以上になる場合はオブジェクトでまとめる。
- アロー関数を基本とするが、トップレベルの export 関数は `function` 宣言でもよい。

### 2.5 コメント
- 「何をしているか」は書かない（コードを読めばわかる）。
- 「なぜそうしているか」のみ書く（仕様の背景、回避策の理由など）。
- JSDoc は public な API（export 関数）にのみ最小限で。

---

## 3. ディレクトリ構成

`/app` 配下は以下の構成を厳守する。

```
/app
├── src/
│   ├── index.ts            # エントリーポイント（Hono app 生成 & ルート登録のみ）
│   ├── routes/             # Hono ルートハンドラ（機能単位でファイル分割）
│   │   ├── users.ts
│   │   └── ...
│   ├── lib/                # 純粋ロジック・ユーティリティ（フレームワーク非依存）
│   ├── schemas/            # Zod スキーマ
│   ├── components/         # Hono JSX コンポーネント
│   │   └── layouts/        # レイアウトコンポーネント
│   ├── middleware/         # カスタムミドルウェア
│   └── types/              # プロジェクト横断の型定義
├── tests/                  # Vitest テスト（src と同じ階層構造を踏襲）
│   └── integration/        # Hono app.request() による結合テスト
├── public/                 # 静的ファイル（CSS, 画像など）
├── specs/                  # 仕様書（AGENTS.md 参照）
│   └── archive/
├── .npmrc                  # npm キャッシュをワークスペース内に閉じ込める設定（AGENTS.md 参照）
├── biome.json
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### 3.1 配置ルール
- **ビジネスロジックは `lib/` または `routes/` 内に書き、`components/` には書かない**。
- **`schemas/` のスキーマは routes と lib の双方から import 可。逆方向の依存は禁止**。
- テストファイルは `tests/` 配下に `src/` と対応する階層で配置（例: `src/lib/foo.ts` → `tests/lib/foo.test.ts`）。
- 共通型は `types/` に置くが、特定モジュール固有の型は同じファイル内 or 隣接ファイルに置く。

### 3.2 import エイリアス
- `tsconfig.json` で `@/*` → `src/*` をエイリアス設定。
- `src` 配下からの import は相対パスより `@/` を優先（ただし 1 階層上ならば `./` でも可）。

---

## 4. Hono 実装規約

### 4.1 アプリ構造
- `src/index.ts` は薄く保つ。app 生成・グローバルミドルウェア適用・サブルート登録のみ。
- 機能単位のルートは `src/routes/<feature>.ts` に切り出し、`app.route('/<feature>', featureRoutes)` でマウントする。
  ```ts
  // src/routes/users.ts
  import { Hono } from 'hono';
  export const userRoutes = new Hono();
  userRoutes.get('/', (c) => c.json({ users: [] }));
  ```

### 4.2 型付き Hono インスタンス
- `Bindings`（環境変数）と `Variables`（コンテキスト変数）の型は必ず指定する。
  ```ts
  type Env = {
    Bindings: { DATABASE_URL: string };
    Variables: { userId: string };
  };
  const app = new Hono<Env>();
  ```

### 4.3 バリデーション
- リクエスト（query / param / json / form）は必ず `@hono/zod-validator` で検証する。
  ```ts
  import { zValidator } from '@hono/zod-validator';
  app.post('/users', zValidator('json', userSchema), (c) => {
    const data = c.req.valid('json'); // 型付き
    return c.json({ ok: true });
  });
  ```
- スキーマは `src/schemas/` に切り出し、ルートからは import する。

### 4.4 レスポンス
- 必ず `c.json()` / `c.text()` / `c.html()` を使い、`Response` を直接 new しない。
- 成功時は 200/201/204、クライアントエラーは 400 系、サーバーエラーは 500 系をステータスコード明示で返す。
  ```ts
  return c.json({ data }, 200);
  return c.json({ error: 'NOT_FOUND' }, 404);
  ```

### 4.5 エラーハンドリング
- ルートハンドラ内では原則 `throw` せず、エラーレスポンスを直接返す。
- 共通エラー処理は `app.onError()` で集約する。
- バリデーションエラーは `zValidator` の第3引数で統一フォーマットに変換する。
  ```ts
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'INTERNAL_SERVER_ERROR' }, 500);
  });
  ```

### 4.6 ミドルウェア
- グローバル: `app.use('*', logger())` 等は `index.ts` に集約。
- ルート固有: `app.use('/admin/*', authMiddleware)` のようにスコープを明示。
- カスタムミドルウェアは `src/middleware/` に配置。

### 4.7 JSX / ビュー
- Hono JSX (`hono/jsx`) を使用する。React・Vue 等は導入しない。
- レイアウトは `c.setRenderer()` + `c.render()` で共通化する。
  ```ts
  app.use('*', async (c, next) => {
    c.setRenderer((content) => c.html(<Layout>{content}</Layout>));
    await next();
  });
  ```
- コンポーネントは `src/components/` 配下に `.tsx` で配置。Props には型を必ず付ける。

### 4.8 スタイリング
- **Tailwind CSS (CDN版)** を採用する。Layout コンポーネントの `<head>` 内で読み込む:
  ```tsx
  <script src="https://cdn.tailwindcss.com"></script>
  ```
- JSX 内に `class="..."` でユーティリティクラスを書く（Hono JSX は `class` 属性を使う。`className` ではない）。
- レスポンシブ対応は Tailwind のブレークポイント (`sm:` / `md:` / `lg:`) を使う。
- どうしても Tailwind で表現できないスタイルだけ `<style>` タグでインラインに最小限追加する。
- 外部 CDN 利用なので「個人の自己責任で利用するものとする」の範疇。

### 4.9 RPC / 型共有
- クライアント側で型を共有する場合は `app.route()` の戻り値型を export し、`hc<typeof app>()` で型付きクライアントを生成する。
