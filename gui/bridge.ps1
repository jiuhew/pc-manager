[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('measure', 'clean', 'organize-media', 'migrate', 'uninstall', 'uninstall-batch', 'audit')]
    [string]$Action,

    [Parameter(Mandatory)]
    [string]$InputFile,

    [string]$ManifestRoot
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$script:PcRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $script:PcRoot 'lib\Core.ps1')
. (Join-Path $script:PcRoot 'lib\Strategy.ps1')
. (Join-Path $script:PcRoot 'lib\Classify.ps1')
. (Join-Path $script:PcRoot 'lib\Clean.ps1')
. (Join-Path $script:PcRoot 'lib\Organize.ps1')

if (-not (Test-Path -LiteralPath $InputFile)) {
    throw "Input file not found: $InputFile"
}

$payload = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json

$emitItem = {
    param($row)
    $line = @{ type = 'item'; data = $row } | ConvertTo-Json -Compress -Depth 8
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
}

$emitProgress = {
    param([hashtable]$progress)
    $line = @{ type = 'progress'; data = $progress } | ConvertTo-Json -Compress -Depth 5
    [Console]::Out.WriteLine($line)
    [Console]::Out.Flush()
}

switch ($Action) {
    'measure' {
        $result = Invoke-PcCleanSelection -Items @($payload.Items) -OnItem $emitItem
    }
    'clean' {
        $result = Invoke-PcCleanSelection -Items @($payload.Items) -Execute -ManifestRoot $ManifestRoot -OnItem $emitItem
    }
    'organize-media' {
        $execute = [bool]$payload.Execute
        $kind = if ($payload.Kind) { [string]$payload.Kind } else { 'video' }
        $result = Invoke-OrganizeMedia -Source $payload.Source -Destination $payload.Destination -Kind $kind `
            -Execute:$execute -ManifestRoot $ManifestRoot -OnItem $emitItem -OnProgress $emitProgress
    }
    'migrate' {
        $execute = [bool]$payload.Execute
        $result = Invoke-Organize -Source $payload.Source -Destination $payload.Destination `
            -Execute:$execute -ManifestRoot $ManifestRoot
    }
    'uninstall' {
        $result = Invoke-PcAppUninstall -App $payload.App
    }
    'uninstall-batch' {
        $apps = @($payload.Apps)
        $items = [System.Collections.Generic.List[object]]::new()
        $index = 0
        foreach ($app in $apps) {
            $index++
            $item = Invoke-PcAppUninstall -App $app
            $row = [pscustomobject]@{
                Index   = $index
                Name    = [string]$app.DisplayName
                Path    = [string]$app.InstallLocation
                SizeMB  = [double]$app.EstimatedMB
                Status  = [string]$item.Status
                Detail  = [string]$item.Message
            }
            $items.Add($row)
            & $emitItem $row
            & $emitProgress @{
                Current = $index
                Total   = $apps.Count
                Label   = "卸载 $($app.DisplayName)"
                Indeterminate = $false
            }
        }
        $result = [pscustomobject]@{
            Items = @($items)
            Completed = @($items | Where-Object Status -eq 'completed').Count
            Started = @($items | Where-Object Status -eq 'started').Count
            Failed = @($items | Where-Object Status -eq 'failed').Count
        }
    }
    'audit' {
        $scanPath = [string]$payload.ScanPath
        if (-not $scanPath -or -not (Test-Path -LiteralPath $scanPath)) {
            throw "Scan file not found: $scanPath"
        }
        $scan = Get-Content -LiteralPath $scanPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not $scan.PSObject.Properties['Junk']) { $scan = Add-PcAnalysis -Scan $scan }
        $result = Invoke-StorageAudit -Scan $scan
    }
}

@{
    type = 'result'
    data = $result
} | ConvertTo-Json -Compress -Depth 10
