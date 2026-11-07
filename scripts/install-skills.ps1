param([string]$Path)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$args = @('skills', '-Install')
if ($Path) { $args += @('-SkillPath', $Path) }

& pwsh -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pc-manager.ps1') @args
