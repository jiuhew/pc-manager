import path from 'node:path';
import { ApiError } from './errors.mjs';

const win32 = path.win32;

/**
 * Normalize a Windows path for comparison: forward slashes -> backslashes,
 * resolve "." / "..", lowercase, trim trailing separators.
 * Returns '' for empty or non-absolute input.
 */
export function normalizePath(input) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim();
  if (!trimmed) return '';

  const normalized = win32.normalize(trimmed.replace(/\//g, '\\'));
  if (!win32.isAbsolute(normalized)) return '';

  const lower = normalized.toLowerCase();
  if (/^[a-z]:\\$/.test(lower)) return lower;
  return lower.replace(/\\+$/, '');
}

function envPath(env, key, fallback) {
  const value = env?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export function protectedPaths(env = process.env) {
  const systemRoot = envPath(env, 'SystemRoot', 'C:\\Windows');
  const programData = envPath(env, 'ProgramData', 'C:\\ProgramData');
  const systemDrive = envPath(env, 'SystemDrive', 'C:');
  return [
    win32.join(systemRoot, 'WinSxS'),
    win32.join(systemRoot, 'Installer'),
    win32.join(programData, 'Package Cache'),
    win32.join(systemRoot, 'System32'),
    win32.join(systemRoot, 'SysWOW64'),
    win32.join(systemRoot, 'System Volume Information'),
    win32.join(`${systemDrive}\\`, 'pagefile.sys'),
    win32.join(`${systemDrive}\\`, 'hiberfil.sys'),
    win32.join(`${systemDrive}\\`, 'swapfile.sys'),
    win32.join(`${systemDrive}\\`, 'Recovery'),
    win32.join(`${systemDrive}\\`, 'Config.Msi')
  ].map(normalizePath).filter(Boolean);
}

function dangerousRoots(input, env) {
  const systemDrive = envPath(env, 'SystemDrive', 'C:');
  const roots = [
    win32.parse(input).root,
    envPath(env, 'SystemRoot', 'C:\\Windows'),
    win32.join(`${systemDrive}\\`, 'Users'),
    envPath(env, 'ProgramFiles', 'C:\\Program Files'),
    envPath(env, 'ProgramFiles(x86)', 'C:\\Program Files (x86)'),
    envPath(env, 'ProgramData', 'C:\\ProgramData'),
    envPath(env, 'USERPROFILE', ''),
    envPath(env, 'LOCALAPPDATA', ''),
    envPath(env, 'APPDATA', '')
  ];
  return roots.map(normalizePath).filter(Boolean);
}

/**
 * Mirrors Get-PcProtectedPath in lib/Clean.ps1. The server refuses these
 * before the PowerShell bridge is even started.
 */
export function isProtectedPath(input, env = process.env) {
  const target = normalizePath(input);
  if (!target) return true;

  for (const prefix of protectedPaths(env)) {
    if (target === prefix || target.startsWith(`${prefix}\\`)) return true;
  }
  for (const root of dangerousRoots(target, env)) {
    if (target === root) return true;
  }
  return false;
}

/**
 * Resolve user-selected paths against the junk list of a loaded scan.
 * Anything not present in that scan is rejected, so the HTTP API can never
 * be used to delete an arbitrary path.
 */
export function resolveCandidates(scan, requestedPaths, env = process.env) {
  if (!Array.isArray(requestedPaths) || requestedPaths.length === 0) {
    throw new ApiError(400, 'No cleanup items selected');
  }
  if (requestedPaths.length > 500) {
    throw new ApiError(400, 'Too many cleanup items in one request');
  }

  const junk = Array.isArray(scan?.Junk) ? scan.Junk : [];
  const byPath = new Map();
  for (const item of junk) {
    const key = normalizePath(item?.Path);
    if (key) byPath.set(key, item);
  }

  const seen = new Set();
  const selected = [];
  for (const raw of requestedPaths) {
    const key = normalizePath(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const item = byPath.get(key);
    if (!item) throw new ApiError(400, `Item is not part of this scan: ${raw}`);
    if (item.Safety === 'review') throw new ApiError(400, `Item requires manual review: ${item.Path}`);
    if (isProtectedPath(item.Path, env)) throw new ApiError(400, `Item is a protected system path: ${item.Path}`);
    selected.push(item);
  }

  if (selected.length === 0) throw new ApiError(400, 'No cleanup items selected');
  return selected;
}

export function hasRiskyItems(items) {
  return items.some((item) => item.Safety === 'confirm');
}
