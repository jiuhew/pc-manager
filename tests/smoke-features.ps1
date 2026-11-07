[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script:PcRoot = $root
$tmp = Join-Path $root 'tests\tmp\features'
Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $tmp 'dedupe') -Force | Out-Null

. (Join-Path $root 'lib\Core.ps1')
. (Join-Path $root 'lib\Classify.ps1')

Write-Host '=== dedupe: create 1.2 MB identical files ==='
$bytes = New-Object byte[] ([int](1.2MB))
[System.IO.File]::WriteAllBytes((Join-Path $tmp 'dedupe\a.bin'), $bytes)
[System.IO.File]::WriteAllBytes((Join-Path $tmp 'dedupe\b.bin'), $bytes)

Write-Host '=== dedupe: dry run ==='
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') dedupe -Source (Join-Path $tmp 'dedupe')

Write-Host '=== dedupe: execute (quarantine) ==='
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') dedupe -Source (Join-Path $tmp 'dedupe') -Execute
$remaining = @(Get-ChildItem (Join-Path $tmp 'dedupe') -File)
Write-Host "Remaining files: $($remaining.Count)"
if ($remaining.Count -ne 1) { throw 'dedupe failed: expected 1 remaining file' }

Write-Host '=== organize: move + junction ==='
$src = Join-Path $tmp 'move-src'
$dst = Join-Path $tmp 'move-dst'
New-Item -ItemType Directory -Path $src -Force | Out-Null
Set-Content -LiteralPath (Join-Path $src 'hello.txt') -Value 'hello' -Encoding UTF8
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') organize -Source $src -Destination $dst -Execute
if (-not (Test-Path -LiteralPath $dst)) { throw 'organize failed: destination missing' }
$link = Get-Item -LiteralPath $src -Force
if (($link.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { throw 'organize failed: source is not a junction' }
Write-Host 'OK: junction created'

Write-Host '=== single-drive migration analysis ==='
$singleDriveScan = [pscustomobject]@{
    Drives = @([pscustomobject]@{ Id = 'C:'; FreeGB = 50; TotalGB = 100; TopFolders = @() })
}
$migration = @(Get-MigrationCandidates -Scan $singleDriveScan -Config (Read-PcConfig))
if ($migration.Count -ne 0) { throw "Expected no migration candidates on a single-drive scan, got $($migration.Count)" }
Write-Host 'OK: no cross-drive migration on single-drive machine'

Write-Host '=== photo organizer dry run on E:\Photos ==='
if (Test-Path 'E:\Photos') {
    & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') organize -Source 'E:\Photos'
}

Write-Host '=== cleanup fixtures ==='
try { (Get-Item -LiteralPath $src -Force).Delete() } catch { }
Remove-Item -LiteralPath $dst -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item -LiteralPath 'D:\Backup\duplicates' -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'DONE'
