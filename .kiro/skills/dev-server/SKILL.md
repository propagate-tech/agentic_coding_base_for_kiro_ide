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

受講者PCは **macOS（Apple Silicon / Intel）と Windows（x64 / ARM64）の両方**を想定する。判定処理は OS 共通の補助スクリプトに任せ、OS ごとに違うのは「コマンドの呼び出し方」だけにしている。

## 起動トリガー (発動キーワード例)

以下のような依頼が来たら、迷わずこの skill を発動する:

- 起動: 「開発サーバ起動して」「サーバ立ち上げて」「dev サーバ起動」「アプリ動かして」「ローカルで起動して」「`npm run dev` して」
- 停止: 「サーバ止めて」「サーバ停止」「dev 落として」「シャットダウンして」「終了して」（文脈がサーバ関連の場合）
- 再起動: 「サーバ再起動」「リスタート」「立て直して」
- 状態確認: 「サーバ動いてる?」「サーバの状態は?」「ポート 3000 誰か使ってる?」

## 想定ユーザー

- ビジネスパーソン、または初学者エンジニア
- 「ターミナルでサーバを起動した後、どうやって止めるんだっけ?」が曖昧な人
- バックグラウンドで動いている開発サーバを忘れて二重起動してしまう人

そのため、**専門用語の初出時はカッコ書きで補足**する。例:

- 「バックグラウンド (画面に出ない裏側で動かす実行モード)」
- 「ポート (ネットワークで通信に使う番号の窓口)」
- 「プロセス (PC の中で動いているプログラム1つ分)」「PID (プロセスに付く番号)」

---

## 基本の考え方（最初に読む）

### 1. 判定は補助スクリプトの「結果ファイル」で行う

Kiro のコマンド実行ツールは、環境によって **stdout（画面に出る文字）が読めない・前のコマンドの出力が混ざる・終了コードが当てにならない** ことがある（Windows で実際に発生。macOS でも長めのコマンドで出力が空のまま返ることがあった）。そこで、ポート確認・起動待ち・停止確認はすべて同梱の補助スクリプトに任せ、**結果は `read_file` で結果ファイルを読んで判定する**。stdout と終了コードは補助として扱う。

- スクリプト: `<WS>/.kiro/skills/dev-server/scripts/dev-server-check.mjs`（Node 標準モジュールのみ・両 OS 共通）
- 結果ファイル: `<WS>/runtime/tmp/dev-server/<resultId>.json`（1行の JSON）
- `<WS>` は **ワークスペース直下の絶対パス**。セッション情報に表示されるワークスペースのパスを使う。`$PWD` や `cwd` から組み立てない（`cwd` が効かないことがある）

| サブコマンド | 何をするか | 成功（`ok: true`、終了コード 0） |
|---|---|---|
| `port <port>` | ポートが空いているか（接続を試すだけ） | 空いている（`result: "free"`）。使用中は `result: "in_use"` で `ok: false` |
| `wait <url> <秒>` | HTTP 応答が返るまで 0.5 秒間隔で待つ | 応答があった（`result: "up"`。404 や 500 でも起動済み） |
| `free <port> <秒>` | ポートが解放されるまで待つ | 解放された（`result: "free"`） |
| `who <port>` | 待ち受け中のプロセスの PID・コマンドを表示（止めはしない） | 調べられた（`processes` に一覧） |
| `clean` | 結果ファイルをまとめて削除（自分の結果ファイルだけ残る） | 削除できた |

- 必ず `--id <resultId>` を付ける。`resultId` は英数字・`-`・`_` のみ。**実行ごとに別の名前にする**（例: `status-port-1` → 再試行なら `status-port-2`）。同じ名前を使い回すと古い結果を読み違える
- 引数の誤り・タイムアウト・想定外のエラーでも、必ず `ok: false` の JSON と終了コード 1 が返る（`result` は `usage_error` / `timeout` / `error`）
- **読む → 消す の順で1つずつ行う**: `read_file` で読み終えてから `delete_file` で削除する（同時に投げると読む前に消えることがある）。`delete_file` が使えない場合は、作業の最後に `clean` を1回実行する
- ポートの空き判定は接続を試すだけで、`lsof` / `netstat` / `Get-NetTCPConnection` は使わない。`who` だけは PID を調べるため内部で `lsof`（macOS）/ `netstat -ano`（Windows）を使う

### 2. OS ごとの違いは「呼び出し方」だけ

| 項目 | macOS | Windows |
|---|---|---|
| node のパス | `<WS>/runtime/node/bin/node` | `<WS>\runtime\node\node.exe` |
| npm | `"<WS>/runtime/node/bin/npm"`（絶対パス） | `npm.cmd`（必須） |
| PATH の区切り | `:` | `;` |
| 引用付きパスの実行 | `"<path>" args` | `& "<path>" args` |
| ツール名（確認済みの例） | `execute_bash` / `control_bash_process` | `execute_pwsh` / `control_pwsh_process` |
| 起動コマンドの `;` 連結 | 使わない（不要） | `$env:Path = "..."; npm.cmd run dev` の形は動作確認済み |

- **ツール名は決め打ちしない。** 実行中のセッションで使えるツール一覧を確認し、上の表と違えばそちらに従う。以降の本文では「コマンド実行ツール」（`execute_*`）・「バックグラウンドプロセスツール」（`control_*_process`）と呼ぶ。`get_process_output` / `list_processes` / `read_file` / `delete_file` / `list_directory` は両 OS 共通
- パスはスペースや丸かっこを含むことがある（例: `agentic_coding_base_for_kiro_ide-main (1)`）。**node・スクリプト・npm は必ず絶対パスを引用符で囲んで呼ぶ**
- macOS で npm を絶対パスで呼ぶのは、素の `npm` がシェルの alias（`~/.zshrc` などに書かれた別名）に横取りされることがあるため（実際に `npm` が警告を出すだけの alias に置き換わっていた PC があった）
- Windows で `npm` と裸で書くと `npm.ps1` に解決され ExecutionPolicy で失敗する。必ず `npm.cmd`。`Set-ExecutionPolicy` は実行しない（[AGENTS.md](../../../AGENTS.md)「Windows では必ず `.cmd` を明示する」）

#### 補助スクリプトの呼び方（コマンド実行ツールで前景実行してよい）

```bash
# macOS（zsh / bash）
"<WS>/runtime/node/bin/node" "<WS>/.kiro/skills/dev-server/scripts/dev-server-check.mjs" port 3000 --id status-port-1
```

```powershell
# Windows（PowerShell）。先頭の & が必要（引用符で囲んだパスをコマンドとして実行するため）
& "<WS>\runtime\node\node.exe" "<WS>\.kiro\skills\dev-server\scripts\dev-server-check.mjs" port 3000 --id status-port-1
```

以降の手順では、この呼び出しを **`check <サブコマンド> ... --id <resultId>`** と略記する。実行後は `<WS>/runtime/tmp/dev-server/<resultId>.json` を `read_file` で読む。

### 3. 守る制約

- 起動は `app/package.json` の `dev` スクリプト経由（直接 `tsx` 等を呼ばない）。`dev` が無ければ起動せず報告して止まる
- Node / npm は `runtime/node` のものだけを使う。PATH はコマンドの中でその場だけ付与し、永続的に変えない（[AGENTS.md](../../../AGENTS.md)「実行環境」）
- 開発サーバは必ず **バックグラウンドプロセスツール**で起動する。コマンド実行ツールで前景実行すると以降の作業が止まる
- **Windows ではコマンド実行ツールで `npm.cmd` を前景実行しない。** cmd バッチが途中で止まると「バッチ ジョブを終了しますか (Y/N)?」でシェルが固まり、以降のコマンドが実行されなくなる。判定は `node.exe` を直接呼ぶ補助スクリプトで行う
- ファイルの有無の確認は `read_file` / `list_directory` で行い、`ls` / `Test-Path` の出力に頼らない
- ポート競合を勝手に解決しない。**無確認で kill しない**
- `pkill -f node` / `pkill -f tsx` / `taskkill /IM node.exe` / `Stop-Process -Name node` のような **広い範囲の kill はしない**
- kill 系（`kill` / `Stop-Process` / `taskkill`）や削除系が **Kiro の権限設定で拒否されたら、別の書き方で回避しない**。コマンドを示してユーザーに手動実行を頼む
- git / zip は使わない。新しいライブラリは追加しない

---

## 対話フロー

### Step 0: 前提チェック

1. `read_file` で `<WS>/app/package.json` を読み、`scripts.dev` があるか確認する。無ければ「`app/package.json` に `dev` スクリプトが見つかりません」と伝えて止まる
2. `list_directory` で `<WS>/runtime/node` と `<WS>/app/node_modules` があるか確認する
   - `runtime/node` が無い → 「先に Node.js のセットアップが必要です。『セットアップして』と話しかけてください」と案内して止まる（setup skill の担当）
   - `node_modules` が無い → 依存パッケージ（アプリが使う部品）を入れる必要がある。ユーザーに一言断り、**バックグラウンドプロセスツール**で `install` を実行する（コマンドは Step 1A-2 の `run dev` を `install` に置き換えたもの）。完了は `get_process_output` の `added ... packages` / `up to date` と、`list_directory` で `node_modules` ができたことの両方で判断する

### Step 1A: 起動

#### 1A-1. 二重起動・ポート競合のチェック

1. `list_processes` で Kiro が管理しているプロセスを確認する。**`status` が `running`** で、コマンドに `run dev` を含むものがあれば、すでに起動済みの可能性が高い（`stopped` のものは過去の記録なので無視する）
2. `check port 3000 --id start-port-1` を実行し、結果ファイルを読む
   - `result: "free"` → 1A-2 へ
   - `result: "in_use"` → `check who 3000 --id start-who-1` で PID とコマンドを調べ、チャットで次の選択肢を出して**回答を待つ**:

     ```
     ⚠️ ポート 3000 はすでに使われています。
     - 使っているプロセス: PID 12345（node ... src/index.ts）
     - Kiro で起動した dev サーバ: あり（terminalId: term_xxx） / なし

     どうしますか?
     1. 今のサーバを止めて起動し直す
     2. 別のポートで起動する（アプリがポート番号の変更に対応している場合のみ）
     3. 中止する（今のサーバをそのまま使う）
     ```

     Kiro 管理のサーバがすでに動いているなら、「すでに起動しています。http://localhost:3000 を開いてください」と伝えるだけでもよい。**二重に起動しない**
   - `result: "error"` → 結果の `error` をそのまま読み、引数やパスを直して1回だけ再試行する

#### 1A-2. バックグラウンド起動

バックグラウンドプロセスツールを `action: "start"`、**`cwd` に `<WS>/app`（絶対パス）** で呼ぶ。`cd` は使わない。

```bash
# macOS（command に指定する文字列。cwd = <WS>/app）
PATH="<WS>/runtime/node/bin:$PATH" "<WS>/runtime/node/bin/npm" run dev
```

```powershell
# Windows / PowerShell（command に指定する文字列。cwd = <WS>\app）
$env:Path = "<WS>\runtime\node;$env:Path"; npm.cmd run dev
```

- 返ってきた **terminalId を必ず控える**（ログ確認と停止に使う）
- `isReused: true` が返ったら、同じコマンドがすでに動いている。新しく起動されたわけではないので 1A-1 の「起動済み」として扱う
- `cwd` が効かずに `Missing script: "dev"` や `package.json` が見つからないエラーがログに出た場合は、`--prefix` で app の場所を指定する（macOS で動作確認済み。Windows は未検証）:
  - macOS: `PATH="<WS>/runtime/node/bin:$PATH" "<WS>/runtime/node/bin/npm" --prefix "<WS>/app" run dev`
  - Windows: `$env:Path = "<WS>\runtime\node;$env:Path"; npm.cmd --prefix "<WS>\app" run dev`
- PATH の付与は省略しない。`npm run dev` から呼ばれる `tsx` は裸の `node` を呼ぶため、runtime の node を PATH の先頭に置く必要がある（[AGENTS.md](../../../AGENTS.md)「補足」）
- Windows で起動コマンド自体がツールに拒否された場合は、別の書き方を試し続けず、「Kiro のターミナルで次を貼り付けて実行してください」とユーザーに案内する: `cd "<WS>\app"; $env:Path = "<WS>\runtime\node;$env:Path"; npm.cmd run dev`（この場合の停止はユーザーのターミナルで `Ctrl+C`）

#### 1A-3. 起動の確認（2つとも満たしたら成功）

1. `check wait http://localhost:3000 30 --id start-wait-1` を実行し、結果ファイルが `result: "up"` であること
2. `get_process_output`（terminalId 指定）に `Server running at` / `Listening on` / `http://localhost:` などの起動メッセージがあり、エラーが出ていないこと

- ログに **コマンドのエコーや「バッチ ジョブを終了しますか (Y/N)?」しか出ていないだけでは、クラッシュと判断しない**。必ず `wait` の結果で確かめる
- `result: "timeout"` → `get_process_output`（`lines: 50` 程度）でログ末尾を見て、原因を初学者向けに伝える（依存の不足 / 型エラー / ポート競合 など）。ログが空・エコーだけなら「シェルが固まったとき」へ
- ログのポート番号が 3000 以外なら、その番号で `wait` をやり直し、報告もその番号にする

#### 1A-4. 結果報告

開発サーバは **受講者自身のPC内** で動くので、同じPCのブラウザから `http://localhost:3000` で開ける（外部公開や IP の確認は不要。`0.0.0.0` への変更も不要）。

```
✅ 開発サーバを起動しました。

- ブラウザで開く: http://localhost:3000
- terminalId: <id>（停止・ログ確認に使います）

停止したいときは「サーバ止めて」と伝えてください。
```

### Step 1B: 停止

#### 1B-1. 止める対象を特定する

- このセッションで起動した terminalId が分かっていればそれを使う
- 分からなければ `list_processes` で `status: running` かつ `run dev` を含むものを探す（当て推量の terminalId で stop しない）
- 見つからなければ `check who 3000 --id stop-who-1` で PID を調べ、「このプロセスを止めますか?」と確認して回答を待つ（1B-3 の手順で止める）

#### 1B-2. 停止して解放を確かめる

1. バックグラウンドプロセスツールを `action: "stop"`、`terminalId` 指定で呼ぶ
2. **必ず** `check free 3000 10 --id stop-free-1` を実行し、結果ファイルが `result: "free"` であることを確かめてから報告する

```
🛑 開発サーバを停止しました。

- ポート 3000 は解放されました。
- 再度起動したいときは「サーバ起動して」と伝えてください。
```

#### 1B-3. 止めたのにポートが空かないとき（子プロセスの残り）

`npm run dev` は `npm` → `tsx watch` → `node`（実際のサーバ）と親子でプロセスを起動する。親を止めても子が残ってポートを使い続けることがある。

1. `check who 3000 --id stop-who-2` で残っているプロセスの PID とコマンドを調べる
2. チャットで PID とコマンドを示し、止めてよいか確認する:

   ```
   サーバ本体（子プロセス）が残っていて、ポート 3000 を使い続けています。
   - PID 12345: node ... src/index.ts
   このプロセスだけを止めてもよいですか?
   ```

3. 承認されたら **その PID だけ** を止める
   - macOS: `kill <PID>`（`kill -9` は通常の kill で止まらないときの最終手段）
   - Windows: `Stop-Process -Id <PID>`（止まらないときは `-Force` を付ける）
   - これらは Kiro の権限設定で拒否されることがある。拒否されたら回避せず、上のコマンドを示して「Kiro のターミナルに貼り付けて実行してください」と頼み、完了の返事を待つ
4. もう一度 `check free 3000 10 --id stop-free-2` で解放を確かめる

### Step 1C: 再起動

- Step 1B（停止）を最後まで行い、**`free` の成功を確かめてから** Step 1A（起動）に進む。同時に進めない
- 停止側で解放を確認済みなら、1A-1 の `port` チェックは `--id restart-port-1` のように別の名前で行う

### Step 1D: 状態確認（止めたりはしない）

1. `list_processes` で Kiro 管理のプロセスを確認する（`status: running` のもの）。あれば `get_process_output` で直近ログも見る
2. `check port 3000 --id status-port-1`。使用中なら `check who 3000 --id status-who-1` で PID も調べる

```
📡 現在の状態

- ポート 3000: 使用中（PID 12345, node ... src/index.ts）
- Kiro で起動した dev サーバ: あり（terminalId: ..., status: running）
- ブラウザで開く: http://localhost:3000
```

または

```
📡 現在の状態

- ポート 3000: 空き
- 起動中の dev サーバ: なし
```

### 後片付け（各 Step の最後）

読み終えた結果ファイルは都度 `delete_file` で消す。消し忘れや `delete_file` が使えない場合は、最後に `check clean --id cleanup-1` を実行し、その結果ファイル1つを `delete_file` で消す。

---

## シェルが固まったとき・結果がおかしいとき（OS を問わず同じ手順）

症状の例: 「バッチ ジョブを終了しますか (Y/N)?」で止まる（Windows で発生）、コマンドを投げても何も返らない、前のコマンドの出力が返ってくる、結果ファイルができない。

1. **新しい resultId で1回だけ再試行する**（例: `start-wait-1` → `start-wait-2`）。結果ファイルが新しくできていれば、その内容を正とする
2. それでもだめなら `list_processes` で残っているプロセスを確認し、`status: running` の不要なものがあれば terminalId で stop する
3. それでも反応しなければ、ユーザーに次をお願いして止まる:

   > 「Kiro が使っているターミナルが応答しなくなったようです。お手数ですが、画面下のターミナルパネルで該当のターミナルを閉じて（ゴミ箱アイコン）、もう一度『サーバ起動して』と話しかけてください。改善しない場合は Kiro を再起動してください。」

- **同じコマンドを何度も繰り返さない。** 書き方を少しずつ変えて試し続けることもしない
- macOS で同じ症状が起きるかは未確認。起きた場合も上の順で切り分ける

---

## 動作確認の状況と手動チェックリスト

- **macOS（Apple Silicon、macOS 26.6、zsh、Kiro IDE）: 確認済み。** 状態確認 → 起動 → 起動中の二重起動検出 → 停止 → 再起動を、すべて結果ファイル経由で確認した。`control_bash_process` の stop で `npm` → `tsx watch` → `node` の子プロセスまで止まり、ポートはすぐ解放された
- **Windows: 未検証**（この版の手順では実機で試していない）。以前の版で `$env:Path = "..."; npm.cmd run dev` による起動と HTTP 200 は確認できている。ツール名 `execute_pwsh` / `control_pwsh_process` もそのときの観測

Windows（または未検証の環境）で初めて使うときは、次を順に確かめる。どれかが失敗したら、その結果ファイルの内容とツール名を記録して講師に共有する。

1. [ ] 状態確認: `& "<WS>\runtime\node\node.exe" "<WS>\.kiro\skills\dev-server\scripts\dev-server-check.mjs" port 3000 --id chk-1` → `<WS>\runtime\tmp\dev-server\chk-1.json` が `"result":"free"`。`list_processes` に running の dev サーバが無い
2. [ ] 起動: 1A-2 のコマンドで起動 → `wait http://localhost:3000 30 --id chk-2` が `"result":"up"` → `get_process_output` に `Server running at` → terminalId を控える
3. [ ] 二重起動の検出: もう一度起動を頼む → `port 3000 --id chk-3` が `"result":"in_use"`、`who 3000 --id chk-4` に PID が出る → 選択肢を出して起動しない
4. [ ] 停止: terminalId で stop → `free 3000 10 --id chk-5` が `"result":"free"`。`free` が timeout なら子プロセスが残っている（1B-3 を試し、そのことを記録する）
5. [ ] 再起動: 停止の `free` 成功を確かめてから起動し、2 と同じ確認が通る
6. [ ] パス: ワークスペースのパスにスペースや丸かっこが含まれる状態で 1〜5 が通る
7. [ ] 後片付け: `clean --id chk-9` のあと、`<WS>\runtime\tmp\dev-server\` に `chk-9.json` 以外が残っていない（最後にそれも削除）

## やってはいけないこと

- 開発サーバを **前景実行** すること（以降の操作がブロックされる）。Windows で `npm.cmd` をコマンド実行ツールで前景実行すること
- 起動コマンドを投げただけ、またはログだけを見て **起動成功・失敗を判断** すること（必ず `wait` の結果ファイルで確かめる）
- stdout や終了コードだけを見て判定すること（まず結果ファイルを読む）
- `$PWD` や相対パス前提で node・スクリプトを呼ぶこと（絶対パスを引用符で囲む）
- ポート 3000 が使用中のときに **無確認で kill** すること・**二重起動** すること
- 広い範囲の kill（`pkill -f node`、`taskkill /IM node.exe` など）で巻き添えにすること
- kill 系や削除系が権限設定で拒否されたときに、書き方を変えて回避すること
- 停止後に `free` で解放を **確認せずに完了報告** すること
- 同じコマンドを何度も繰り返すこと（「シェルが固まったとき」の手順に従う）
- `Set-ExecutionPolicy` で受講者PCの設定を変えること
- 専門用語をそのまま投げて初学者を置いていくこと

## ヒント: 初学者へのよくある声かけ例

- 「開発サーバは『下書き専用のお店』のようなもので、コードを書き換えるとすぐ反映されます」
- 「バックグラウンド起動なので、画面には見えませんが裏で動いています。お使いのPCのブラウザで http://localhost:3000 を開けば触れます」
- 「止め忘れるとポートを掴んだままになり、次に同じサーバを起動するときに『すでに使われている』と怒られます。終わったら止める癖をつけると安心です」
- 「`Ctrl+C` でも止められますが、バックグラウンド起動の場合は『サーバ止めて』と伝えてもらえれば Kiro が管理している ID 経由で確実に止めます」
