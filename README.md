# Kiro ハンズオン

Kiro を使った Agentic Coding を体験するためのハンズオン用ワークスペースです。

本ワークスペースは、各受講者が**持ち込みPC**上でセットアップして進めます。Node.js は大容量ダウンロードを避けるためポータブル版を `dist/` に同梱していますが、**セットアップと実行にはインターネット接続が必要**です（下記「必要な環境」を参照）。

## 必要な環境

- **OS**: macOS 13.5 以上、または Windows 10 以上（CPU/バージョン別の詳細は[セットアップ](#セットアップ)の対応表を参照）
- **インターネット接続**: 次の用途で必要です。社内ネットワークの**プロキシ / ファイアウォールでこれらがブロックされていると、依存関係のインストールやアプリの表示が失敗します**。
  - npm レジストリ（`npm install` でライブラリを取得）
  - `https://cdn.tailwindcss.com`（画面スタイリングに Tailwind CSS の CDN 版を実行時に読み込むため）
  - `https://unpkg.com`（htmx を使う場合に実行時に読み込むため）

## セットアップ

**コマンド操作は不要です。** Kiro に次のように話しかけてください。

> **「セットアップして」**

`setup` skill が起動し、次を代わりに進めます。

1. お使いのPCが **Mac か Windows か** を確認
2. **OSバージョンと CPU（アーキテクチャ）** を、確認方法の案内付きでヒアリング
3. 動作要件を満たすか判定
4. 同梱の Node.js **v24.18.0** を `runtime/node/` に展開
5. 動作確認まで実施

CPU やバージョンの調べ方も Kiro が画面で案内するので、表示された内容をそのまま答えるだけで完了します。

### 同梱アーカイブとプラットフォームの対応表（参考）

skill が内部で使用する対応表です。受講者が自分で選ぶ必要はありません。

| ファイル | OS | CPU / アーキテクチャ | 対応OSバージョン（要件） | 形式 |
|---|---|---|---|---|
| `dist/node-v24.18.0-darwin-arm64.tar.gz` | macOS | Apple Silicon（M1以降 / arm64） | macOS 13.5 以上 | tar.gz |
| `dist/node-v24.18.0-darwin-x64.tar.gz` | macOS | Intel（x64） | macOS 13.5 以上 | tar.gz |
| `dist/node-v24.18.0-win-x64.zip` | Windows | x64（64bit） | Windows 10 / Windows Server 2016 以上 | zip |
| `dist/node-v24.18.0-win-arm64.zip` | Windows | ARM64 | Windows 10 以上 | zip |

> 対応OSバージョンの根拠は Node.js 公式の [BUILDING.md（Supported platforms）](https://github.com/nodejs/node/blob/main/BUILDING.md) に準拠しています。
>
> 展開後のフォルダ名は `node` に統一され、以降の skill は次の固定パスで Node を呼び出します（PATH は設定しません）。
> - macOS: `runtime/node/bin/node`
> - Windows: `runtime\node\node.exe`

<details>
<summary>手動でセットアップする場合（講師・上級者向け）</summary>

`setup` skill を使わず手動で展開する場合の手順です。ワークスペース直下の `runtime/` に展開し、フォルダ名を `node` に統一します。

**macOS**（arm64 の例。Intel は `darwin-x64` に読み替え）

```bash
mkdir -p runtime
tar -xzf dist/node-v24.18.0-darwin-arm64.tar.gz -C runtime
mv runtime/node-v24.18.0-darwin-arm64 runtime/node
runtime/node/bin/node -v   # v24.18.0 と表示されれば成功
```

**Windows（PowerShell）**（x64 の例。ARM は `win-arm64` に読み替え）

```powershell
New-Item -ItemType Directory -Force -Path runtime | Out-Null
Expand-Archive -Force dist\node-v24.18.0-win-x64.zip -DestinationPath runtime
Rename-Item runtime\node-v24.18.0-win-x64 runtime\node
runtime\node\node.exe -v   # v24.18.0 と表示されれば成功
```

</details>

## FAQ

**Q. どのファイルを選べばいい?**
選ぶ必要はありません。「セットアップして」と話しかければ、`setup` skill が OS・CPU をヒアリングして適切なアーカイブを自動で選び、展開します。

**Q. 自分のPCのバージョンや CPU が分からない**
そのままで大丈夫です。`setup` skill が「アップルメニュー →このMacについて」「設定 →システム →バージョン情報」などの確認手順を画面で案内するので、表示された内容を答えてください。

**Q. 「お使いのバージョンは対応外です」と言われた**
同梱の Node.js は macOS 13.5 以上 / Windows 10 以上が対象です。要件を下回る場合は動作保証外のため、講師に相談してください。

**Q. `dist/` 以外のOS（Linux など）向けは?**
本ハンズオンでは持ち込みPC想定のため macOS / Windows のポータブル版のみ同梱しています。Linux 等が必要な場合は [nodejs.org/dist/v24.18.0/](https://nodejs.org/dist/v24.18.0/) から入手してください。

**Q. PATH は通さなくていい?**
不要です。開発は skill 経由で進め、skill が展開先の `node` をフルパス（mac: `runtime/node/bin/node` / Windows: `runtime\node\node.exe`）で呼び出します。受講者側で環境変数を設定する必要はありません。
