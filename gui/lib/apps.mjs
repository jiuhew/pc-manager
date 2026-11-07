import fs from 'node:fs/promises';
import path from 'node:path';

import { PWSH, runProcess, stripAnsi } from './ps.mjs';

const PREFETCH_DIR = 'C:\\Windows\\Prefetch';
const PREFETCH_CACHE_MS = 5 * 60 * 1000;
const USERASSIST_CACHE_MS = 2 * 60 * 1000;
const WINGET_CACHE_MS = 10 * 60 * 1000;

let prefetchCache = { at: 0, map: null, promise: null };
let userAssistCache = { at: 0, entries: null, promise: null };
let wingetCache = { at: 0, data: null, promise: null };

const USERASSIST_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$base = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist'
$rot13 = {
    param([string]$text)
    -join ($text.ToCharArray() | ForEach-Object {
        $code = [int]$_
        if ($code -ge 65 -and $code -le 90) { [char](65 + (($code - 65 + 13) % 26)) }
        elseif ($code -ge 97 -and $code -le 122) { [char](97 + (($code - 97 + 13) % 26)) }
        else { $_ }
    })
}
$rows = [System.Collections.Generic.List[object]]::new()
Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue | ForEach-Object {
    $countPath = Join-Path $_.PSPath 'Count'
    if (-not (Test-Path -LiteralPath $countPath)) { return }
    $props = Get-ItemProperty -LiteralPath $countPath -ErrorAction SilentlyContinue
    foreach ($p in $props.PSObject.Properties) {
        if ($p.Name -match '^PS') { continue }
        $name = & $rot13 $p.Name
        if ($name -match 'UEME_CTLSESSION|UEME_CTLCUACount') { continue }
        $bytes = $p.Value
        if ($bytes -isnot [byte[]] -or $bytes.Length -lt 68) { continue }
        $last = [BitConverter]::ToInt64($bytes, 60)
        if ($last -le 0) { continue }
        try { $dt = [DateTime]::FromFileTimeUtc($last) } catch { continue }
        if ($dt.Year -lt 2000) { continue }
        $run = [BitConverter]::ToInt32($bytes, 4)
        $rows.Add([pscustomobject]@{ name = $name; lastUsed = $dt.ToString('o'); runCount = $run })
    }
}
$rows | Sort-Object lastUsed -Descending | ConvertTo-Json -Depth 3 -Compress
`.trim();

const SYSTEMISH = /microsoft|windows|visual c\+\+|\.net|runtime|redistributable|sdk|driver|update|chipset|bluetooth|audio|management engine|realtek|intel|nvidia|amd|gigabyte|corsair|safenet|sentinel/i;
const GENERIC_TOKENS = new Set([
  'setup', 'update', 'updater', 'uninstall', 'installer', 'install', 'service',
  'helper', 'launcher', 'runtime', 'redistributable', 'microsoft', 'windows',
  'driver', 'preview', 'stable', 'beta', 'user', 'pro', 'x64', 'x86'
]);

export function normalizeAppName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(v?\d+(?:\.\d+)+|x64|x86|64-bit|32-bit|user|preview|beta|stable)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function appTokens(value) {
  return [...new Set(normalizeAppName(value).split(/\s+/).filter((token) => token.length >= 3 && !GENERIC_TOKENS.has(token)))];
}

async function loadPrefetchMap() {
  if (prefetchCache.map && Date.now() - prefetchCache.at < PREFETCH_CACHE_MS) return prefetchCache.map;
  if (prefetchCache.promise) return prefetchCache.promise;

  prefetchCache.promise = (async () => {
    const map = new Map();
    let entries = [];
    try {
      entries = await fs.readdir(PREFETCH_DIR);
    } catch {
      return map;
    }
    const prefetchFiles = entries.filter((name) => /\.pf$/i.test(name));
    await Promise.all(prefetchFiles.map(async (name) => {
      const base = name.replace(/\.pf$/i, '');
      const dash = base.lastIndexOf('-');
      const stem = (dash > 0 ? base.slice(0, dash) : base).replace(/\.exe$/i, '').toLowerCase();
      if (!stem) return;
      try {
        const stat = await fs.stat(path.join(PREFETCH_DIR, name));
        const previous = map.get(stem);
        if (!previous || stat.mtimeMs > previous) map.set(stem, stat.mtimeMs);
      } catch {
        // ignore unreadable prefetch entries
      }
    }));
    return map;
  })()
    .then((map) => {
      prefetchCache = { at: Date.now(), map, promise: null };
      return map;
    })
    .catch(() => {
      prefetchCache = { at: Date.now(), map: new Map(), promise: null };
      return prefetchCache.map;
    });

  return prefetchCache.promise;
}

async function loadUserAssistEntries() {
  if (userAssistCache.entries && Date.now() - userAssistCache.at < USERASSIST_CACHE_MS) return userAssistCache.entries;
  if (userAssistCache.promise) return userAssistCache.promise;

  userAssistCache.promise = runProcess(
    PWSH,
    ['-NoProfile', '-NonInteractive', '-Command', USERASSIST_SCRIPT],
    { windowsHide: true }
  )
    .then((result) => {
      let parsed;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        return [];
      }
      const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
      return rows
        .map((row) => {
          const date = new Date(row.lastUsed);
          if (Number.isNaN(date.getTime())) return null;
          const name = String(row.name || '');
          return {
            name,
            norm: normalizeAppName(name),
            tokens: appTokens(name),
            dateMs: date.getTime(),
            runCount: Number(row.runCount) || 0
          };
        })
        .filter(Boolean);
    })
    .catch(() => [])
    .then((entries) => {
      userAssistCache = { at: Date.now(), entries, promise: null };
      return entries;
    });

  return userAssistCache.promise;
}

function parseWingetOutput(raw) {
  const text = stripAnsi(raw);
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^-+$/.test(trimmed)) continue;
    if (/^(name|名称)\s/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s{2,}/);
    if (parts.length < 5) continue;
    const source = parts[parts.length - 1].toLowerCase();
    if (source !== 'winget' && source !== 'msstore') continue;
    const [name, id, version, ...rest] = parts;
    const available = rest.slice(0, -1).join(' ');
    if (!name || !id || !available) continue;
    rows.push({
      name,
      id,
      version,
      available,
      source
    });
  }
  return rows;
}

async function loadWingetUpdates() {
  if (wingetCache.data && Date.now() - wingetCache.at < WINGET_CACHE_MS) return wingetCache.data;
  if (wingetCache.promise) return wingetCache.promise;

  wingetCache.promise = runProcess(
    'winget',
    ['upgrade', '--include-unknown', '--accept-source-agreements', '--disable-interactivity'],
    { windowsHide: true }
  )
    .then((result) => {
      const updates = parseWingetOutput(result.stdout);
      return { updates, error: '' };
    })
    .catch((error) => {
      const updates = parseWingetOutput(error.stdout || '');
      return { updates, error: error.message || 'winget upgrade failed' };
    })
    .then((data) => {
      wingetCache = { at: Date.now(), data, promise: null };
      return data;
    });

  return wingetCache.promise;
}

function matchUpdate(app, updates) {
  const name = normalizeAppName(app.DisplayName);
  if (!name) return null;
  const tokens = new Set(appTokens(app.DisplayName));

  for (const update of updates) {
    const updateName = normalizeAppName(update.name);
    if (!updateName) continue;
    if (updateName === name) return update;
    if (updateName.includes(name) || name.includes(updateName)) return update;

    if (tokens.size > 0) {
      const overlap = appTokens(update.name).filter((token) => tokens.has(token));
      if (overlap.length >= Math.min(2, tokens.size)) return update;
    }
  }
  return null;
}

async function installLocationExeStems(app) {
  const raw = String(app.InstallLocation || '').replace(/^"|"$/g, '').trim();
  if (!raw) return [];
  try {
    const entries = await fs.readdir(raw, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.exe$/i.test(entry.name))
      .map((entry) => entry.name.replace(/\.exe$/i, '').toLowerCase());
  } catch {
    return [];
  }
}

async function lastUsedForApp(app, prefetchMap, userAssistEntries) {
  const tokens = appTokens(app.DisplayName);
  const candidates = new Set(tokens);
  for (const stem of await installLocationExeStems(app)) candidates.add(stem);

  let newest = 0;
  for (const candidate of candidates) {
    if (prefetchMap.has(candidate)) newest = Math.max(newest, prefetchMap.get(candidate));
  }
  for (const [stem, time] of prefetchMap) {
    if (stem.length < 4 || candidates.has(stem)) continue;
    for (const token of candidates) {
      if (token.length >= 4 && (stem === token || stem.startsWith(token) || token.startsWith(stem))) {
        newest = Math.max(newest, time);
        break;
      }
    }
  }

  const appNorm = normalizeAppName(app.DisplayName);
  for (const entry of userAssistEntries) {
    let matched = false;
    if (appNorm && entry.norm) {
      matched = entry.norm === appNorm || entry.norm.includes(appNorm) || appNorm.includes(entry.norm);
    }
    if (!matched) {
      const overlap = entry.tokens.filter((token) => candidates.has(token));
      matched = overlap.length >= Math.min(2, candidates.size) || overlap.some((token) => token.length >= 5);
    }
    if (matched) newest = Math.max(newest, entry.dateMs);
  }

  return newest > 0 ? new Date(newest) : null;
}

function isSystemish(app) {
  return SYSTEMISH.test(String(app.DisplayName || '')) || SYSTEMISH.test(String(app.Publisher || ''));
}

export async function getAppInsights(scan, options = {}) {
  const force = options.force === true;
  if (force) {
    prefetchCache = { at: 0, map: null, promise: null };
    wingetCache = { at: 0, data: null, promise: null };
  }

  const [prefetchMap, userAssistEntries, winget] = await Promise.all([
    loadPrefetchMap(),
    loadUserAssistEntries(),
    loadWingetUpdates()
  ]);
  const updates = winget.updates || [];
  const now = Date.now();
  const matchedUpdateIds = new Set();
  const apps = [];
  let suggestedUninstall = 0;
  let lastUsedKnown = 0;

  for (let index = 0; index < (scan.InstalledApps || []).length; index++) {
    const app = scan.InstalledApps[index];
    const update = matchUpdate(app, updates);
    if (update) matchedUpdateIds.add(update.id);
    const used = await lastUsedForApp(app, prefetchMap, userAssistEntries);
    const lastUsedDays = used ? Math.floor((now - used.getTime()) / 86400000) : null;
    if (used) lastUsedKnown++;
    const sizeGB = Number(app.EstimatedMB || 0) / 1024;

    let suggestion = false;
    let reason = '';
    if (!isSystemish(app) && lastUsedDays !== null) {
      if (lastUsedDays >= 365 && sizeGB >= 0.1) {
        suggestion = true;
        reason = `超过 ${lastUsedDays} 天未检测到使用记录`;
      } else if (lastUsedDays >= 180 && sizeGB >= 1) {
        suggestion = true;
        reason = `超过 ${lastUsedDays} 天未使用，且占用 ${sizeGB.toFixed(1)} GB`;
      }
    }
    if (suggestion) suggestedUninstall++;

    apps.push({
      index,
      update: update
        ? { id: update.id, available: update.available, version: update.version, source: update.source }
        : null,
      lastUsed: used ? used.toISOString() : null,
      lastUsedDays,
      lastUsedSource: used ? 'Prefetch / UserAssist 估算' : '',
      uninstallSuggested: suggestion,
      uninstallReason: reason,
      sizeGB: Math.round(sizeGB * 10) / 10
    });
  }

  const unmatchedUpdates = updates
    .filter((update) => !matchedUpdateIds.has(update.id))
    .map((update) => ({
      name: update.name,
      id: update.id,
      version: update.version,
      available: update.available,
      source: update.source
    }));

  return {
    generatedAt: new Date().toISOString(),
    lastUsedSource: 'Windows Prefetch + UserAssist（估算）',
    totalApps: apps.length,
    lastUsedKnown,
    updatesAvailable: updates.length,
    updatesMatched: updates.length - unmatchedUpdates.length,
    suggestedUninstall,
    wingetError: winget.error || '',
    apps,
    unmatchedUpdates
  };
}
