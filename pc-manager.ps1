[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('scan', 'report', 'audit', 'clean', 'organize', 'dedupe', 'skills', 'version', 'help')]
    [string]$Command = 'help',

    [string[]]$Drives,
    [string[]]$Exclude,
    [switch]$Fast,
    [switch]$Parallel,
    [string]$ScanPath,
    [string]$Output,
    [ValidateSet('md', 'html', 'json')]
    [string]$Format = 'md',
    [switch]$Execute,
    [switch]$Admin,
    [string]$Category,
    [string]$Source,
    [string]$Destination,
    [switch]$Install,
    [string]$SkillPath,
    [switch]$Json,
    [switch]$KeepDuplicates,
    [switch]$NoExif,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:PcRoot = Split-Path -Parent $PSCommandPath
. (Join-Path $script:PcRoot 'lib\Core.ps1')
. (Join-Path $script:PcRoot 'lib\Inventory.ps1')
. (Join-Path $script:PcRoot 'lib\Strategy.ps1')
. (Join-Path $script:PcRoot 'lib\Classify.ps1')
. (Join-Path $script:PcRoot 'lib\Report.ps1')
. (Join-Path $script:PcRoot 'lib\Clean.ps1')
. (Join-Path $script:PcRoot 'lib\Organize.ps1')
. (Join-Path $script:PcRoot 'lib\Skills.ps1')

function Write-Usage {
    @'
pc-manager - fast Windows disk inventory and AI-ready reports

Usage:
  pc-manager scan [-Drives C,D,E] [-Fast] [-Exclude <dir1,dir2>] [-Parallel] [-Output reports]
  pc-manager report -ScanPath reports\scan-xxx.json [-Output report.md] [-Format md|html]
  pc-manager audit -ScanPath reports\scan-xxx.json [-Output audit.md] [-Json]
  pc-manager clean [-ScanPath scan.json] [-Category cache|system|installers|orphans|recycle] [-Execute] [-Admin]
  pc-manager organize -Source C:\Path -Destination D:\Path [-Execute]
  pc-manager organize -Source E:\Photos [-NoExif] [-Execute]  # photo year/month organizer
  pc-manager dedupe -Source D:\SomeFolder [-Execute] [-KeepDuplicates]
  pc-manager skills [-Install] [-SkillPath <dir>]
  pc-manager version

Safety:
  scan and report are read-only. clean/dedupe/organize only act with -Execute.
'@
}

function Get-ScanFromPath {
    param([string]$Path)
    if (-not $Path) { return (Invoke-PcScan -Drives $Drives -Fast:$Fast -ExcludeDirs $Exclude -Parallel:$Parallel) }
    if (-not (Test-Path -LiteralPath $Path)) { throw "Input not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

switch ($Command) {
    'scan' {
        $scan = Invoke-PcScan -Drives $Drives -Fast:$Fast -ExcludeDirs $Exclude -Parallel:$Parallel
        $scan = Add-PcAnalysis -Scan $scan
        $outDir = if ($Output) { $Output } else { Join-Path $script:PcRoot 'reports' }
        New-Item -ItemType Directory -Path $outDir -Force | Out-Null
        $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
        $jsonPath = Join-Path $outDir "scan-$ts.json"
        $scan | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
        $report = New-MarkdownReport -Scan $scan
        $mdPath = Join-Path $outDir "scan-$ts.md"
        Set-Content -LiteralPath $mdPath -Value $report -Encoding UTF8
        Write-Host "Scan JSON: $jsonPath"
        Write-Host "Report:    $mdPath"
        if ($Json) { $scan | ConvertTo-Json -Depth 12 }
    }

    'report' {
        if (-not $ScanPath) { throw 'report requires -ScanPath <scan.json>' }
        $scan = Get-ScanFromPath $ScanPath
        $report = if ($Format -eq 'html') { New-HtmlReport -Scan $scan } else { New-MarkdownReport -Scan $scan }
        $outFile = if ($Output) { $Output } else { [System.IO.Path]::ChangeExtension($ScanPath, $(if ($Format -eq 'html') { '.html' } else { '.md' })) }
        Set-Content -LiteralPath $outFile -Value $report -Encoding UTF8
        Write-Host "Report: $outFile"
    }

    'audit' {
        if (-not $ScanPath) { throw 'audit requires -ScanPath <scan.json>' }
        $scan = Get-ScanFromPath $ScanPath
        if (-not $scan.PSObject.Properties['Junk']) { $scan = Add-PcAnalysis -Scan $scan }
        # Recompute so the audit reflects the current strategy rules instead of
        # a possibly stale Audit object embedded in the scan file.
        $audit = Invoke-StorageAudit -Scan $scan
        if ($Json) {
            $audit | ConvertTo-Json -Depth 12
            return
        }
        $markdown = New-StorageAuditMarkdown -Audit $audit
        $outFile = if ($Output) {
            $Output
        } else {
            Join-Path (Join-Path $script:PcRoot 'reports') ("audit-{0}.md" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        }
        $parent = Split-Path -Parent $outFile
        if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Set-Content -LiteralPath $outFile -Value $markdown -Encoding UTF8
        Write-Host "Audit: $outFile"
        Write-Host ("Health: {0}/100 ({1}) · Findings: {2}" -f $audit.HealthScore, $audit.Grade, @($audit.Findings).Count)
    }

    'clean' {
        $scan = Get-ScanFromPath $ScanPath
        $config = Read-PcConfig
        $junk = if ($scan.PSObject.Properties['Junk'] -and @($scan.Junk).Count -gt 0) {
            @($scan.Junk)
        } else {
            Get-JunkCandidates -Scan $scan -Config $config
        }
        if ($Category) { $junk = @($junk | Where-Object { $_.Category -eq $Category }) }
        Invoke-Clean -Junk $junk -Execute:$Execute -Admin:$Admin
    }

    'organize' {
        if (-not $Source) { throw 'organize requires -Source' }
        if ($Destination) {
            Invoke-Organize -Source $Source -Destination $Destination -Execute:$Execute -Force:$Force | Out-Null
        } else {
            Invoke-OrganizePhotos -Source $Source -Execute:$Execute -NoExif:$NoExif
        }
    }

    'dedupe' {
        if (-not $Source) { throw 'dedupe requires -Source <folder>' }
        Invoke-Dedupe -Root $Source -Execute:$Execute -KeepDuplicates:$KeepDuplicates
    }

    'skills' {
        Install-PcSkills -Path $SkillPath -Install:$Install
    }

    'version' {
        Write-Host "pc-manager $script:PcManagerVersion"
    }

    default {
        Write-Usage
    }
}
