#!/usr/bin/env node
// dev-server skill 用の判定スクリプト（macOS / Windows 共通）。
// Node 標準モジュールのみで動く。シェルの出力表示に頼らず判定できるよう、
// 結果は「1行の JSON を stdout と結果ファイルの両方」に出し、終了コード（0=成功 / 1=失敗）でも返す。
//
// 使い方:
//   node dev-server-check.mjs port <port>                 --id <resultId>
//   node dev-server-check.mjs wait <url> <timeoutSec>     --id <resultId>
//   node dev-server-check.mjs free <port> <timeoutSec>    --id <resultId>
//   node dev-server-check.mjs who  <port>                 --id <resultId>
//   node dev-server-check.mjs clean                       --id <resultId>
//
// 結果ファイル: <ワークスペース>/runtime/tmp/dev-server/<resultId>.json
//   場所はこのスクリプト自身の位置（.kiro/skills/dev-server/scripts/）から決める。
//   cwd や $PWD はツールによって当てにならないため使わない。

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const POLL_INTERVAL_MS = 500;
// Windows は待ち受けの無いポートへの接続でも RST 後に再送するため、拒否が返るまで約2秒かかる。
const PROBE_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 2000;
const MAX_TIMEOUT_SEC = 300;
const RESULT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PROBE_HOSTS = ['127.0.0.1', '::1'];
// IPv6 が無効な環境で ::1 に接続したときのエラー。「待ち受けなし」と同じ扱いにする。
const UNAVAILABLE_CODES = new Set([
  'EADDRNOTAVAIL',
  'EAFNOSUPPORT',
  'ENETUNREACH',
  'EHOSTUNREACH',
]);

/**
 * スクリプトの file URL からワークスペース直下を求める（テストのため export）。
 * scripts/ → dev-server/ → skills/ → .kiro/ → ワークスペース直下
 */
export function resolveWorkspaceRoot(scriptUrl, { windows = process.platform === 'win32' } = {}) {
  const p = windows ? path.win32 : path.posix;
  const scriptPath = fileURLToPath(scriptUrl, { windows });
  return p.resolve(p.dirname(scriptPath), '..', '..', '..', '..');
}

/** 結果ファイルの置き場所（テストのため export）。 */
export function resolveResultDir(scriptUrl, options) {
  const windows = options?.windows ?? process.platform === 'win32';
  const p = windows ? path.win32 : path.posix;
  return p.join(resolveWorkspaceRoot(scriptUrl, { windows }), 'runtime', 'tmp', 'dev-server');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class UsageError extends Error {}

const parsePort = (value) => {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new UsageError(`port must be an integer 1-65535 (got: ${value ?? 'none'})`);
  }
  return port;
};

const parseTimeoutSec = (value) => {
  const sec = Number(value);
  if (!Number.isFinite(sec) || sec <= 0 || sec > MAX_TIMEOUT_SEC) {
    throw new UsageError(`timeoutSec must be a number 0-${MAX_TIMEOUT_SEC} (got: ${value ?? 'none'})`);
  }
  return sec;
};

const parseUrl = (value) => {
  let url;
  try {
    url = new URL(value ?? '');
  } catch {
    throw new UsageError(`url is invalid (got: ${value ?? 'none'})`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(`url must start with http:// or https:// (got: ${value})`);
  }
  return url.href;
};

const parseArgs = (argv) => {
  const positional = [];
  let id;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--id') {
      id = argv[i + 1];
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  const [cmd, ...rest] = positional;
  return { cmd, rest, id };
};

// 1か所への TCP 接続を試す。open=誰かが待ち受け中 / closed=拒否された / unavailable=そのアドレス自体が無い
const probeHost = (host, port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (state, code) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ host, state, ...(code ? { code } : {}) });
    };
    const timer = setTimeout(() => finish('unknown', 'PROBE_TIMEOUT'), PROBE_TIMEOUT_MS);
    socket.once('connect', () => finish('open'));
    socket.once('error', (err) => {
      if (err.code === 'ECONNREFUSED') finish('closed');
      else if (UNAVAILABLE_CODES.has(err.code)) finish('unavailable', err.code);
      else finish('unknown', err.code ?? String(err.message));
    });
  });

const probePort = async (port) => {
  const probes = await Promise.all(PROBE_HOSTS.map((host) => probeHost(host, port)));
  if (probes.some((p) => p.state === 'open')) return { state: 'in_use', probes };
  if (probes.some((p) => p.state === 'unknown')) return { state: 'unknown', probes };
  return { state: 'free', probes };
};

const cmdPort = async ([portArg]) => {
  const port = parsePort(portArg);
  const { state, probes } = await probePort(port);
  if (state === 'unknown') {
    return { ok: false, result: 'error', port, probes, error: 'could not determine port state' };
  }
  return { ok: state === 'free', result: state, port, free: state === 'free', probes };
};

const cmdWait = async ([urlArg, timeoutArg]) => {
  const url = parseUrl(urlArg);
  const timeoutSec = parseTimeoutSec(timeoutArg);
  const deadline = Date.now() + timeoutSec * 1000;
  let attempts = 0;
  let lastError = null;
  while (Date.now() < deadline) {
    attempts += 1;
    try {
      // ステータスは問わない（404 や 500 でも「サーバは応答している」= 起動済み）
      const res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      await res.body?.cancel();
      return { ok: true, result: 'up', url, status: res.status, attempts };
    } catch (err) {
      lastError = err?.cause?.code ?? err?.name ?? String(err);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { ok: false, result: 'timeout', url, timeoutSec, attempts, lastError };
};

const cmdFree = async ([portArg, timeoutArg]) => {
  const port = parsePort(portArg);
  const timeoutSec = parseTimeoutSec(timeoutArg);
  const deadline = Date.now() + timeoutSec * 1000;
  let attempts = 0;
  let last;
  while (Date.now() < deadline) {
    attempts += 1;
    last = await probePort(port);
    if (last.state === 'free') return { ok: true, result: 'free', port, attempts };
    await sleep(POLL_INTERVAL_MS);
  }
  return { ok: false, result: 'timeout', port, timeoutSec, attempts, lastState: last?.state };
};

const run = (file, args) =>
  new Promise((resolve) => {
    execFile(file, args, { timeout: 10000, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') });
    });
  });

// 待ち受け中プロセスの PID を調べる（停止は行わない。表示してユーザーに確認するため）
const findListenersPosix = async (port) => {
  const { error, stdout } = await run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp']);
  if (error && error.code === 'ENOENT') throw new Error('lsof not found');
  const pids = [...new Set(stdout.split('\n').filter((l) => l.startsWith('p')).map((l) => Number(l.slice(1))))];
  const processes = [];
  for (const pid of pids) {
    const ps = await run('ps', ['-o', 'ppid=,command=', '-p', String(pid)]);
    const line = ps.stdout.trim();
    const match = line.match(/^(\d+)\s+(.*)$/);
    processes.push({ pid, ppid: match ? Number(match[1]) : null, command: match ? match[2] : line });
  }
  return processes;
};

/**
 * Windows の `netstat -ano` の出力から、指定ポートで待ち受け中の PID を取り出す（テストのため export）。
 * 状態列（LISTENING 等）は言語設定で翻訳されることがあるため使わず、
 * 「相手先アドレスのポートが 0 = 待ち受け」で判定する。
 */
export function parseNetstatListeners(stdout, port) {
  const pids = new Set();
  for (const raw of stdout.split(/\r?\n/)) {
    const cols = raw.trim().split(/\s+/);
    if (cols.length < 5 || !cols[0].toUpperCase().startsWith('TCP')) continue;
    const local = cols[1];
    const foreign = cols[2];
    const pid = Number(cols[cols.length - 1]);
    const localPort = Number(local.slice(local.lastIndexOf(':') + 1));
    const foreignPort = Number(foreign.slice(foreign.lastIndexOf(':') + 1));
    if (localPort === port && foreignPort === 0 && Number.isInteger(pid) && pid > 0) pids.add(pid);
  }
  return [...pids];
}

const findListenersWindows = async (port) => {
  const { error, stdout } = await run('netstat', ['-ano']);
  if (error && error.code === 'ENOENT') throw new Error('netstat not found');
  const pids = parseNetstatListeners(stdout, port);
  const processes = [];
  for (const pid of pids) {
    const tl = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
    const match = tl.stdout.match(/^"([^"]+)"/m);
    processes.push({ pid, ppid: null, command: match ? match[1] : null });
  }
  return processes;
};

const cmdWho = async ([portArg]) => {
  const port = parsePort(portArg);
  const { state } = await probePort(port);
  const processes =
    process.platform === 'win32' ? await findListenersWindows(port) : await findListenersPosix(port);
  return { ok: true, result: state, port, processes };
};

const cmdClean = async (_rest, ctx) => {
  let removed = 0;
  if (fs.existsSync(ctx.resultDir)) {
    for (const name of fs.readdirSync(ctx.resultDir)) {
      if (!name.endsWith('.json') || name === path.basename(ctx.resultFile)) continue;
      fs.rmSync(path.join(ctx.resultDir, name), { force: true });
      removed += 1;
    }
  }
  return { ok: true, result: 'cleaned', removed };
};

const COMMANDS = { port: cmdPort, wait: cmdWait, free: cmdFree, who: cmdWho, clean: cmdClean };

const emit = (payload, resultFile) => {
  const body = { ...payload, resultFile, platform: process.platform, at: new Date().toISOString() };
  let line = JSON.stringify(body);
  try {
    fs.mkdirSync(path.dirname(resultFile), { recursive: true });
    fs.writeFileSync(resultFile, `${line}\n`, 'utf8');
  } catch (err) {
    body.ok = false;
    body.writeError = String(err?.message ?? err);
    line = JSON.stringify(body);
  }
  const code = body.ok ? 0 : 1;
  // stdout がパイプのときに書き切る前に終了しないよう、書き込み完了後に exit する
  process.stdout.write(`${line}\n`, () => process.exit(code));
};

const main = async () => {
  const startedAt = Date.now();
  const resultDir = resolveResultDir(import.meta.url);
  const { cmd, rest, id } = parseArgs(process.argv.slice(2));
  const hasValidId = typeof id === 'string' && RESULT_ID_PATTERN.test(id);
  // --id が無い・不正でも結果を残すため、自動の名前で書き出す
  const resultId = hasValidId ? id : `invalid-args-${startedAt}`;
  const resultFile = path.join(resultDir, `${resultId}.json`);
  const base = { cmd: cmd ?? null, args: rest };

  const fail = (error, result = 'error') => {
    emit({ ok: false, result, ...base, error, elapsedMs: Date.now() - startedAt }, resultFile);
  };

  process.on('uncaughtException', (err) => fail(`uncaught: ${err?.message ?? err}`));
  process.on('unhandledRejection', (err) => fail(`unhandled: ${err?.message ?? err}`));

  if (!hasValidId) {
    fail(`--id is required and must match ${RESULT_ID_PATTERN} (got: ${id ?? 'none'})`, 'usage_error');
    return;
  }
  const handler = COMMANDS[cmd];
  if (!handler) {
    fail(`unknown command: ${cmd ?? 'none'} (use: ${Object.keys(COMMANDS).join(' | ')})`, 'usage_error');
    return;
  }
  try {
    const payload = await handler(rest, { resultDir, resultFile });
    emit({ ...base, ...payload, elapsedMs: Date.now() - startedAt }, resultFile);
  } catch (err) {
    fail(String(err?.message ?? err), err instanceof UsageError ? 'usage_error' : 'error');
  }
};

// import.meta.main は Node 24.2 以降。念のため古い Node 向けの判定も残す
const isMain =
  import.meta.main ??
  (process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
