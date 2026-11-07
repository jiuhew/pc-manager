[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script:PcRoot = $root
. (Join-Path $root 'lib\Core.ps1')
. (Join-Path $root 'lib\Clean.ps1')

$tmp = Join-Path $root 'tests\tmp\clean-selection'
Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
$victim = Join-Path $tmp 'victim'
New-Item -ItemType Directory -Path $victim -Force | Out-Null
Set-Content -LiteralPath (Join-Path $victim 'file.txt') -Value 'delete me' -Encoding UTF8

Write-Host '=== preview ==='
$item = [pscustomobject]@{
    Name = 'Victim'; Path = $victim; Category = 'cache'; Safety = 'safe'; Mode = 'path'; Reason = 'smoke test'
}
$preview = Invoke-PcCleanSelection -Items @($item)
if ($preview.Items[0].Status -ne 'would-clean') { throw "Expected would-clean, got $($preview.Items[0].Status)" }
if (-not (Test-Path -LiteralPath $victim)) { throw 'Preview must not delete anything' }

Write-Host '=== execute ==='
$manifestRoot = Join-Path $tmp 'manifest'
$result = Invoke-PcCleanSelection -Items @($item) -Execute -ManifestRoot $manifestRoot
if ($result.Items[0].Status -ne 'cleaned') { throw "Expected cleaned, got $($result.Items[0].Status): $($result.Items[0].Detail)" }
if (Test-Path -LiteralPath $victim) { throw 'Victim folder still exists' }
if (-not (Test-Path -LiteralPath $result.ManifestPath)) { throw 'Manifest was not written' }
Write-Host "OK: cleaned, manifest at $($result.ManifestPath)"

Write-Host '=== protected paths ==='
if (-not (Test-PcProtectedPath -Path "$env:SystemRoot\WinSxS")) { throw 'WinSxS must be protected' }
$evil = [pscustomobject]@{
    Name = 'WinSxS'; Path = "$env:SystemRoot\WinSxS"; Category = 'system'; Safety = 'safe'; Mode = 'path'
}
$blocked = Invoke-PcCleanSelection -Items @($evil) -Execute -ManifestRoot (Join-Path $tmp 'manifest-protected')
if ($blocked.Items[0].Status -ne 'skipped') { throw 'Protected path was not skipped' }
Write-Host "OK: protected path skipped ($($blocked.Items[0].Detail))"

Write-Host '=== uninstall lookup (safe failure) ==='
$missing = Invoke-PcAppUninstall -App ([pscustomobject]@{ DisplayName = 'pc-manager-definitely-not-installed' })
if ($missing.Status -ne 'failed') { throw "Expected failed uninstall lookup, got $($missing.Status)" }
Write-Host "OK: missing app reported as failed ($($missing.Message))"

Remove-Item -LiteralPath $tmp -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'PASS'
