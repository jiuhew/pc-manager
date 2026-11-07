import { PWSH, runProcess } from './ps.mjs';

const DRIVE_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$drives = @(
    Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' |
        Sort-Object DeviceID |
        ForEach-Object {
            [pscustomobject]@{
                id         = $_.DeviceID
                label      = [string]$_.VolumeName
                fileSystem = [string]$_.FileSystem
                totalGB    = [math]::Round($_.Size / 1GB, 2)
                freeGB     = [math]::Round($_.FreeSpace / 1GB, 2)
                usedGB     = [math]::Round(($_.Size - $_.FreeSpace) / 1GB, 2)
            }
        }
)
ConvertTo-Json -InputObject $drives -Compress
`.trim();

const CACHE_MS = 5000;
let cache = { at: 0, drives: null, promise: null };

function parseDrives(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
  const systemDrive = (process.env.SystemDrive || 'C:').toUpperCase();
  return list
    .filter((drive) => /^[A-Z]:$/i.test(String(drive?.id || '')))
    .map((drive) => ({
      id: String(drive.id).toUpperCase(),
      label: String(drive.label || ''),
      fileSystem: String(drive.fileSystem || ''),
      totalGB: Number(drive.totalGB) || 0,
      freeGB: Number(drive.freeGB) || 0,
      usedGB: Number(drive.usedGB) || 0,
      system: String(drive.id).toUpperCase() === systemDrive
    }))
    .sort((a, b) => (a.system === b.system ? a.id.localeCompare(b.id) : a.system ? -1 : 1));
}

export async function listDrives({ force = false } = {}) {
  if (!force && cache.drives && Date.now() - cache.at < CACHE_MS) return cache.drives;
  if (cache.promise) return cache.promise;

  cache.promise = runProcess(PWSH, ['-NoProfile', '-NonInteractive', '-Command', DRIVE_SCRIPT], {
    windowsHide: true
  })
    .then((result) => {
      const drives = parseDrives(result.stdout);
      cache = { at: Date.now(), drives, promise: null };
      return drives;
    })
    .catch(() => {
      cache = { at: Date.now(), drives: [], promise: null };
      return [];
    });

  return cache.promise;
}
