import fs from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './errors.mjs';

const SCAN_ID_RE = /^scan-[A-Za-z0-9._-]+\.json$/;
const cache = new Map();

export function isScanId(value) {
  return typeof value === 'string' && SCAN_ID_RE.test(value);
}

export function assertScanId(value) {
  if (!isScanId(value)) throw new ApiError(400, 'Invalid scan id');
  return value;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Drop the very large, low-value arrays (EmptyDirs can be ~90% of a scan file)
 * while keeping everything the GUI renders.
 */
export function compactScan(scan) {
  const junk = asArray(scan?.Junk);
  const drives = asArray(scan?.Drives).map((drive) => ({
    Id: drive.Id,
    Root: drive.Root,
    TotalGB: drive.TotalGB,
    FreeGB: drive.FreeGB,
    UsedGB: drive.UsedGB,
    TotalFiles: drive.TotalFiles,
    TotalSizeGB: drive.TotalSizeGB,
    DirCount: drive.DirCount,
    ScanSeconds: drive.ScanSeconds,
    TopFolders: asArray(drive.TopFolders),
    Extensions: asArray(drive.Extensions),
    LargeFiles: asArray(drive.LargeFiles),
    Cloud: asArray(drive.Cloud),
    ExcludedDirs: asArray(drive.ExcludedDirs),
    EmptyDirCount: asArray(drive.EmptyDirs).length,
    ReparsePointCount: asArray(drive.ReparsePoints).length
  }));

  return {
    SchemaVersion: scan?.SchemaVersion ?? 0,
    GeneratedAt: scan?.GeneratedAt ?? '',
    Computer: scan?.Computer ?? '',
    User: scan?.User ?? '',
    OS: scan?.OS ?? '',
    FastMode: Boolean(scan?.FastMode),
    ParallelMode: Boolean(scan?.ParallelMode),
    ExcludeDirs: asArray(scan?.ExcludeDirs),
    ScanSeconds: scan?.ScanSeconds ?? 0,
    Drives: drives,
    InstalledApps: asArray(scan?.InstalledApps),
    Orphans: scan?.Orphans ?? { UninstallEntries: [], RunKeys: [], AppxData: [] },
    Junk: junk,
    Migration: asArray(scan?.Migration),
    Media: scan?.Media ?? {},
    Recommendations: asArray(scan?.Recommendations),
    Audit: scan?.Audit ?? null
  };
}

export function scanMeta(id, scan, stat) {
  const junkGB = scan.Junk.reduce((sum, item) => {
    const gb = Number(item?.SizeGB);
    if (Number.isFinite(gb) && gb > 0) return sum + gb;
    return sum + (Number(item?.SizeMB) || 0) / 1024;
  }, 0);

  return {
    id,
    fileName: id,
    sizeBytes: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    generatedAt: scan.GeneratedAt,
    computer: scan.Computer,
    user: scan.User,
    fastMode: scan.FastMode,
    scanSeconds: scan.ScanSeconds,
    drives: scan.Drives.map((d) => ({
      id: d.Id,
      totalGB: d.TotalGB,
      freeGB: d.FreeGB,
      usedGB: d.UsedGB
    })),
    junkCount: scan.Junk.length,
    junkGB: Math.round(junkGB * 100) / 100,
    migrationCount: scan.Migration.length
  };
}

export async function getScan(reportsDir, id) {
  assertScanId(id);
  const file = path.join(reportsDir, id);
  let stat;
  try {
    stat = await fs.stat(file);
  } catch {
    throw new ApiError(404, `Scan not found: ${id}`);
  }

  const cacheKey = `${stat.mtimeMs}:${stat.size}`;
  const cached = cache.get(file);
  if (cached && cached.key === cacheKey) return cached.scan;

  let raw;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    throw new ApiError(404, `Scan not found: ${id}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(422, `Scan file is not valid JSON: ${id}`);
  }

  const compact = compactScan(parsed);
  cache.set(file, { key: cacheKey, scan: compact });
  return compact;
}

export async function listScans(reportsDir) {
  let entries;
  try {
    entries = await fs.readdir(reportsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const scans = [];
  for (const entry of entries) {
    if (!entry.isFile() || !isScanId(entry.name)) continue;
    try {
      const file = path.join(reportsDir, entry.name);
      const [scan, stat] = await Promise.all([getScan(reportsDir, entry.name), fs.stat(file)]);
      scans.push(scanMeta(entry.name, scan, stat));
    } catch {
      // Skip unreadable or half-written scan files.
    }
  }

  scans.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
  return scans;
}

export function clearScanCache() {
  cache.clear();
}
