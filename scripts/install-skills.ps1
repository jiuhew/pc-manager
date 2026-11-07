param([string]$Path)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$arguments = @('skills', '-Install')
if ($Path) { $arguments += @('-SkillPath', $Path) }

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') @arguments
