function Invoke-Organize {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [switch]$Execute,
        [switch]$Force
    )

    $item = Get-Item -LiteralPath $Source -Force -ErrorAction Stop
    $src = $item.FullName
    if ($src -match '^[A-Za-z]:\\?$') { throw 'Refusing to move a drive root.' }
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Source is already a junction/reparse point.'
    }
    if (Test-Path -LiteralPath $Destination) { throw "Destination already exists: $Destination" }

    $sizeMB = Get-DirSizeMB -Path $src
    if (-not $Execute) {
        Write-Host "[DRY-RUN] Move: $src"
        Write-Host "[DRY-RUN]   ->  $Destination ($sizeMB MB)"
        Write-Host "[DRY-RUN] Then create junction: $src -> $Destination"
        return
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
    Write-Host "OK: moved and linked. $src -> $Destination"
}

function Invoke-OrganizePhotos {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Source,
        [switch]$Execute
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
        $monthGroup = $files | Group-Object { $_.LastWriteTime.ToString('yyyy-MM') } | Sort-Object Count -Descending | Select-Object -First 1
        $month = $monthGroup.Name
        $year = $month.Substring(0, 4)
        $safeName = $dir.Name -replace '[\\/:*?"<>|]', '_'
        $target = Join-Path $root "$year\$($month)_$safeName"
        & $move $dir.FullName $target 'folder'
    }

    Write-Host '[pc-manager] scanning top-level files ...'
    foreach ($file in (Get-ChildItem -LiteralPath $root -Force -File -ErrorAction SilentlyContinue)) {
        if ($file.Name -match '^README') { continue }
        $month = $file.LastWriteTime.ToString('yyyy-MM')
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
