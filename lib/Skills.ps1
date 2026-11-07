function Install-PcSkills {
    [CmdletBinding()]
    param(
        [string]$Path,
        [switch]$Install
    )

    $src = Join-Path $script:PcRoot 'skills'
    if (-not (Test-Path -LiteralPath $src)) { throw "Skills folder not found: $src" }
    $skills = Get-ChildItem -LiteralPath $src -Directory -ErrorAction SilentlyContinue

    if (-not $Install) {
        Write-Host 'Available skills:'
        foreach ($s in $skills) { Write-Host "  - $($s.Name)" }
        Write-Host ''
        Write-Host 'Install with: pc-manager skills -Install [-SkillPath <dir>]'
        return
    }

    $dest = if ($Path) { $Path } else { Join-Path $env:USERPROFILE '.config\opencode\skills' }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($s in $skills) {
        Copy-Item -LiteralPath $s.FullName -Destination $dest -Recurse -Force
        Write-Host "Installed: $($s.Name) -> $dest"
    }
}
