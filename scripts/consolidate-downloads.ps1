[CmdletBinding()]
param(
    [string[]]$Source = @('D:\迅雷下载', 'E:\BaiduNetdiskDownload'),
    [string]$Destination = 'D:\Downloads',
    [switch]$Execute,
    [string]$ManifestRoot
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$script:PcRoot = $root
. (Join-Path $root 'lib\Core.ps1')

function Get-TreeFiles {
    param([Parameter(Mandatory)][string]$Path)

    $files = [System.Collections.Generic.List[object]]::new()
    $bad = [System.Collections.Generic.List[string]]::new()
    $stack = [System.Collections.Generic.Stack[string]]::new()
    $stack.Push($Path)

    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
        foreach ($entry in $entries) {
            try {
                $attr = [int][System.IO.File]::GetAttributes($entry)
                if (($attr -band 0x400) -ne 0) { $bad.Add("reparse: $entry"); continue }
                if (($attr -band 0x10) -ne 0) { $stack.Push($entry); continue }
                if (($attr -band $script:CloudFlags) -ne 0) { $bad.Add("cloud placeholder: $entry"); continue }
                $files.Add([System.IO.FileInfo]$entry)
            } catch { }
        }
    }
    return [pscustomobject]@{ Files = $files; Bad = $bad }
}

$destinationFull = [System.IO.Path]::GetFullPath($Destination).TrimEnd('\')
if (-not (Test-Path -LiteralPath $destinationFull)) {
    if ($Execute) {
        New-Item -ItemType Directory -Path $destinationFull -Force | Out-Null
    } else {
        throw "Destination does not exist: $destinationFull"
    }
}

$plans = [System.Collections.Generic.List[object]]::new()
foreach ($s in $Source) {
    if (-not $s) { continue }
    if (-not (Test-Path -LiteralPath $s)) {
        Write-Host "SKIP missing: $s"
        continue
    }
    $item = Get-Item -LiteralPath $s -Force
    if (-not $item.PSIsContainer) { throw "Source is not a folder: $s" }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Source is a reparse point: $s"
    }
    $srcFull = $item.FullName.TrimEnd('\')
    if ($srcFull.Equals($destinationFull, [System.StringComparison]::OrdinalIgnoreCase) -or
        $srcFull.StartsWith($destinationFull + '\', [System.StringComparison]::OrdinalIgnoreCase) -or
        $destinationFull.StartsWith($srcFull + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Source and destination overlap: $srcFull -> $destinationFull"
    }

    $leaf = Split-Path $srcFull -Leaf
    $target = Join-Path $destinationFull $leaf

    $tree = Get-TreeFiles -Path $srcFull
    if ($tree.Bad.Count -gt 0) {
        throw ("Source contains reparse points or cloud placeholders; refusing to move it as a folder:`n" + (($tree.Bad | Select-Object -First 10) -join "`n"))
    }

    $sizeMB = (($tree.Files | Measure-Object Length -Sum).Sum) / 1MB
    $sameVolume = [System.IO.Path]::GetPathRoot($srcFull).Equals(
        [System.IO.Path]::GetPathRoot($destinationFull),
        [System.StringComparison]::OrdinalIgnoreCase
    )

    $plans.Add([pscustomobject]@{
        Source     = $srcFull
        Target     = $target
        Files      = $tree.Files
        FileCount  = $tree.Files.Count
        TotalMB    = [math]::Round([double]$sizeMB, 1)
        SameVolume = $sameVolume
        TopEntries = @(Get-ChildItem -LiteralPath $srcFull -Force -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
    })
}

if ($plans.Count -eq 0) {
    Write-Host 'Nothing to consolidate.'
    return
}

Write-Host ''
Write-Host 'Download consolidation plan:'
foreach ($p in $plans) {
    Write-Host ("  {0}" -f $p.Source)
    Write-Host ("    -> {0}" -f $p.Target)
    Write-Host ("    files: {0}  size: {1:N1} GB  same-volume: {2}" -f $p.FileCount, ($p.TotalMB / 1024), $p.SameVolume)
    Write-Host ("    top-level: {0}" -f (($p.TopEntries | Select-Object -First 8) -join ', '))
}
$totalFiles = ($plans | Measure-Object FileCount -Sum).Sum
$totalGB = (($plans | Measure-Object TotalMB -Sum).Sum) / 1024
Write-Host ''
Write-Host ("Total: {0} files / {1:N2} GB" -f $totalFiles, $totalGB)

if (-not $Execute) {
    Write-Host 'DRY RUN. Re-run with -Execute to move the folders and write a manifest.'
    return
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outRoot = if ($ManifestRoot) { $ManifestRoot } else { Join-Path $root "reports\organize\downloads-$timestamp" }
New-Item -ItemType Directory -Path $outRoot -Force | Out-Null
$manifest = [System.Collections.Generic.List[object]]::new()
$summaryRows = [System.Collections.Generic.List[object]]::new()

foreach ($p in $plans) {
    $moved = 0
    $failed = 0
    $firstError = ''
    New-Item -ItemType Directory -Path $p.Target -Force | Out-Null

    foreach ($file in $p.Files) {
        $relative = $file.FullName.Substring($p.Source.Length).TrimStart('\')
        $dest = Join-Path $p.Target $relative
        if (Test-Path -LiteralPath $dest) {
            $base = [System.IO.Path]::GetFileNameWithoutExtension($dest)
            $ext = [System.IO.Path]::GetExtension($dest)
            $parent = Split-Path $dest -Parent
            $counter = 1
            do {
                $dest = Join-Path $parent ('{0}_{1}{2}' -f $base, $counter, $ext)
                $counter++
            } while (Test-Path -LiteralPath $dest)
        }

        $fileStatus = 'moved'
        $errorText = ''
        try {
            $parent = Split-Path $dest -Parent
            if (-not (Test-Path -LiteralPath $parent)) {
                New-Item -ItemType Directory -Path $parent -Force | Out-Null
            }
            Move-Item -LiteralPath $file.FullName -Destination $dest -ErrorAction Stop
            $moved++
        } catch {
            $fileStatus = 'failed'
            $errorText = $_.Exception.Message
            $failed++
            if (-not $firstError) { $firstError = $errorText }
        }

        $manifest.Add([pscustomobject]@{
            Source      = $file.FullName
            Destination = $dest
            SizeMB      = [math]::Round($file.Length / 1MB, 2)
            Status      = $fileStatus
            Error       = $errorText
            Time        = (Get-Date).ToString('s')
        })
    }

    # Remove only a source tree with no files left; no user files are deleted.
    if (Test-Path -LiteralPath $p.Source) {
        $remainingFiles = @(Get-ChildItem -LiteralPath $p.Source -Recurse -File -Force -ErrorAction SilentlyContinue)
        if ($remainingFiles.Count -eq 0) {
            Remove-Item -LiteralPath $p.Source -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $summaryRows.Add([pscustomobject]@{
        Source      = $p.Source
        Destination = $p.Target
        Files       = $p.FileCount
        Moved       = $moved
        Failed      = $failed
        SizeGB      = [math]::Round($p.TotalMB / 1024, 2)
        Status      = if ($failed -gt 0) { 'partial' } else { 'moved' }
        Error       = $firstError
        Time        = (Get-Date).ToString('s')
    })
}

$manifestPath = Join-Path $outRoot 'manifest.csv'
$summaryPath = Join-Path $outRoot 'summary.csv'
$manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding utf8BOM
$summaryRows | Export-Csv -LiteralPath $summaryPath -NoTypeInformation -Encoding utf8BOM

Write-Host ''
Write-Host 'Result:'
$summaryRows | Format-Table Source, Destination, Files, SizeGB, Status, Error -AutoSize | Out-String -Width 240 | Write-Host
Write-Host "Manifest: $manifestPath"
Write-Host "Summary:  $summaryPath"
