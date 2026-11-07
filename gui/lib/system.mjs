import os from 'node:os';
import { PWSH, runProcess } from './ps.mjs';

const SYSTEM_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$vramByAdapter = @{}
$classRoot = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
Get-ChildItem -LiteralPath $classRoot -ErrorAction SilentlyContinue | ForEach-Object {
    $props = Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
    if ($props.DriverDesc) {
        $bytes = $props.'HardwareInformation.qwMemorySize'
        if (-not $bytes) { $bytes = $props.'HardwareInformation.MemorySize' }
        if ($bytes) { $vramByAdapter[([string]$props.DriverDesc).Trim()] = [double]$bytes }
    }
}
$nvidiaMemory = @{}
$smi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
if ($smi) {
    & $smi.Source --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null | ForEach-Object {
        $parts = @($_ -split ',' | ForEach-Object { $_.Trim() })
        if ($parts.Count -ge 2) { $nvidiaMemory[$parts[0]] = [double]$parts[1] * 1MB }
    }
}
$gpus = @(
    Get-CimInstance Win32_VideoController | ForEach-Object {
        $gpuKey = ([string]$_.Name).Trim()
        $vram = $vramByAdapter[$gpuKey]
        if (-not $vram) { $vram = $nvidiaMemory[$gpuKey] }
        if (-not $vram) { $vram = [double]$_.AdapterRAM }
        [pscustomobject]@{
            name = [string]$_.Name
            vramBytes = $vram
            driver = [string]$_.DriverVersion
        }
    }
)
$board = Get-CimInstance Win32_BaseBoard
$bios = Get-CimInstance Win32_BIOS
$os = Get-CimInstance Win32_OperatingSystem
$memory = @(
    Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
        [pscustomobject]@{
            capacityBytes = [double]$_.Capacity
            speedMHz = [int]$_.Speed
            manufacturer = [string]$_.Manufacturer
            partNumber = [string]$_.PartNumber
            slot = [string]$_.DeviceLocator
        }
    }
)
$disks = @(
    Get-CimInstance Win32_DiskDrive | ForEach-Object {
        [pscustomobject]@{
            model = [string]$_.Model
            sizeBytes = [double]$_.Size
            interface = [string]$_.InterfaceType
            mediaType = [string]$_.MediaType
        }
    }
)
[pscustomobject]@{
    hostname = $env:COMPUTERNAME
    manufacturer = [string]$cs.Manufacturer
    model = [string]$cs.Model
    totalMemoryBytes = [double]$cs.TotalPhysicalMemory
    cpu = if ($cpu) {
        [pscustomobject]@{
            name = [string]$cpu.Name
            cores = [int]$cpu.NumberOfCores
            logical = [int]$cpu.NumberOfLogicalProcessors
            maxClockMHz = [int]$cpu.MaxClockSpeed
        }
    } else { $null }
    gpus = $gpus
    board = [pscustomobject]@{ manufacturer = [string]$board.Manufacturer; product = [string]$board.Product }
    bios = [pscustomobject]@{
        version = [string]$bios.SMBIOSBIOSVersion
        date = $(if ($bios.ReleaseDate) { $bios.ReleaseDate.ToString('yyyy-MM-dd') } else { '' })
    }
    os = [pscustomobject]@{
        caption = [string]$os.Caption
        version = [string]$os.Version
        build = [string]$os.BuildNumber
        arch = [string]$os.OSArchitecture
        installDate = $(if ($os.InstallDate) { $os.InstallDate.ToString('yyyy-MM-dd') } else { '' })
        lastBoot = $(if ($os.LastBootUpTime) { $os.LastBootUpTime.ToString('yyyy-MM-dd HH:mm') } else { '' })
    }
    memoryModules = $memory
    physicalDisks = $disks
} | ConvertTo-Json -Depth 6 -Compress
`.trim();

const CACHE_MS = 15000;
let cache = { at: 0, system: null, promise: null };

function bytesToGB(value) {
  return Math.round((Number(value) || 0) / (1024 ** 3) * 10) / 10;
}

function parseSystem(raw) {
  let source;
  try {
    source = JSON.parse(raw);
  } catch {
    return null;
  }

  const modules = Array.isArray(source?.memoryModules) ? source.memoryModules : [];
  const totalMemoryBytes = Number(source?.totalMemoryBytes)
    || modules.reduce((sum, module) => sum + (Number(module?.capacityBytes) || 0), 0);
  const totalMemoryGB = bytesToGB(totalMemoryBytes);
  const freeMemoryGB = bytesToGB(os.freemem());
  const usedMemoryGB = Math.max(0, Math.round((totalMemoryGB - freeMemoryGB) * 10) / 10);

  return {
    hostname: String(source?.hostname || os.hostname()),
    manufacturer: String(source?.manufacturer || ''),
    model: String(source?.model || ''),
    cpu: source?.cpu
      ? {
          name: String(source.cpu.name || '').replace(/\s+/g, ' ').trim(),
          cores: Number(source.cpu.cores) || 0,
          logical: Number(source.cpu.logical) || 0,
          maxClockGHz: Math.round((Number(source.cpu.maxClockMHz) || 0) / 100) / 10
        }
      : null,
    memory: {
      totalGB: totalMemoryGB,
      freeGB: freeMemoryGB,
      usedGB: usedMemoryGB,
      modules: modules.map((module) => ({
        capacityGB: bytesToGB(module?.capacityBytes),
        speedMHz: Number(module?.speedMHz) || 0,
        manufacturer: String(module?.manufacturer || ''),
        partNumber: String(module?.partNumber || ''),
        slot: String(module?.slot || '')
      }))
    },
    gpus: (Array.isArray(source?.gpus) ? source.gpus : []).map((gpu) => ({
      name: String(gpu?.name || ''),
      vramGB: bytesToGB(gpu?.vramBytes),
      driver: String(gpu?.driver || '')
    })),
    board: {
      manufacturer: String(source?.board?.manufacturer || ''),
      product: String(source?.board?.product || '')
    },
    bios: {
      version: String(source?.bios?.version || ''),
      date: String(source?.bios?.date || '')
    },
    os: {
      caption: String(source?.os?.caption || ''),
      version: String(source?.os?.version || ''),
      build: String(source?.os?.build || ''),
      arch: String(source?.os?.arch || ''),
      installDate: String(source?.os?.installDate || ''),
      lastBoot: String(source?.os?.lastBoot || '')
    },
    disks: (Array.isArray(source?.physicalDisks) ? source.physicalDisks : []).map((disk) => ({
      model: String(disk?.model || '').trim(),
      sizeGB: bytesToGB(disk?.sizeBytes),
      interface: String(disk?.interface || ''),
      mediaType: String(disk?.mediaType || '')
    })),
    uptimeHours: Math.round((os.uptime() / 3600) * 10) / 10,
    generatedAt: new Date().toISOString()
  };
}

export async function getSystemInfo({ force = false } = {}) {
  if (!force && cache.system && Date.now() - cache.at < CACHE_MS) return cache.system;
  if (cache.promise) return cache.promise;

  cache.promise = runProcess(PWSH, ['-NoProfile', '-NonInteractive', '-Command', SYSTEM_SCRIPT], {
    windowsHide: true
  })
    .then((result) => {
      const system = parseSystem(result.stdout);
      cache = { at: Date.now(), system, promise: null };
      return system;
    })
    .catch(() => {
      cache = { at: Date.now(), system: null, promise: null };
      return null;
    });

  return cache.promise;
}
