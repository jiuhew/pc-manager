import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  BRIDGE_SCRIPT,
  CLI_SCRIPT,
  DEFAULT_HOST,
  DEFAULT_PORT,
  GUI_VERSION,
  PUBLIC_DIR,
  REPORTS_DIR,
  REPO_ROOT,
  START_GUI_SCRIPT
} from './lib/config.mjs';
import { generatePlans, isMediaSourceAllowed, isMigrationSourceAllowed } from './lib/ai.mjs';
import { getAppInsights } from './lib/apps.mjs';
import { listDrives } from './lib/drives.mjs';
import { ApiError } from './lib/errors.mjs';
import { JobManager } from './lib/jobs.mjs';
import { folderHasMedia } from './lib/media-check.mjs';
import { detectAdmin, runProcess, runPowerShellFile } from './lib/ps.mjs';
import { hasRiskyItems, isProtectedPath, normalizePath, resolveCandidates } from './lib/safety.mjs';
import { assertScanId, getScan, listScans } from './lib/scans.mjs';
import { getSystemInfo } from './lib/system.mjs';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const UPDATE_TIMEOUT_MS = Number(process.env.PC_MANAGER_UPDATE_TIMEOUT_MS) || 10 * 60 * 1000;
const UPDATE_INTERACTIVE_TIMEOUT_MS = Number(process.env.PC_MANAGER_UPDATE_INTERACTIVE_TIMEOUT_MS) || 30 * 60 * 1000;
const WINGET_SUCCESS_RE = /successfully installed|successfully upgraded|已成功安装|已成功升级|安装成功|升级成功/i;
const WINGET_NO_UPDATE_RE = /no applicable update|no available upgrade|没有可用的更新|没有可用的升级|已是最新/i;
const WINGET_ELEVATION_RE = /请求以管理员身份运行|管理员身份|elevation|elevate|期待提示|waiting for/i;
const SILENT_OVERRIDES = new Map([
  ['Tencent.TencentMeeting', '/S'],
  ['Tencent.QQ.NT', '/S']
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(body);
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] || '');
  if (!contentType.includes('application/json')) {
    throw new ApiError(415, 'Expected application/json');
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new ApiError(413, 'Request body too large');
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, 'Invalid JSON body');
  }
}

function checkSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  const host = request.headers.host;
  if (!host) throw new ApiError(403, 'Missing Host header');
  const allowed = new Set([`http://${host}`, `https://${host}`]);
  if (!allowed.has(origin)) throw new ApiError(403, 'Cross-origin request rejected');
}

function normalizeDrives(input) {
  const list = Array.isArray(input) ? input : [input];
  const drives = [];
  for (const raw of list) {
    for (const part of String(raw ?? '').split(',')) {
      let drive = part.trim().toUpperCase();
      if (!drive) continue;
      if (!drive.endsWith(':')) drive += ':';
      if (!/^[A-Z]:$/.test(drive)) throw new ApiError(400, `Invalid drive: ${part}`);
      if (!drives.includes(drive)) drives.push(drive);
    }
  }
  return drives;
}

function normalizeExcludes(input) {
  const list = Array.isArray(input) ? input : [input];
  const excludes = [];
  for (const raw of list) {
    for (const part of String(raw ?? '').split(',')) {
      const value = part.trim();
      if (value) excludes.push(value);
    }
  }
  return [...new Set(excludes)];
}

async function writeBridgeInput(payload) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pc-manager-gui-'));
  const file = path.join(dir, 'input.json');
  await fs.writeFile(file, JSON.stringify(payload), 'utf8');
  return {
    file,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }).catch(() => {})
  };
}

function parseBridgeResult(stdout) {
  const lines = String(stdout).split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line.startsWith('{')) continue;
    try {
      const event = JSON.parse(line);
      if (event?.type === 'result') return event.data;
    } catch {
      // not a bridge event
    }
  }
  return null;
}

async function serveStatic(response, publicDir, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (relative === '/') relative = '/index.html';

  const filePath = path.resolve(publicDir, `.${relative}`);
  if (filePath !== publicDir && !filePath.startsWith(`${publicDir}${path.sep}`)) return false;

  let data;
  try {
    data = await fs.readFile(filePath);
  } catch {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Content-Length': data.length,
    'Cache-Control': ['.html', '.js', '.css'].includes(extension) ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'"
  });
  response.end(data);
  return true;
}

function stamp() {
  const now = new Date();
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`;
}

function readPlan(body) {
  const plan = body?.plan;
  if (!plan || typeof plan !== 'object') throw new ApiError(400, 'Plan is required');
  if (!['clean-junk', 'organize-media', 'migrate'].includes(plan.type)) {
    throw new ApiError(400, `Unsupported plan type: ${plan.type}`);
  }
  return plan;
}

function cleanPlanItems(scan, plan) {
  const paths = Array.isArray(plan.params?.paths) ? plan.params.paths : [];
  return resolveCandidates(scan, paths);
}

async function validateMediaPlan(scan, plan) {
  const source = String(plan.params?.source || '');
  const destination = String(plan.params?.destination || '');
  const kind = String(plan.params?.kind || '');
  if (!['video', 'photo', 'all'].includes(kind)) throw new ApiError(400, 'Invalid media kind');
  if (!path.win32.isAbsolute(source) || !path.win32.isAbsolute(destination)) {
    throw new ApiError(400, 'Media source and destination must be absolute paths');
  }
  if (isProtectedPath(source) || isProtectedPath(destination)) {
    throw new ApiError(400, 'Media plan touches a protected path');
  }

  const sourcePath = normalizePath(source);
  const destinationPath = normalizePath(destination);
  if (!sourcePath || !destinationPath) throw new ApiError(400, 'Invalid media path');
  if (sourcePath === normalizePath(path.win32.parse(source).root)) {
    throw new ApiError(400, 'Refusing to organize a drive root');
  }
  if (destinationPath === normalizePath(path.win32.parse(destination).root)) {
    throw new ApiError(400, 'Refusing to write directly to a drive root');
  }
  if (destinationPath !== sourcePath && destinationPath.startsWith(`${sourcePath}\\`)) {
    throw new ApiError(400, 'Destination cannot be inside the source');
  }
  if (!isMediaSourceAllowed(scan, source)) {
    throw new ApiError(400, 'Media source is not one of the scanned media folders');
  }

  let stat;
  try {
    stat = await fs.stat(source);
  } catch {
    throw new ApiError(400, `Media source does not exist: ${source}`);
  }
  if (!stat.isDirectory()) throw new ApiError(400, `Media source is not a folder: ${source}`);

  try {
    const destinationStat = await fs.stat(destination);
    if (!destinationStat.isDirectory()) throw new ApiError(400, 'Destination exists and is not a folder');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // not existing is fine
  }

  return { ...plan, params: { source, destination, kind } };
}

async function validateMigratePlan(scan, plan) {
  const source = String(plan.params?.source || '');
  const destination = String(plan.params?.destination || '');
  if (!path.win32.isAbsolute(source) || !path.win32.isAbsolute(destination)) {
    throw new ApiError(400, 'Migration source and destination must be absolute paths');
  }
  if (!isMigrationSourceAllowed(scan, source)) {
    throw new ApiError(400, 'Migration source is not one of the scanned migration candidates');
  }
  if (isProtectedPath(source) || isProtectedPath(destination)) {
    throw new ApiError(400, 'Migration plan touches a protected path');
  }

  const sourcePath = normalizePath(source);
  const destinationPath = normalizePath(destination);
  if (!sourcePath || !destinationPath) throw new ApiError(400, 'Invalid migration path');
  if (sourcePath === normalizePath(path.win32.parse(source).root)) {
    throw new ApiError(400, 'Refusing to move a drive root');
  }
  if (destinationPath === sourcePath || destinationPath.startsWith(`${sourcePath}\\`)) {
    throw new ApiError(400, 'Destination cannot be inside the source');
  }

  let sourceStat;
  try {
    sourceStat = await fs.stat(source);
  } catch {
    throw new ApiError(400, `Migration source does not exist: ${source}`);
  }
  if (!sourceStat.isDirectory()) throw new ApiError(400, 'Migration source is not a folder');

  try {
    await fs.stat(destination);
    throw new ApiError(400, `Migration destination already exists: ${destination}`);
  } catch (error) {
    if (error instanceof ApiError) throw error;
  }

  return { ...plan, params: { source, destination } };
}

export function createApp(options = {}) {
  const repoRoot = options.repoRoot ?? REPO_ROOT;
  const reportsDir = options.reportsDir ?? REPORTS_DIR;
  const publicDir = options.publicDir ?? PUBLIC_DIR;
  const cliScript = options.cliScript ?? CLI_SCRIPT;
  const bridgeScript = options.bridgeScript ?? BRIDGE_SCRIPT;
  const jobs = new JobManager();

  async function auditForScan(scanId) {
    const input = await writeBridgeInput({ ScanPath: path.join(reportsDir, scanId) });
    try {
      const run = await runPowerShellFile(
        bridgeScript,
        ['-Action', 'audit', '-InputFile', input.file],
        { cwd: repoRoot }
      );
      return parseBridgeResult(run.stdout);
    } finally {
      await input.cleanup();
    }
  }

  function makeCleanJob(items, execute, title) {
    const manifestRoot = path.join(reportsDir, 'clean', stamp());
    return jobs.create({
      kind: execute ? 'clean' : 'clean-preview',
      title,
      run: async (current) => {
        const input = await writeBridgeInput({ Items: items });
        let result = null;
        try {
          current.setProgress({ current: 0, total: items.length, label: execute ? '准备清理' : '准备预览' });
          current.log('stdout', execute ? '正在执行清理...' : '正在重新测量所选项目...');
          const args = ['-Action', execute ? 'clean' : 'measure', '-InputFile', input.file];
          if (execute) args.push('-ManifestRoot', manifestRoot);
          const run = await runPowerShellFile(bridgeScript, args, {
            cwd: repoRoot,
            signal: current.signal,
            onLine: (line, stream) => {
              if (stream !== 'stdout' || !line.trim().startsWith('{')) {
                current.log(stream, line);
                return;
              }
              try {
                const event = JSON.parse(line);
                if (event?.type === 'item') {
                  current.addItem(event.data);
                  current.setProgress({
                    current: current.items.length,
                    total: items.length,
                    label: execute ? '清理中' : '测量中'
                  });
                }
                if (event?.type === 'result') result = event.data;
              } catch {
                current.log(stream, line);
              }
            }
          });
          if (!result) result = parseBridgeResult(run.stdout);
          if (!result) throw new Error('清理任务没有返回结果');
          if (current.items.length === 0) {
            for (const item of result.Items ?? []) current.addItem(item);
          }
          current.setProgress({ current: items.length, total: items.length, label: execute ? '清理完成' : '预览完成' });
          return result;
        } finally {
          await input.cleanup();
        }
      }
    });
  }

  function makeMediaJob(plan, execute) {
    const { source, destination, kind } = plan.params;
    const manifestRoot = path.join(reportsDir, 'organize', stamp());
    return jobs.create({
      kind: execute ? 'organize-media' : 'organize-media-preview',
      title: `${execute ? '归档' : '预览归档'} · ${plan.title || kind}`,
      run: async (current) => {
        const input = await writeBridgeInput({ Source: source, Destination: destination, Kind: kind, Execute: execute });
        let result = null;
        try {
          current.setProgress({ current: 0, total: 0, label: '扫描媒体文件', indeterminate: true });
          current.log('stdout', execute ? '正在移动媒体文件...' : '正在扫描媒体文件（只读）...');
          const args = ['-Action', 'organize-media', '-InputFile', input.file];
          if (execute) args.push('-ManifestRoot', manifestRoot);
          const run = await runPowerShellFile(bridgeScript, args, {
            cwd: repoRoot,
            signal: current.signal,
            onLine: (line, stream) => {
              if (stream !== 'stdout' || !line.trim().startsWith('{')) {
                current.log(stream, line);
                return;
              }
              try {
                const event = JSON.parse(line);
                if (event?.type === 'item') current.addItem(event.data);
                if (event?.type === 'progress') {
                  current.setProgress({
                    current: event.data?.Current,
                    total: event.data?.Total,
                    label: event.data?.Label,
                    indeterminate: event.data?.Indeterminate
                  });
                }
                if (event?.type === 'result') result = event.data;
              } catch {
                current.log(stream, line);
              }
            }
          });
          if (!result) result = parseBridgeResult(run.stdout);
          if (!result) throw new Error('媒体归档没有返回结果');
          current.setProgress({ current: result.TotalFiles ?? 0, total: result.TotalFiles ?? 0, label: execute ? '归档完成' : '预览完成' });
          return result;
        } finally {
          await input.cleanup();
        }
      }
    });
  }

  function makeMigrateJob(plan, execute) {
    const { source, destination } = plan.params;
    const manifestRoot = path.join(reportsDir, 'organize', stamp());
    return jobs.create({
      kind: execute ? 'migrate' : 'migrate-preview',
      title: `${execute ? '迁移' : '预览迁移'} · ${plan.title || '目录'}`,
      run: async (current) => {
        const input = await writeBridgeInput({ Source: source, Destination: destination, Execute: execute });
        let result = null;
        try {
          current.setProgress({ current: 0, total: 0, label: execute ? '准备迁移' : '准备预览', indeterminate: true });
          current.log('stdout', execute ? '正在移动目录并创建 junction...' : '正在计算迁移大小（只读）...');
          const args = ['-Action', 'migrate', '-InputFile', input.file];
          if (execute) args.push('-ManifestRoot', manifestRoot);
          const run = await runPowerShellFile(bridgeScript, args, {
            cwd: repoRoot,
            signal: current.signal,
            onLine: (line, stream) => {
              if (stream !== 'stdout' || !line.trim().startsWith('{')) {
                current.log(stream, line);
                return;
              }
              try {
                const event = JSON.parse(line);
                if (event?.type === 'result') result = event.data;
              } catch {
                current.log(stream, line);
              }
            }
          });
          if (!result) result = parseBridgeResult(run.stdout);
          if (!result) throw new Error('迁移任务没有返回结果');
          current.setProgress({ current: 1, total: 1, label: '迁移完成' });
          return result;
        } finally {
          await input.cleanup();
        }
      }
    });
  }

  function compareVersions(left, right) {
    const parse = (value) => String(value || '').split(/[^0-9]+/).filter(Boolean).map(Number);
    const a = parse(left);
    const b = parse(right);
    if (a.length === 0 || b.length === 0) return null;
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  async function getInstalledWingetVersion(id, signal) {
    const result = await runProcess(
      'winget',
      ['list', '--id', id, '--exact', '--accept-source-agreements', '--disable-interactivity'],
      { timeoutMs: 90 * 1000, signal }
    ).catch((error) => error);
    const text = `${result.stdout || ''}\n${result.stderr || ''}`;
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || /^-+$/.test(trimmed)) continue;
      if (!trimmed.toLowerCase().includes(String(id).toLowerCase())) continue;
      const parts = trimmed.split(/\s{2,}/);
      const at = parts.findIndex((part) => part.toLowerCase() === String(id).toLowerCase());
      if (at >= 0 && parts[at + 1]) return parts[at + 1];
    }
    return null;
  }

  function tailOf(text, lines = 3) {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-lines)
      .join(' ');
  }

  function makeAppUpdateJob(items, options = {}) {
    const interactive = options.interactive === true;
    return jobs.create({
      kind: 'apps-update',
      title: `${interactive ? '交互更新' : '更新'} ${items.length} 个应用`,
      run: async (current) => {
        const results = [];
        current.setProgress({ current: 0, total: items.length, label: '准备更新' });
        for (let i = 0; i < items.length; i++) {
          const { app, update } = items[i];
          current.setProgress({ current: i, total: items.length, label: `更新 ${app.DisplayName}` });
          let status = 'updated';
          let detail = '';
          let output = '';
          let timingOut = false;
          try {
            const args = ['upgrade', '--id', update.id, '--exact'];
            if (interactive) {
              args.push('--interactive');
            } else {
              args.push('--silent');
              const override = SILENT_OVERRIDES.get(update.id);
              if (override) args.push('--override', override);
            }
            args.push('--accept-package-agreements', '--accept-source-agreements');
            if (!interactive) args.push('--disable-interactivity');
            if (update.source === 'msstore') args.push('--source', 'msstore');
            const run = await runProcess('winget', args, {
              cwd: repoRoot,
              signal: current.signal,
              timeoutMs: interactive ? UPDATE_INTERACTIVE_TIMEOUT_MS : UPDATE_TIMEOUT_MS,
              onLine: (line, stream) => {
                const text = line.trim();
                if (!text) return;
                output += `${text}\n`;
                current.log(stream, `[${app.DisplayName}] ${text}`);
              }
            });
            output += `${run.stdout || ''}\n${run.stderr || ''}`;
          } catch (error) {
            if (current.signal.aborted) throw error;
            timingOut = error?.exitCode === 'timeout';
            output += `\n${error?.stdout || ''}\n${error?.stderr || ''}\n${error?.message || ''}`;
            if (!timingOut) detail = error?.message || String(error);
          }
          if (current.signal.aborted) throw new Error('Cancelled');

          const installed = await getInstalledWingetVersion(update.id, current.signal);
          const movedForward = compareVersions(installed, update.version) === 1;
          const reachedTarget = compareVersions(installed, update.available);
          const verified = movedForward && reachedTarget !== -1;

          if (WINGET_SUCCESS_RE.test(output) || verified) {
            status = 'updated';
            detail = installed ? `已更新到 ${installed}` : 'winget 报告安装成功';
          } else if (WINGET_NO_UPDATE_RE.test(output)) {
            status = 'up-to-date';
            detail = installed ? `当前版本 ${installed}，没有可用更新` : '没有可用更新';
          } else {
            status = 'failed';
            if (timingOut) {
              detail = interactive
                ? '交互更新超时，请确认安装向导是否完成。'
                : '更新超时，已终止 winget。该应用可能需要 UAC 或安装向导，请用“交互模式”重试。';
            } else if (WINGET_ELEVATION_RE.test(output)) {
              detail = '安装程序等待管理员授权或交互确认，请用“交互模式”重试。';
            } else if (!detail) {
              detail = installed
                ? `未能确认更新成功，当前版本 ${installed}`
                : `未能确认更新成功。${tailOf(output)}`;
            }
          }

          current.addItem({
            Name: app.DisplayName,
            Path: app.InstallLocation || '',
            Status: status,
            SizeMB: 0,
            Detail: detail
          });
          results.push({
            Index: i + 1,
            Name: app.DisplayName,
            Status: status,
            Detail: detail,
            NeedsInteractive: status === 'failed' && (timingOut || WINGET_ELEVATION_RE.test(output))
          });
          current.setProgress({
            current: i + 1,
            total: items.length,
            label: `${app.DisplayName} ${status === 'updated' ? '完成' : status === 'up-to-date' ? '已是最新' : '失败'}`
          });
        }
        return {
          Items: results,
          Updated: results.filter((item) => item.Status === 'updated').length,
          UpToDate: results.filter((item) => item.Status === 'up-to-date').length,
          Failed: results.filter((item) => item.Status === 'failed').length,
          NeedsInteractive: results.filter((item) => item.NeedsInteractive).map((item) => item.Name)
        };
      }
    });
  }

  function makeUninstallBatchJob(apps) {
    return jobs.create({
      kind: 'apps-uninstall',
      title: `卸载 ${apps.length} 个应用`,
      run: async (current) => {
        const input = await writeBridgeInput({ Apps: apps });
        let result = null;
        try {
          current.setProgress({ current: 0, total: apps.length, label: '准备卸载' });
          const run = await runPowerShellFile(
            bridgeScript,
            ['-Action', 'uninstall-batch', '-InputFile', input.file],
            {
              cwd: repoRoot,
              signal: current.signal,
              onLine: (line, stream) => {
                if (stream !== 'stdout' || !line.trim().startsWith('{')) {
                  current.log(stream, line);
                  return;
                }
                try {
                  const event = JSON.parse(line);
                  if (event?.type === 'item') current.addItem(event.data);
                  if (event?.type === 'progress') {
                    current.setProgress({
                      current: event.data?.Current,
                      total: event.data?.Total,
                      label: event.data?.Label,
                      indeterminate: event.data?.Indeterminate
                    });
                  }
                  if (event?.type === 'result') result = event.data;
                } catch {
                  current.log(stream, line);
                }
              }
            }
          );
          if (!result) result = parseBridgeResult(run.stdout);
          if (!result) throw new Error('批量卸载没有返回结果');
          current.setProgress({ current: apps.length, total: apps.length, label: '卸载任务完成' });
          return result;
        } finally {
          await input.cleanup();
        }
      }
    });
  }

  function makeUninstallJob(app) {
    return jobs.create({
      kind: 'uninstall',
      title: `卸载 ${app.DisplayName}`,
      run: async (current) => {
        const input = await writeBridgeInput({ App: app });
        let result = null;
        try {
          current.setProgress({ current: 0, total: 0, label: '准备卸载', indeterminate: true });
          current.log('stdout', `准备运行卸载程序：${app.DisplayName}`);
          const run = await runPowerShellFile(
            bridgeScript,
            ['-Action', 'uninstall', '-InputFile', input.file],
            {
              cwd: repoRoot,
              signal: current.signal,
              onLine: (line, stream) => {
                if (stream !== 'stdout' || !line.trim().startsWith('{')) {
                  current.log(stream, line);
                  return;
                }
                try {
                  const event = JSON.parse(line);
                  if (event?.type === 'result') result = event.data;
                } catch {
                  current.log(stream, line);
                }
              }
            }
          );
          if (!result) result = parseBridgeResult(run.stdout);
          if (!result) throw new Error('卸载任务没有返回结果');
          current.setProgress({ current: 1, total: 1, label: '卸载程序已启动' });
          return result;
        } finally {
          await input.cleanup();
        }
      }
    });
  }

  async function handleApi(request, response, pathname, url) {
    const segments = pathname.split('/').filter(Boolean);

    if (request.method === 'GET' && pathname === '/api/health') {
      const admin = await detectAdmin();
      sendJson(response, 200, {
        ok: true,
        version: GUI_VERSION,
        admin,
        systemDrive: process.env.SystemDrive || 'C:',
        repoRoot,
        reportsDir
      });
      return true;
    }

    if (request.method === 'GET' && pathname === '/api/scans') {
      const scans = await listScans(reportsDir);
      sendJson(response, 200, { scans });
      return true;
    }

    if (request.method === 'GET' && segments.length === 3 && segments[0] === 'api' && segments[1] === 'scans') {
      const id = assertScanId(decodeURIComponent(segments[2]));
      const scan = await getScan(reportsDir, id);
      sendJson(response, 200, { id, scan });
      return true;
    }

    if (request.method === 'GET' && pathname === '/api/drives') {
      const drives = await listDrives();
      sendJson(response, 200, { drives });
      return true;
    }

    if (request.method === 'GET' && pathname === '/api/system') {
      const system = await getSystemInfo({ force: url.searchParams.get('refresh') === '1' });
      sendJson(response, 200, { system });
      return true;
    }

    if (request.method === 'GET' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'ai' && segments[2] === 'plans') {
      const id = assertScanId(decodeURIComponent(segments[3]));
      let scan = await getScan(reportsDir, id);
      try {
        // Recompute against the current strategy rules so older scan files and
        // recently changed media/download layouts do not produce stale advice.
        const audit = await auditForScan(id);
        if (audit) scan = { ...scan, Audit: audit };
      } catch {
        // AI plans still work without the strategy audit.
      }
      const drives = await listDrives();
      const plans = generatePlans(scan, drives);
      const existing = [];
      for (const plan of plans) {
        if (plan.type === 'organize-media') {
          try {
            const stat = await fs.stat(plan.params.source);
            if (!stat.isDirectory()) continue;
            if (!(await folderHasMedia(plan.params.source, plan.params.kind))) continue;
          } catch {
            continue;
          }
        }
        existing.push(plan);
      }
      sendJson(response, 200, { scanId: id, plans: existing });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/ai/preview') {
      checkSameOrigin(request);
      const body = await readJson(request);
      const scanId = assertScanId(body.scan);
      const scan = await getScan(reportsDir, scanId);
      const plan = readPlan(body);

      let job;
      if (plan.type === 'clean-junk') {
        const items = cleanPlanItems(scan, plan);
        job = makeCleanJob(items, false, `AI 预览 · ${plan.title || '清理'}`);
      } else if (plan.type === 'organize-media') {
        const validated = await validateMediaPlan(scan, plan);
        job = makeMediaJob(validated, false);
      } else {
        const validated = await validateMigratePlan(scan, plan);
        job = makeMigrateJob(validated, false);
      }

      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/ai/execute') {
      checkSameOrigin(request);
      const body = await readJson(request);
      if (body.confirm !== true) throw new ApiError(400, 'AI action requires explicit confirmation');
      const scanId = assertScanId(body.scan);
      const scan = await getScan(reportsDir, scanId);
      const plan = readPlan(body);

      let job;
      if (plan.type === 'clean-junk') {
        const items = cleanPlanItems(scan, plan);
        if ((hasRiskyItems(items) || plan.risk === 'high') && body.acknowledgeRisky !== true) {
          throw new ApiError(400, 'This plan requires an additional acknowledgement');
        }
        job = makeCleanJob(items, true, `AI 执行 · ${plan.title || '清理'}`);
      } else if (plan.type === 'organize-media') {
        const validated = await validateMediaPlan(scan, plan);
        job = makeMediaJob(validated, true);
      } else {
        const validated = await validateMigratePlan(scan, plan);
        job = makeMigrateJob(validated, true);
      }

      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'GET' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'apps' && segments[2] === 'insights') {
      const scanId = assertScanId(decodeURIComponent(segments[3]));
      const scan = await getScan(reportsDir, scanId);
      const insights = await getAppInsights(scan, { force: url.searchParams.get('refresh') === '1' });
      sendJson(response, 200, { scanId, insights });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/apps/update') {
      checkSameOrigin(request);
      const body = await readJson(request);
      if (body.confirm !== true) throw new ApiError(400, 'App updates require explicit confirmation');
      const scanId = assertScanId(body.scan);
      const scan = await getScan(reportsDir, scanId);
      const indexes = Array.isArray(body.indexes)
        ? [...new Set(body.indexes.map(Number).filter((value) => Number.isInteger(value) && value >= 0))]
        : [];
      if (indexes.length === 0) throw new ApiError(400, 'Select at least one app');
      if (indexes.length > 100) throw new ApiError(400, 'Too many apps in one update');

      const insights = await getAppInsights(scan);
      const insightByIndex = new Map((insights.apps || []).map((entry) => [entry.index, entry]));
      const items = [];
      for (const index of indexes) {
        const entry = insightByIndex.get(index);
        const app = scan.InstalledApps[index];
        if (!app || !entry?.update) continue;
        items.push({ app, update: entry.update });
      }
      if (items.length === 0) throw new ApiError(400, 'None of the selected apps have an available update');
      const job = makeAppUpdateJob(items, { interactive: body.interactive === true });
      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/apps/uninstall-batch') {
      checkSameOrigin(request);
      const body = await readJson(request);
      if (body.confirm !== true) throw new ApiError(400, 'App uninstall requires explicit confirmation');
      const scanId = assertScanId(body.scan);
      const scan = await getScan(reportsDir, scanId);
      const indexes = Array.isArray(body.indexes)
        ? [...new Set(body.indexes.map(Number).filter((value) => Number.isInteger(value) && value >= 0))]
        : [];
      if (indexes.length === 0) throw new ApiError(400, 'Select at least one app');
      if (indexes.length > 50) throw new ApiError(400, 'Too many apps in one uninstall');
      const apps = indexes
        .map((index) => scan.InstalledApps[index])
        .filter((app) => app && app.UninstallString);
      if (apps.length === 0) throw new ApiError(400, 'None of the selected apps have an uninstall command');
      const job = makeUninstallBatchJob(apps);
      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/apps/uninstall') {
      checkSameOrigin(request);
      const body = await readJson(request);
      if (body.confirm !== true) throw new ApiError(400, 'Uninstall requires explicit confirmation');
      const scanId = assertScanId(body.scan);
      const index = Number(body.index);
      if (!Number.isInteger(index) || index < 0) throw new ApiError(400, 'Invalid app index');
      const scan = await getScan(reportsDir, scanId);
      const app = scan.InstalledApps[index];
      if (!app) throw new ApiError(400, 'App is not part of this scan');
      if (!app.UninstallString) throw new ApiError(400, 'This app has no uninstall command');
      const job = makeUninstallJob(app);
      sendJson(response, 202, { jobId: job.id, app: { DisplayName: app.DisplayName } });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/scan') {
      checkSameOrigin(request);
      const body = await readJson(request);
      const drives = normalizeDrives(body.drives);
      if (drives.length === 0) throw new ApiError(400, 'Select at least one drive');
      const excludes = normalizeExcludes(body.excludes);

      const args = ['scan', '-Drives', drives.join(',')];
      if (body.fast === true) args.push('-Fast');
      if (body.parallel === true) args.push('-Parallel');
      if (excludes.length > 0) args.push('-Exclude', excludes.join(','));

      const startedAt = Date.now();
      const job = jobs.create({
        kind: 'scan',
        title: `扫描 ${drives.join(' / ')}`,
        run: async (current) => {
          current.setProgress({ current: 0, total: drives.length + 1, label: '准备扫描' });
          current.log('stdout', `pwsh pc-manager.ps1 ${args.join(' ')}`);
          await runPowerShellFile(cliScript, args, {
            cwd: repoRoot,
            signal: current.signal,
            onLine: (line, stream) => {
              const scanning = line.match(/scanning\s+([A-Za-z]:)/i);
              if (scanning) {
                const index = drives.findIndex((drive) => drive.toUpperCase() === scanning[1].toUpperCase());
                if (index >= 0) {
                  current.setProgress({
                    current: index + 1,
                    total: drives.length + 1,
                    label: `扫描 ${scanning[1].toUpperCase()}`
                  });
                }
              } else if (/reading installed apps|orphan/i.test(line)) {
                current.setProgress({
                  current: drives.length,
                  total: drives.length + 1,
                  label: '分析安装应用与垃圾候选'
                });
              }
              current.log(stream, line);
            }
          });
          const scans = await listScans(reportsDir);
          const newest = scans.find((scan) => new Date(scan.modifiedAt).getTime() >= startedAt - 2000) ?? scans[0];
          if (!newest) throw new Error('Scan finished but no scan JSON was found');
          current.setProgress({ current: drives.length + 1, total: drives.length + 1, label: '扫描完成' });
          return { scanId: newest.id, drives, excludes, fast: body.fast === true, parallel: body.parallel === true };
        }
      });

      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/clean/preview') {
      checkSameOrigin(request);
      const body = await readJson(request);
      const scanId = assertScanId(body.scan);
      const scan = await getScan(reportsDir, scanId);
      const items = resolveCandidates(scan, body.paths);
      const job = makeCleanJob(items, false, `预览清理 ${items.length} 项`);
      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/clean/execute') {
      checkSameOrigin(request);
      const body = await readJson(request);
      if (body.confirm !== true) throw new ApiError(400, 'Cleanup requires explicit confirmation');
      const scanId = assertScanId(body.scan);
      const scan = await getScan(reportsDir, scanId);
      const items = resolveCandidates(scan, body.paths);
      if (hasRiskyItems(items) && body.acknowledgeRisky !== true) {
        throw new ApiError(400, 'Risky items require an additional acknowledgement');
      }
      const job = makeCleanJob(items, true, `清理 ${items.length} 项`);
      sendJson(response, 202, { jobId: job.id });
      return true;
    }

    if (request.method === 'GET' && segments.length === 3 && segments[0] === 'api' && segments[1] === 'jobs') {
      const job = jobs.get(decodeURIComponent(segments[2]));
      if (!job) throw new ApiError(404, 'Job not found');
      sendJson(response, 200, job.toJSON());
      return true;
    }

    if (request.method === 'GET' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'jobs' && segments[3] === 'events') {
      const job = jobs.get(decodeURIComponent(segments[2]));
      if (!job) throw new ApiError(404, 'Job not found');
      job.subscribe(response);
      return true;
    }

    if (request.method === 'POST' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'jobs' && segments[3] === 'cancel') {
      checkSameOrigin(request);
      const cancelled = jobs.cancel(decodeURIComponent(segments[2]));
      if (!cancelled) throw new ApiError(404, 'Job not found or already finished');
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/relaunch') {
      checkSameOrigin(request);
      const body = await readJson(request);
      if (body.confirm !== true) throw new ApiError(400, 'Restart requires confirmation');
      const admin = body.admin === true;
      const currentAdmin = await detectAdmin();
      if (admin === currentAdmin) {
        sendJson(response, 200, { ok: true, message: '已经是该权限模式' });
        return true;
      }
      if (!admin) {
        sendJson(response, 200, {
          ok: false,
          manual: true,
          message: '请关闭当前管理员窗口，然后运行 scripts\\start-gui.ps1（不要加 -Admin）。'
        });
        return true;
      }

      const host = String(request.headers.host || `127.0.0.1:${DEFAULT_PORT}`);
      const port = host.includes(':') ? host.split(':').pop() : String(DEFAULT_PORT);
      sendJson(response, 202, { ok: true, message: '正在请求管理员权限，请在 UAC 弹窗中确认…' });
      setTimeout(() => {
        spawn(
          'pwsh',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', START_GUI_SCRIPT, '-Port', port, '-NoOpen', '-Admin'],
          { cwd: repoRoot, detached: true, stdio: 'ignore', windowsHide: true }
        ).unref();
      }, 400);
      return true;
    }

    if (request.method === 'POST' && pathname === '/api/open') {
      checkSameOrigin(request);
      const body = await readJson(request);
      const target = path.resolve(String(body.path || ''));
      const reportsRoot = path.resolve(reportsDir);
      if (target !== reportsRoot && !target.startsWith(`${reportsRoot}${path.sep}`)) {
        throw new ApiError(403, 'Only report paths can be opened');
      }
      let stat;
      try {
        stat = await fs.stat(target);
      } catch {
        throw new ApiError(404, 'Path not found');
      }
      const folder = stat.isDirectory() ? target : path.dirname(target);
      if (process.platform === 'win32') {
        spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      }
      sendJson(response, 200, { ok: true, folder });
      return true;
    }

    return false;
  }

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://localhost');
      const pathname = url.pathname;

      if (pathname.startsWith('/api/')) {
        const handled = await handleApi(request, response, pathname, url);
        if (!handled) throw new ApiError(404, 'Not found');
        return;
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        const served = await serveStatic(response, publicDir, pathname);
        if (served) return;
      }

      throw new ApiError(404, 'Not found');
    } catch (error) {
      if (response.headersSent) {
        try { response.end(); } catch { /* ignore */ }
        return;
      }
      if (error instanceof ApiError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }
      console.error('[pc-manager-gui]', error);
      sendJson(response, 500, { error: error?.message || 'Internal server error' });
    }
  });

  return { server, jobs };
}

async function listenWithFallback(server, host, startPort, attempts = 10) {
  for (let offset = 0; offset < attempts; offset++) {
    const port = startPort + offset;
    try {
      await new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          server.off('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, host);
      });
      return server.address().port;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error(`No free port in range ${startPort}-${startPort + attempts - 1}`);
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}

function parseArgs(argv) {
  const options = {
    host: process.env.PC_MANAGER_GUI_HOST || DEFAULT_HOST,
    port: Number(process.env.PC_MANAGER_GUI_PORT || DEFAULT_PORT),
    open: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--open') options.open = true;
    else if (arg === '--no-open') options.open = false;
    else if (arg === '--host') options.host = argv[++i] || options.host;
    else if (arg.startsWith('--host=')) options.host = arg.slice('--host='.length);
    else if (arg === '--port') options.port = Number(argv[++i] || options.port);
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice('--port='.length));
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node gui/server.mjs [--port 7788] [--host 127.0.0.1] [--open]');
      process.exit(0);
    }
  }
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { server } = createApp();
  const port = await listenWithFallback(server, options.host, options.port);
  const url = `http://${options.host === '0.0.0.0' ? '127.0.0.1' : options.host}:${port}/`;

  console.log('');
  console.log('  pc-manager GUI');
  console.log(`  ${url}`);
  console.log(`  reports: ${REPORTS_DIR}`);
  console.log('  Ctrl+C to stop');
  console.log('');

  if (options.host !== '127.0.0.1' && options.host !== 'localhost' && options.host !== '::1') {
    console.warn('  WARNING: this server can delete files. Do not expose it to untrusted networks.');
  }
  if (options.open) openBrowser(url);

  const shutdown = () => {
    console.log('\n  shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main().catch((error) => {
    console.error('[pc-manager-gui] failed to start:', error.message);
    process.exit(1);
  });
}
