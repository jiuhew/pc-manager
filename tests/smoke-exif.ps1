[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $root 'lib\Core.ps1')

$sample = Get-ChildItem 'E:\Photos' -Recurse -File -Include *.jpg,*.jpeg -ErrorAction SilentlyContinue |
    Select-Object -First 1
if (-not $sample) { throw 'No sample JPEG found' }

Write-Host '=== EXIF date ==='
Write-Host "File:       $($sample.FullName)"
Write-Host "LastWrite:  $($sample.LastWriteTime)"
$mediaDate = Get-MediaDate -File $sample
Write-Host "MediaDate:  $mediaDate"
if ($mediaDate -eq $sample.LastWriteTime) {
    Write-Host 'WARN: EXIF date equals file date (could be genuine or fallback)'
} else {
    Write-Host 'OK: EXIF date differs from file date'
}

Write-Host '=== organizer dry-run uses EXIF ==='
$tmp = Join-Path $root 'tests\tmp\exif'
Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
Copy-Item -LiteralPath $sample.FullName -Destination (Join-Path $tmp 'sample.jpg') -Force
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') organize -Source $tmp
Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'DONE'
