[CmdletBinding()]
param(
    [int]$Port = 7788,
    [switch]$NoOpen,
    [switch]$Admin
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Test-IsElevated {
    return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )
}

function Stop-ExistingGui {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $connections) { return }

    $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $processIds) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
        if (-not $process) { continue }
        if ($process.Name -ne 'node.exe') { continue }
        if ($process.CommandLine -notmatch 'server\.mjs') { continue }
        Write-Host "Stopping existing pc-manager GUI (PID $processId) ..."
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
}

Stop-ExistingGui -Port $Port
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Warning "Port $Port is still in use; the GUI may start on another port. Close the old GUI window first."
}

if ($Admin -and -not (Test-IsElevated)) {
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Port', [string]$Port)
    if ($NoOpen) { $argList += '-NoOpen' }
    $quoted = $argList | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
    Write-Host 'Relaunching pc-manager GUI as administrator...'
    Start-Process -FilePath 'pwsh' -Verb RunAs -ArgumentList ($quoted -join ' ')
    return
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'Node.js 22+ is required for the GUI. Install Node.js and run this script again.'
}

$server = Join-Path $root 'gui\server.mjs'
$nodeArgs = @($server, '--port', [string]$Port)
if (-not $NoOpen) { $nodeArgs += '--open' }

& $node.Source @nodeArgs
