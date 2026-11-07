[CmdletBinding()]
param([switch]$Smoke)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = 0

Write-Host '=== PowerShell syntax ==='
$scripts = Get-ChildItem -LiteralPath $root -Recurse -Filter '*.ps1' -File |
    Where-Object { $_.FullName -notmatch '\\\.git\\' }
foreach ($f in $scripts) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -eq 0) {
        Write-Host "OK: $($f.FullName.Substring($root.Length + 1))"
    } else {
        $failures++
        Write-Host "FAIL: $($f.FullName.Substring($root.Length + 1))"
        foreach ($e in $errors) { Write-Host "  line $($e.Extent.StartLineNumber): $($e.Message)" }
    }
}

Write-Host '=== Skills ==='
$skillsRoot = Join-Path $root 'skills'
foreach ($s in (Get-ChildItem -LiteralPath $skillsRoot -Directory -ErrorAction SilentlyContinue)) {
    $skillFile = Join-Path $s.FullName 'SKILL.md'
    if (-not (Test-Path -LiteralPath $skillFile)) {
        $failures++
        Write-Host "FAIL: $($s.Name) missing SKILL.md"
        continue
    }
    $content = Get-Content -LiteralPath $skillFile -Raw -Encoding UTF8
    if ($content -notmatch '(?s)^---.*?name:.*?description:.*?---') {
        $failures++
        Write-Host "FAIL: $($s.Name) missing frontmatter name/description"
    } else {
        Write-Host "OK: $($s.Name)"
    }
}

Write-Host '=== CLI ==='
& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') version
if ($LASTEXITCODE -ne 0) { $failures++ }

if ($Smoke) {
    Write-Host '=== Smoke scan (system drive, fast) ==='
    $tmp = Join-Path $root 'tests\tmp'
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    & pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') scan -Drives $env:SystemDrive -Fast -Output $tmp
    if ($LASTEXITCODE -ne 0) { $failures++ }
    $json = Get-ChildItem -LiteralPath $tmp -Filter 'scan-*.json' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $json) {
        $failures++
        Write-Host 'FAIL: no scan JSON produced'
    } else {
        $scan = Get-Content -LiteralPath $json.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $scan.Drives -or $scan.Drives.Count -le 0) { $failures++; Write-Host 'FAIL: scan has no drives' }
        else { Write-Host "OK: scan produced $($scan.Drives.Count) drive(s)" }
    }
}

Write-Host ''
if ($failures -gt 0) {
    Write-Host "VALIDATION FAILED: $failures issue(s)"
    exit 1
}
Write-Host 'VALIDATION PASSED'
