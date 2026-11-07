function Invoke-Clean {
    [CmdletBinding()]
    param(
        $Junk,
        [switch]$Execute,
        [switch]$Admin
    )

    $items = @($Junk)
    if ($items.Count -eq 0) {
        Write-Host 'No junk candidates.'
        return
    }

    if (-not $Execute) {
        $items | Select-Object Name, Category, SizeGB, Safety, Mode, Path |
            Format-Table -AutoSize | Out-String -Width 200 | Write-Host
        $total = ($items | Measure-Object SizeGB -Sum).Sum
        Write-Host ("Total: {0:N2} GB. Re-run with -Execute to clean." -f $total)
        return
    }

    $isAdmin = Test-IsAdmin
    $beforeC = (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'").FreeSpace
    $cleaned = 0.0

    foreach ($i in $items) {
        if ($i.Safety -eq 'review') {
            Write-Host "SKIP (review): $($i.Path)"
            continue
        }
        if ($i.Safety -eq 'elevated' -and -not $isAdmin) {
            Write-Host "SKIP (needs admin): $($i.Path)"
            continue
        }

        try {
            switch ($i.Mode) {
                'contents' {
                    Get-ChildItem -LiteralPath $i.Path -Force -ErrorAction SilentlyContinue |
                        Remove-Item -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
                    Write-Host "CLEARED: $($i.Path)"
                }
                'recycle' {
                    $driveLetter = $i.Path.Substring(0, 1)
                    Clear-RecycleBin -DriveLetter $driveLetter -Force -ErrorAction Stop
                    Write-Host "EMPTIED: $($i.Path)"
                }
                default {
                    Remove-Item -LiteralPath $i.Path -Recurse -Force -Confirm:$false -ErrorAction Stop
                    Write-Host "REMOVED: $($i.Path)"
                }
            }
            $cleaned += [double]$i.SizeGB
        } catch {
            Write-Host "FAIL: $($i.Path) -> $($_.Exception.Message)"
        }
    }

    $afterC = (Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'").FreeSpace
    Write-Host ''
    Write-Host ("Cleaned (nominal): {0:N2} GB" -f $cleaned)
    Write-Host ("System drive free: {0:N2} GB -> {1:N2} GB" -f ($beforeC / 1GB), ($afterC / 1GB))
}

function Invoke-Dedupe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Root,
        [switch]$Execute,
        [switch]$KeepDuplicates
    )

    $rootItem = Get-Item -LiteralPath $Root -Force -ErrorAction Stop
    if (-not $rootItem.PSIsContainer) { throw "Not a folder: $Root" }
    $rootPath = $rootItem.FullName.TrimEnd('\')

    Write-Host "[pc-manager] enumerating $rootPath ..."
    $files = [System.Collections.Generic.List[object]]::new()
    $stack = [System.Collections.Generic.Stack[string]]::new()
    $stack.Push($rootPath)
    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
        foreach ($e in $entries) {
            try {
                $attr = [int][System.IO.File]::GetAttributes($e)
                if (($attr -band 0x10) -ne 0) {
                    if (($attr -band 0x400) -ne 0) { continue }
                    $stack.Push($e)
                } else {
                    $fi = [System.IO.FileInfo]$e
                    if ($fi.Length -ge 1MB) {
                        $files.Add([pscustomobject]@{ Path = $fi.FullName; Size = $fi.Length; Modified = $fi.LastWriteTime })
                    }
                }
            } catch { }
        }
    }

    Write-Host "[pc-manager] $($files.Count) files >= 1 MB; grouping by size ..."
    $sizeGroups = $files | Group-Object Size | Where-Object { $_.Count -gt 1 }
    $duplicates = [System.Collections.Generic.List[object]]::new()

    foreach ($g in $sizeGroups) {
        $hashed = @()
        foreach ($f in $g.Group) {
            $h = (Get-FileHash -LiteralPath $f.Path -Algorithm SHA256 -ErrorAction SilentlyContinue).Hash
            if ($h) { $hashed += [pscustomobject]@{ Hash = $h; Path = $f.Path; Size = $f.Size; Modified = $f.Modified } }
        }
        foreach ($hg in ($hashed | Group-Object Hash | Where-Object { $_.Count -gt 1 })) {
            $sorted = $hg.Group | Sort-Object Modified -Descending
            $keep = $sorted[0]
            foreach ($dup in ($sorted | Select-Object -Skip 1)) {
                $duplicates.Add([pscustomobject]@{
                    Hash      = $hg.Name
                    SizeMB    = [math]::Round($dup.Size / 1MB, 1)
                    Keep      = $keep.Path
                    Duplicate = $dup.Path
                })
            }
        }
    }

    if ($duplicates.Count -eq 0) {
        Write-Host 'No duplicate files found.'
        return
    }

    $duplicates | Select-Object SizeMB, Keep, Duplicate |
        Sort-Object SizeMB -Descending | Format-Table -AutoSize | Out-String -Width 220 | Write-Host
    $wasted = ($duplicates | Measure-Object SizeMB -Sum).Sum
    Write-Host ("Duplicates: {0}; can reclaim {1:N1} MB." -f $duplicates.Count, $wasted)

    if (-not $Execute -or $KeepDuplicates) {
        if (-not $Execute) { Write-Host 'Dry run. Re-run with -Execute to move duplicates to quarantine.' }
        return
    }

    $quarantineRoot = if (Test-Path 'D:\') { 'D:\Backup\duplicates' } else { Join-Path $env:USERPROFILE 'pc-manager-quarantine' }
    $target = Join-Path $quarantineRoot (Get-Date -Format 'yyyyMMdd-HHmmss')
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    $manifest = [System.Collections.Generic.List[object]]::new()

    foreach ($d in $duplicates) {
        $rel = $d.Duplicate.Substring($rootPath.Length).TrimStart('\')
        $dest = Join-Path $target $rel
        New-Item -ItemType Directory -Path (Split-Path $dest -Parent) -Force | Out-Null
        try {
            Move-Item -LiteralPath $d.Duplicate -Destination $dest -Force -ErrorAction Stop
            $manifest.Add([pscustomobject]@{ Moved = $d.Duplicate; To = $dest; SizeMB = $d.SizeMB })
            Write-Host "MOVED: $($d.Duplicate)"
        } catch {
            Write-Host "FAIL: $($d.Duplicate) -> $($_.Exception.Message)"
        }
    }

    $manifestPath = Join-Path $target 'manifest.csv'
    $manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8
    Write-Host "Quarantine: $target"
    Write-Host "Manifest:   $manifestPath"
}
