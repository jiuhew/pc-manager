function Invoke-Organize {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [switch]$Execute,
        [switch]$Force,
        [string]$ManifestRoot
    )

    $item = Get-Item -LiteralPath $Source -Force -ErrorAction Stop
    $src = $item.FullName
    if ($src -match '^[A-Za-z]:\\?$') { throw 'Refusing to move a drive root.' }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Source is already a junction/reparse point.'
    }
    if (Get-Command Test-PcProtectedPath -ErrorAction SilentlyContinue) {
        if (Test-PcProtectedPath -Path $src) { throw "Refusing to move a protected path: $src" }
        if (Test-PcProtectedPath -Path $Destination) { throw "Refusing to move to a protected path: $Destination" }
    }
    if (Test-Path -LiteralPath $Destination) { throw "Destination already exists: $Destination" }

    $sizeMB = Get-DirSizeMB -Path $src
    if (-not $Execute) {
        Write-Host "[DRY-RUN] Move: $src"
        Write-Host "[DRY-RUN]   ->  $Destination ($sizeMB MB)"
        Write-Host "[DRY-RUN] Then create junction: $src -> $Destination"
        return [pscustomobject]@{
            Execute    = $false
            Status     = 'would-move'
            Source     = $src
            Destination = $Destination
            SizeMB     = $sizeMB
            ManifestPath = $null
        }
    }

    $parent = Split-Path $Destination -Parent
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

    Write-Host "[pc-manager] moving $src -> $Destination ..."
    robocopy $src $Destination /MOVE /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
    $code = $LASTEXITCODE
    if ($code -ge 8) { throw "robocopy failed with exit code $code. Source was not removed." }

    if (Test-Path -LiteralPath $src) {
        Remove-Item -LiteralPath $src -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Junction -Path $src -Target $Destination | Out-Null

    $root = if ($ManifestRoot) {
        $ManifestRoot
    } else {
        $pcRoot = if ($script:PcRoot) { $script:PcRoot } else { (Get-Location).Path }
        Join-Path $pcRoot (Join-Path 'reports\organize' (Get-Date -Format 'yyyyMMdd-HHmmss'))
    }
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    $manifestPath = Join-Path $root 'manifest.csv'
    [pscustomobject]@{
        Source      = $src
        Destination = $Destination
        SizeMB      = $sizeMB
        Junction    = $true
        Time        = (Get-Date).ToString('s')
    } | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding utf8BOM

    Write-Host "OK: moved and linked. $src -> $Destination"
    Write-Host "Manifest: $manifestPath"

    return [pscustomobject]@{
        Execute      = $true
        Status       = 'completed'
        Source       = $src
        Destination  = $Destination
        SizeMB       = $sizeMB
        ManifestPath = $manifestPath
    }
}

function Invoke-OrganizeMedia {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [ValidateSet('video', 'photo', 'all')][string]$Kind = 'video',
        [switch]$Execute,
        [switch]$NoExif,
        [string]$ManifestRoot,
        [scriptblock]$DateResolver,
        [scriptblock]$OnItem,
        [scriptblock]$OnProgress
    )

    $rootItem = Get-Item -LiteralPath $Source -Force -ErrorAction Stop
    if (-not $rootItem.PSIsContainer) { throw "Not a folder: $Source" }
    $src = $rootItem.FullName.TrimEnd('\')
    if ($src -match '^[A-Za-z]:\\?$') { throw 'Refusing to organize a drive root.' }
    if (($rootItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Source is already a junction/reparse point.'
    }
    if (Get-Command Test-PcProtectedPath -ErrorAction SilentlyContinue) {
        if (Test-PcProtectedPath -Path $src) { throw "Refusing to organize a protected path: $src" }
        if (Test-PcProtectedPath -Path $Destination) { throw "Refusing to write to a protected path: $Destination" }
    }

    $dstRoot = [System.IO.Path]::GetFullPath($Destination).TrimEnd('\')
    if ($dstRoot -match '^[A-Za-z]:\\?$') { throw 'Refusing to write directly to a drive root.' }
    $inPlace = $dstRoot.Equals($src, [System.StringComparison]::OrdinalIgnoreCase)
    if (-not $inPlace -and $dstRoot.StartsWith($src + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Destination cannot be inside the source.'
    }

    $dateFromName = {
        param([string]$Name)
        if ($Name -match '(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)') {
            try {
                $dt = [datetime]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
                return $dt
            } catch { }
        }
        return $null
    }

    $files = [System.Collections.Generic.List[object]]::new()
    $stack = [System.Collections.Generic.Stack[string]]::new()
    $stack.Push($src)
    if ($OnProgress) {
        & $OnProgress @{ Phase = 'scan'; Current = 0; Total = 0; Label = '扫描媒体文件'; Indeterminate = $true }
    }
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
        foreach ($entry in $entries) {
            try {
                $attr = [int][System.IO.File]::GetAttributes($entry)
                if (($attr -band 0x10) -ne 0) {
                    if (($attr -band 0x400) -ne 0 -and (($attr -band $script:CloudFlags) -eq 0)) { continue }
                    $stack.Push($entry)
                    continue
                }
                if (($attr -band $script:CloudFlags) -ne 0) { continue }
                $fi = [System.IO.FileInfo]$entry
                if ($fi.Length -le 0) { continue }
                $category = Get-ExtCategory $fi.Extension
                if ($Kind -eq 'all') {
                    if ($category -notin @('photo', 'video')) { continue }
                } elseif ($category -ne $Kind) {
                    continue
                }
                $files.Add([pscustomobject]@{ File = $fi; Category = $category })
                if ($OnProgress -and ($files.Count % 200 -eq 0)) {
                    & $OnProgress @{ Phase = 'scan'; Current = $files.Count; Total = 0; Label = '扫描媒体文件'; Indeterminate = $true }
                }
            } catch { }
        }
    }

    if ($OnProgress) {
        & $OnProgress @{ Phase = 'move'; Current = 0; Total = $files.Count; Label = $(if ($Execute) { '准备移动' } else { '准备预览' }); Indeterminate = $false }
    }

    $results = [System.Collections.Generic.List[object]]::new()
    $moved = 0
    $planned = 0
    $failed = 0
    $skipped = 0
    $totalMB = 0.0
    $emitted = 0
    $processed = 0

    foreach ($entry in $files) {
        $processed++
        if ($OnProgress) {
            & $OnProgress @{
                Phase = 'move'
                Current = $processed
                Total = $files.Count
                Label = $(if ($Execute) { '移动文件' } else { '预览文件' })
                Indeterminate = $false
            }
        }
        $fi = $entry.File
        $totalMB += $fi.Length / 1MB
        $date = $null
        if ($DateResolver) {
            try { $date = & $DateResolver $fi } catch { $date = $null }
            if ($date -isnot [datetime]) { $date = $null }
        }
        if (-not $date -and ($entry.Category -eq 'video' -or $Kind -eq 'video')) {
            $date = & $dateFromName $fi.Name
        }
        if (-not $date) {
            $date = Get-MediaDate -File $fi -NoExif:$NoExif
        }
        $month = $date.ToString('yyyy-MM')
        $year = $date.ToString('yyyy')
        $targetDir = Join-Path (Join-Path $dstRoot $year) $month
        $target = Join-Path $targetDir $fi.Name
        $samePath = [System.IO.Path]::GetFullPath($target).Equals(
            [System.IO.Path]::GetFullPath($fi.FullName),
            [System.StringComparison]::OrdinalIgnoreCase
        )
        if (-not $samePath -and (Test-Path -LiteralPath $target)) {
            $base = [System.IO.Path]::GetFileNameWithoutExtension($fi.Name)
            $ext = $fi.Extension
            $counter = 1
            do {
                $target = Join-Path $targetDir ('{0}_{1}{2}' -f $base, $counter, $ext)
                $counter++
            } while (Test-Path -LiteralPath $target)
            $samePath = [System.IO.Path]::GetFullPath($target).Equals(
                [System.IO.Path]::GetFullPath($fi.FullName),
                [System.StringComparison]::OrdinalIgnoreCase
            )
        }

        $status = 'would-move'
        $errorText = ''
        if ($samePath) {
            $status = 'already-organized'
            $skipped++
        } elseif ($Execute) {
            try {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                Move-Item -LiteralPath $fi.FullName -Destination $target -ErrorAction Stop
                $status = 'moved'
                $moved++
            } catch {
                $status = 'failed'
                $errorText = $_.Exception.Message
                $failed++
            }
        } else {
            $planned++
        }

        $row = [pscustomobject]@{
            Name        = $fi.Name
            Source      = $fi.FullName
            Destination = $target
            Category    = $entry.Category
            SizeMB      = [math]::Round($fi.Length / 1MB, 2)
            Month       = $month
            Status      = $status
            Error       = $errorText
        }
        $results.Add($row)
        if ($OnItem -and $emitted -lt 5000) {
            try { & $OnItem $row } catch { }
            $emitted++
        }
    }

    $manifestPath = $null
    if ($Execute) {
        $root = if ($ManifestRoot) {
            $ManifestRoot
        } else {
            $pcRoot = if ($script:PcRoot) { $script:PcRoot } else { (Get-Location).Path }
            Join-Path $pcRoot (Join-Path 'reports\organize' (Get-Date -Format 'yyyyMMdd-HHmmss'))
        }
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        $manifestPath = Join-Path $root 'manifest.csv'
        $results | Select-Object Name, Source, Destination, Category, SizeMB, Month, Status, Error |
            Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding utf8BOM
    }

    return [pscustomobject]@{
        Execute      = [bool]$Execute
        Kind         = $Kind
        Source       = $src
        Destination  = $dstRoot
        TotalFiles   = $files.Count
        Planned      = $planned
        Moved        = $moved
        Failed       = $failed
        Skipped      = $skipped
        InPlace      = $inPlace
        TotalMB      = [math]::Round($totalMB, 1)
        ManifestPath = $manifestPath
        Items        = @($results | Select-Object -First 200)
    }
}

function Invoke-OrganizePhotos {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [switch]$Execute,
        [switch]$NoExif
    )

    $rootItem = Get-Item -LiteralPath $Source -Force -ErrorAction Stop
    if (-not $rootItem.PSIsContainer) { throw "Not a folder: $Source" }
    $root = $rootItem.FullName.TrimEnd('\')
    $manifest = [System.Collections.Generic.List[object]]::new()

    $move = {
        param($Src, $Dst, $Kind)
        if (-not (Test-Path -LiteralPath $Src)) { return }
        if (Test-Path -LiteralPath $Dst) {
            Write-Host "SKIP (exists): $Dst"
            return
        }
        if ($Execute) {
            $parent = Split-Path $Dst -Parent
            if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            try {
                Move-Item -LiteralPath $Src -Destination $Dst -Force -ErrorAction Stop
                Write-Host "OK: $Src -> $Dst"
            } catch {
                Write-Host "FAIL: $Src -> $Dst : $($_.Exception.Message)"
                return
            }
        } else {
            Write-Host "[DRY-RUN] $Src -> $Dst"
        }
        $manifest.Add([pscustomobject]@{ Kind = $Kind; Source = $Src; Destination = $Dst; Time = (Get-Date).ToString('s') })
    }

    if ($Execute) {
        foreach ($d in @('归档', '素材', '精修')) {
            New-Item -ItemType Directory -Path (Join-Path $root $d) -Force | Out-Null
        }
    }

    Write-Host "[pc-manager] scanning top-level folders under $root ..."
    foreach ($dir in (Get-ChildItem -LiteralPath $root -Force -Directory -ErrorAction SilentlyContinue)) {
        if ($dir.Name -in @('归档', '素材', '精修')) { continue }
        if ($dir.Name -match '^\d{4}$' -or $dir.Name -match '^\d{4}-\d{2}_') { continue }
        $files = Get-ChildItem -LiteralPath $dir.FullName -Recurse -Force -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -notmatch '^\.(ini|db|tmp|log)$' }
        if ($files.Count -eq 0) {
            & $move $dir.FullName (Join-Path $root "归档\$($dir.Name)") 'folder'
            continue
        }
        $monthGroup = $files |
            ForEach-Object { (Get-MediaDate -File $_ -NoExif:$NoExif).ToString('yyyy-MM') } |
            Group-Object | Sort-Object Count -Descending | Select-Object -First 1
        $month = $monthGroup.Name
        $year = $month.Substring(0, 4)
        $safeName = $dir.Name -replace '[\\/:*?"<>|]', '_'
        $target = Join-Path $root "$year\$($month)_$safeName"
        & $move $dir.FullName $target 'folder'
    }

    Write-Host '[pc-manager] scanning top-level files ...'
    foreach ($file in (Get-ChildItem -LiteralPath $root -Force -File -ErrorAction SilentlyContinue)) {
        if ($file.Name -match '^README') { continue }
        $month = (Get-MediaDate -File $file -NoExif:$NoExif).ToString('yyyy-MM')
        $year = $month.Substring(0, 4)
        $target = Join-Path $root "$year\${month}_未分类\$($file.Name)"
        & $move $file.FullName $target 'file'
    }

    if ($Execute) {
        $manifestPath = Join-Path $root 'organize-manifest.csv'
        $manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8
        $readme = @'
# Photo/source folder convention

- YYYY\YYYY-MM_EventOrPlace\
- 归档\  archives and long-term storage
- 素材\  PSD, posters, templates
- 精修\  exported edits

Keep original filenames. Use YYYY-MM_Event for folders. Avoid spaces and special characters.
'@
        Set-Content -LiteralPath (Join-Path $root 'README_FOLDER_CONVENTION.md') -Value $readme -Encoding UTF8
        Write-Host "Manifest: $manifestPath"
    } else {
        Write-Host 'Dry run. Re-run with -Execute to apply.'
    }
}
