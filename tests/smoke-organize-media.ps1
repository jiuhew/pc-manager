[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script:PcRoot = $root
. (Join-Path $root 'lib\Core.ps1')
. (Join-Path $root 'lib\Clean.ps1')
. (Join-Path $root 'lib\Organize.ps1')

$tmp = Join-Path $root 'tests\tmp\organize-media'
Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
$src = Join-Path $tmp 'src'
$dst = Join-Path $tmp 'dst'
New-Item -ItemType Directory -Path $src -Force | Out-Null
$sourceFile = Join-Path $src '2024-05-01_clip.mp4'
[System.IO.File]::WriteAllBytes($sourceFile, (New-Object byte[] 1024))

Write-Host '=== preview ==='
$preview = Invoke-OrganizeMedia -Source $src -Destination $dst -Kind video
if ($preview.TotalFiles -ne 1) { throw "Expected 1 file, got $($preview.TotalFiles)" }
if ($preview.Planned -ne 1) { throw "Expected 1 planned, got $($preview.Planned)" }
if (-not (Test-Path -LiteralPath $sourceFile)) { throw 'Preview must not move files' }

Write-Host '=== execute ==='
$manifestRoot = Join-Path $tmp 'manifest'
$result = Invoke-OrganizeMedia -Source $src -Destination $dst -Kind video -Execute -ManifestRoot $manifestRoot
$expected = Join-Path $dst '2024\2024-05\2024-05-01_clip.mp4'
if ($result.Moved -ne 1) { throw "Expected 1 moved, got $($result.Moved)" }
if (-not (Test-Path -LiteralPath $expected)) { throw "Expected file missing: $expected" }
if (Test-Path -LiteralPath $sourceFile) { throw 'Source file still exists' }
if (-not (Test-Path -LiteralPath $result.ManifestPath)) { throw 'Manifest was not written' }
Write-Host "OK: $expected"
Write-Host "OK: manifest $($result.ManifestPath)"

Write-Host '=== date resolver ==='
$src2 = Join-Path $tmp 'src-resolver'
$dst2 = Join-Path $tmp 'dst-resolver'
$eventDir = Join-Path $src2 '2026\2026-10_event'
New-Item -ItemType Directory -Path $eventDir -Force | Out-Null
$resolverFile = Join-Path $eventDir 'resolver.jpg'
[System.IO.File]::WriteAllBytes($resolverFile, (New-Object byte[] 1024))
$resolver = {
    param($f)
    if ($f.FullName -match '2026-10_event') { return [datetime]'2026-10-01' }
    return $null
}
$manifestRoot2 = Join-Path $tmp 'manifest-resolver'
$resolved = Invoke-OrganizeMedia -Source $src2 -Destination $dst2 -Kind photo `
    -DateResolver $resolver -Execute -ManifestRoot $manifestRoot2
$expected2 = Join-Path $dst2 '2026\2026-10\resolver.jpg'
if ($resolved.Moved -ne 1) { throw "Expected 1 moved via resolver, got $($resolved.Moved)" }
if (-not (Test-Path -LiteralPath $expected2)) { throw "Date resolver target missing: $expected2" }
Write-Host "OK: $expected2"

Write-Host '=== protected source ==='
$blocked = $false
try {
    Invoke-OrganizeMedia -Source "$env:SystemRoot\System32" -Destination (Join-Path $tmp 'bad') -Kind all | Out-Null
} catch {
    $blocked = $true
}
if (-not $blocked) { throw 'Protected source was not rejected' }
Write-Host 'OK: protected source rejected'

Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'PASS'
