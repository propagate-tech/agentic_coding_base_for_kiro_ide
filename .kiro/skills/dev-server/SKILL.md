---
name: dev-server
description: 「開発サーバ起動して」「サーバ立ち上げて」「サーバ止めて」「サーバ再起動」などの依頼を契機に発動し、`app/` 配下の Hono アプリの開発サーバを起動・停止・再起動・状態確認するための skill。バックグラウンド実行・起動ログ待機・ポート競合の安全確認まで面倒を見る。サーバの起動コマンドや停止方法を覚えていない初学者向け。
---

# dev-server skill

## このスキルが目指すゴール

ユーザーが「サーバ起動して」「サーバ止めて」のような一言で、

1. `app/` 配下の Hono 開発サーバを
2. バックグラウンドで安全に起動・停止・再起動・状態確認できる

ようにすること。**「サーバが起動したのかどうか分からない」「止め方が分からなくてポートを掴んだまま放置」「同じサーバを二重起動してポート競合」を防ぐ**ことが最大の狙い。

## 起動トリガー (発動キーワード例)

以下のような依頼が来たら、迷わずこの skill を発動する:

### 起動

- 「開発サーバ起動して」「サーバ立ち上げて」「dev サーバ起動」
- 「アプリ動かして」「ローカルで起動して」「`npm run dev` して」

### 停止

- 「サーバ止めて」「サーバ停止」「dev 落として」
- 「シャットダウンして」「終了して」（文脈がサーバ関連の場合）

### 再起動

- 「サーバ再起動」「リスタート」「立て直して」

### 状態確認

- 「サーバ動いてる?」「サーバの状態は?」「ポート 3000 誰か使ってる?」

## 想定ユーザー

- ビジネスパーソン、または初学者エンジニア
- 「ターミナルでサーバを起動した後、どうやって止めるんだっけ?」が曖昧な人
- バックグラウンドで動いている開発サーバを忘れて二重起動してしまう人

そのため、**専門用語の初出時はカッコ書きで補足**する。例:

- 「バックグラウンド (画面に出ない裏側で動かす実行モード)」
- 「ポート (ネットワークで通信に使う番号の窓口)」

## 絶対に守る制約

### 1. 起動コマンドは `package.json` の `dev` スクリプトを使う

- `app/package.json` の `scripts.dev` を実行する（直接 `tsx` 等を呼ばない）
- `dev` スクリプトが定義されていなければ起動せずに報告して停止
- **`npm` は runtime 配下のものを使う**（グローバルの node/npm は存在しない前提）。実行時に PATH へ runtime の bin を付与する。詳細は [AGENTS.md](../../../AGENTS.md) の「実行環境（Node.js / npm / npx）」を参照

### 2. 必ずバックグラウンドで起動する

- Bash の `run_in_background` を使う。前景実行すると以降の作業がブロックされる
- 起動後は **ログ出力先（出力ファイルパス）と task_id を必ず控えて** ユーザーに報告する。停止時にこの ID が必要

### 3. 起動成功判定は「ログに起動シグナルが現れるまで」を待つ

- 起動シグナルの例: `Server running at`, `Listening on`, `started`, `http://localhost:`
- 待機は最大 30 秒。タイムアウトしたらログ末尾をユーザーに見せて停止する
- 「コマンドを投げただけ」では起動完了と見なさない（プロセスがクラッシュしていても気付けない）

### 4. ポート競合を勝手に解決しない

- 起動前に対象ポート (デフォルト 3000) が空いているか確認する。受講者PCの OS に応じてコマンドを使い分ける:
  - macOS: `lsof -i :3000`（無ければ `netstat -an | grep 3000`）
  - Windows (PowerShell): `Get-NetTCPConnection -LocalPort 3000`（無ければ `netstat -ano | findstr :3000`）
- 既に誰かが使っていたら **占有プロセスを表示** して `AskUserQuestion` で確認:
  - 「既存サーバを止めて起動し直す」
  - 「別ポートで起動する」
  - 「中止する」
- **無確認で `kill` してはいけない**（ユーザーが意図的に動かしている別作業の可能性）

### 5. 停止は task_id を使った TaskStop を最優先

- このセッション内で起動したサーバは task_id が分かっているので、まず TaskStop で停止
- task_id が不明（過去セッションの残骸など）の場合のみ、`lsof -i :3000` でプロセスを特定 → ユーザー確認の上で `kill`
- 一括 `pkill -f tsx` のような **広い範囲の kill は使わない**（他作業を巻き込む）

### 6. 状態確認は破壊的操作を含めない

- `lsof`, `ps`, ログ末尾参照のみ。プロセスを止めない

## 対話フロー

### Step 0: 前提チェック（並列）

プロジェクトルートを基準に相対パスで確認する（環境によって配置パスが異なるため、絶対パスを決め打ちしない）:

```bash
# 1. app/ ディレクトリと package.json
ls app/package.json

# 2. dev スクリプトの存在確認
grep -E '"dev"\s*:' app/package.json
```

無ければ「`app/package.json` に `dev` スクリプトが見つかりません」とユーザーに伝えて停止。

### Step 1A: 起動の場合

#### 1A-1. ポート空きチェック

受講者PCの OS に応じて実行する:

```bash
# macOS
lsof -i :3000 || echo "OK: port 3000 is free"
```

```powershell
# Windows / PowerShell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if (-not $?) { "OK: port 3000 is free" }
# 上記が使えない場合: netstat -ano | findstr :3000
```

占有されていたら、占有プロセスの情報（PID, COMMAND）を表示して `AskUserQuestion` で次のアクションを確認。

#### 1A-2. バックグラウンド起動

プロジェクトルートから相対パスで実行する。`npm` は runtime 配下のものを使うため、PATH に runtime の bin を付与する（`app/` に入るので runtime は1つ上の階層）:

```bash
# macOS / Linux
cd app && PATH="$PWD/../runtime/node/bin:$PATH" npm run dev
```

```powershell
# Windows / PowerShell
cd app; $env:Path = "$PWD\..\runtime\node;$env:Path"; npm run dev
```

を `run_in_background: true` で起動。返却された `task_id` と `output` パスを控える。

> グローバルの node/npm は存在しない前提。必ず runtime 配下の npm を PATH 付与で使う（[AGENTS.md](../../../AGENTS.md) 参照）。パッケージマネージャの読み替え指示がある場合も、対象バイナリは runtime 配下のものを用いる。

#### 1A-3. 起動ログ待機

`sleep` を含むポーリングループは環境によってブロックされるため使わない。また **`timeout` コマンドは macOS に標準搭載されていない**（Windows の `timeout` も別物）ため使わない。代わりに、setup 済みなら必ず存在する **同梱 Node（`runtime/node`）のワンライナー** で「起動シグナルが出るまで最大30秒待つ」を1コマンドで実現する:

```bash
# macOS / Linux（プロジェクトルートから実行）
runtime/node/bin/node -e 'const fs=require("fs");const f=process.argv[1];const re=/(Server running|Listening on|http:\/\/localhost:)/;const t0=Date.now();(function poll(){let s="";try{s=fs.readFileSync(f,"utf8")}catch(e){}if(re.test(s)){console.log("STARTED");process.exit(0)}if(Date.now()-t0>30000){console.log("TIMEOUT");process.exit(1)}setTimeout(poll,500)})();' "<output_path>"
```

```powershell
# Windows / PowerShell（プロジェクトルートから実行。スクリプト文字列は上と同一）
runtime\node\node.exe -e 'const fs=require("fs");const f=process.argv[1];const re=/(Server running|Listening on|http:\/\/localhost:)/;const t0=Date.now();(function poll(){let s="";try{s=fs.readFileSync(f,"utf8")}catch(e){}if(re.test(s)){console.log("STARTED");process.exit(0)}if(Date.now()-t0>30000){console.log("TIMEOUT");process.exit(1)}setTimeout(poll,500)})();' "<output_path>"
```

- 0.5 秒ごとにログファイルを先頭から読み直して判定するので、待機開始前に出力済みのシグナルも取りこぼさない
- `TIMEOUT` になったら出力ファイルの末尾 50 行（macOS: `tail -n 50 "<output_path>"` / Windows: `Get-Content "<output_path>" -Tail 50`）をユーザーに見せて、原因切り分けを促す（依存欠落 / 型エラー / ポート競合 等）

#### 1A-4. 結果報告

本ハンズオンは **受講者自身の持ち込みPC** 上で動く。開発サーバも受講者のPC内で起動するので、**同じPCのブラウザから `http://localhost:3000` でアクセスする**（外部公開やIPの取得は不要）。

```
✅ 開発サーバを起動しました。

- ブラウザで開く: http://localhost:3000
- task_id: <id>（停止時に使います）
- ログ: <output_path>

停止したいときは「サーバ止めて」と伝えてください。
```

> 起動したのにブラウザで開けない場合、まず起動ログにエラーが出ていないか（依存欠落 / 型エラー / ポート競合）を確認する。ポート番号が 3000 以外に変わっていないか、`app/src/index.ts` の `serve()` のポート設定とログの `http://localhost:...` の番号も突き合わせる。**持ち込みPCでは同一PCからのアクセスなので `localhost` バインドのままで問題ない**（`0.0.0.0` への変更は不要）。

### Step 1B: 停止の場合

#### 1B-1. 稼働中タスクの特定

- セッション内で起動した task_id が分かっていればそれを優先
- 不明な場合はポート占有プロセスを特定し（macOS: `lsof -i :3000` / Windows: `netstat -ano | findstr :3000`）、`AskUserQuestion` で「このプロセスを止めますか?」と確認

#### 1B-2. 停止実行

- セッション内タスクなら `TaskStop` ツールで停止
- 過去セッションの残骸なら、ユーザー承認の上で対象PIDを停止する:
  - macOS: `kill <PID>`（`kill -9` は最終手段。まずは通常 `kill` で）
  - Windows: `Stop-Process -Id <PID>`（強制は `-Force`。または `taskkill /PID <PID> /F`）

#### 1B-3. 停止確認

```bash
# macOS
lsof -i :3000 || echo "OK: port 3000 is free"
```

```powershell
# Windows / PowerShell
netstat -ano | findstr :3000; if (-not $?) { "OK: port 3000 is free" }
```

ポートが空いたことを確認して報告:

```
🛑 開発サーバを停止しました。

- ポート 3000 は解放されました。
- 再度起動したいときは「サーバ起動して」と伝えてください。
```

### Step 1C: 再起動の場合

- Step 1B（停止）→ Step 1A（起動）を順に実行
- 停止確認まで完了してから起動に進む（同時並行しない）

### Step 1D: 状態確認の場合

並列で以下を実行して整形:

```bash
# 1. ポート占有状況（macOS）
lsof -i :3000 || echo "free"
```

```powershell
# 1. ポート占有状況（Windows / PowerShell）
netstat -ano | findstr :3000; if (-not $?) { "free" }
```

```
# 2. セッション内で起動した task の状態（task_id が分かる場合）
#    → 手元の記録から該当 task_id を参照
```

報告例:

```
📡 現在の状態

- ポート 3000: 使用中 (PID 12345, COMMAND: node)
- このセッションで起動した dev サーバ: あり (task_id: ...)
- ブラウザで開く: http://localhost:3000
```

または

```
📡 現在の状態

- ポート 3000: 空き
- 起動中の dev サーバ: なし
```

## やってはいけないこと

- 開発サーバを **前景実行** すること（以降の操作がブロックされる）
- 起動コマンドを投げただけで **起動成功と判断** すること（クラッシュを見落とす）
- ポート 3000 が占有されているときに **無確認で `kill`** すること
- `pkill -f tsx` / `pkill -f node`（Windows なら `taskkill /IM node.exe /F` / `Stop-Process -Name node`）のような **広範囲な kill** で巻き添え停止すること
- `package.json` を **無視して直接 `tsx` 等を呼び出す** こと（スクリプトを介すことで設定の一貫性を保つ）
- セッションをまたいで残った task_id を当て推量で TaskStop すること（無効な ID で空振る）
- 停止後にポートが解放されたか **確認せず完了報告** すること
- 専門用語をそのまま投げて初学者を置いていくこと

## ヒント: 初学者へのよくある声かけ例

- 「開発サーバは『下書き専用のお店』のようなもので、コードを書き換えるとすぐ反映されます」
- 「バックグラウンド起動なので、画面には見えませんが裏で動いています。お使いのPCのブラウザで http://localhost:3000 を開けば触れます」
- 「止め忘れるとポートを掴んだままになり、次に同じサーバを起動するときに『すでに使われている』と怒られます。終わったら止める癖をつけると安心です」
- 「`Ctrl+C` でも止められますが、バックグラウンド起動の場合は『サーバ止めて』と伝えてもらえれば task_id 経由で確実に止めます」
