function Get-PcProtectedPaths {
    return @(
        "$env:SystemRoot\WinSxS",
        "$env:SystemRoot\Installer",
        "$env:ProgramData\Package Cache",
        "$env:SystemRoot\System32",
        "$env:SystemRoot\SysWOW64",
        "$env:SystemRoot\System Volume Information",
        "$env:SystemDrive\System Volume Information",
        "$env:SystemDrive\pagefile.sys",
        "$env:SystemDrive\hiberfil.sys",
        "$env:SystemDrive\swapfile.sys",
        "$env:SystemDrive\Recovery",
        "$env:SystemDrive\Config.Msi"
    ) | Where-Object { $_ }
}

function Test-PcProtectedPath {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    try { $full = [System.IO.Path]::GetFullPath($Path).TrimEnd('\') } catch { return $true }
    if (-not $full) { return $true }

    foreach ($p in (Get-PcProtectedPaths)) {
        $pp = [System.IO.Path]::GetFullPath($p).TrimEnd('\')
        if ($full.Equals($pp, [System.StringComparison]::OrdinalIgnoreCase) -or
            $full.StartsWith($pp + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    # Refuse cleaning an entire well-known root (deleting children of these is catastrophic).
    $roots = @(
        [System.IO.Path]::GetPathRoot($full),
        $env:SystemRoot,
        (Join-Path $env:SystemDrive 'Users'),
        $env:ProgramFiles,
        ${env:ProgramFiles(x86)},
        $env:ProgramData,
        $env:USERPROFILE,
        $env:LOCALAPPDATA,
        $env:APPDATA
    )
    foreach ($r in $roots) {
        if (-not $r) { continue }
        try { $rr = [System.IO.Path]::GetFullPath($r).TrimEnd('\') } catch { continue }
        if ($full.Equals($rr, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
    }
    return $false
}

function Invoke-PcCleanSelection {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]$Items,
        [switch]$Execute,
        [string]$ManifestRoot,
        [scriptblock]$OnItem
    )

    $isAdmin = Test-IsAdmin
    $results = [System.Collections.Generic.List[object]]::new()
    $freeBefore = $null
    try { $freeBefore = (Get-DriveInfo -Drive $env:SystemDrive).FreeGB } catch { }
    $index = 0

    foreach ($i in @($Items)) {
        $index++
        $name = [string]$i.Name
        $rawPath = [string]$i.Path
        $category = [string]$i.Category
        $safety = [string]$i.Safety
        $mode = [string]$i.Mode
        if (-not $mode) { $mode = 'path' }
        $effectiveMode = $mode
        $reason = [string]$i.Reason
        $sizeMB = 0.0
        $status = 'skipped'
        $detail = ''
        $full = $rawPath

        try { if ($rawPath) { $full = [System.IO.Path]::GetFullPath($rawPath) } } catch { }

        if (-not $full -or -not (Test-Path -LiteralPath $full -ErrorAction SilentlyContinue)) {
            $detail = 'Path not found'
        } elseif (Test-PcProtectedPath -Path $full) {
            $detail = 'Protected system path'
        } elseif ($safety -eq 'review') {
            $detail = 'Needs manual review'
        } elseif ($safety -eq 'elevated' -and -not $isAdmin) {
            $detail = 'Needs elevation'
        } elseif ($effectiveMode -notin @('path', 'contents', 'recycle')) {
            $detail = "Unknown mode: $effectiveMode"
        } else {
            $item = Get-Item -LiteralPath $full -Force -ErrorAction SilentlyContinue
            if (-not $item) {
                $detail = 'Path is not readable'
            } else {
                if ($category -eq 'recycle' -or $item.Name -eq '$Recycle.Bin') { $effectiveMode = 'recycle' }
                $sizeMB = if ($item.PSIsContainer) { Get-DirSizeMB -Path $full } else { [math]::Round($item.Length / 1MB, 1) }

                if (-not $Execute) {
                    $status = 'would-clean'
                    $detail = "Would clean with mode '$effectiveMode'"
                } else {
                    try {
                        switch ($effectiveMode) {
                            'contents' {
                                Get-ChildItem -LiteralPath $full -Force -ErrorAction Stop |
                                    Remove-Item -Recurse -Force -Confirm:$false -ErrorAction Stop
                            }
                            'recycle' {
                                $driveLetter = $full.Substring(0, 1)
                                Clear-RecycleBin -DriveLetter $driveLetter -Force -ErrorAction Stop
                            }
                            default {
                                Remove-Item -LiteralPath $full -Recurse -Force -Confirm:$false -ErrorAction Stop
                            }
                        }
                        $status = 'cleaned'
                        $detail = 'Cleaned'
                    } catch {
                        $status = 'failed'
                        $detail = $_.Exception.Message
                    }
                }
            }
        }

        $row = [pscustomobject]@{
            Index    = $index
            Name     = $name
            Path     = $full
            Category = $category
            Safety   = $safety
            Mode     = $effectiveMode
            SizeMB   = $sizeMB
            Status   = $status
            Detail   = $detail
            Reason   = $reason
        }
        $results.Add($row)
        if ($OnItem) { try { & $OnItem $row } catch { } }
    }

    $cleanedMB = 0.0
    foreach ($r in $results) {
        if ($r.Status -eq 'cleaned') { $cleanedMB += [double]$r.SizeMB }
    }

    $manifestPath = $null
    if ($Execute) {
        $root = if ($ManifestRoot) {
            $ManifestRoot
        } else {
            $pcRoot = if ($script:PcRoot) { $script:PcRoot } else { (Get-Location).Path }
            Join-Path $pcRoot (Join-Path 'reports\clean' (Get-Date -Format 'yyyyMMdd-HHmmss'))
        }
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        $manifestPath = Join-Path $root 'manifest.csv'
        $results | Select-Object Index, Name, Path, Category, Safety, Mode, SizeMB, Status, Detail, Reason |
            Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding utf8BOM
    }

    $freeAfter = $null
    try { $freeAfter = (Get-DriveInfo -Drive $env:SystemDrive).FreeGB } catch { }
    $totalMB = ($results | Measure-Object SizeMB -Sum).Sum

    return [pscustomobject]@{
        Execute      = [bool]$Execute
        IsAdmin      = [bool]$isAdmin
        Items        = @($results)
        TotalMB      = [math]::Round([double]$totalMB, 1)
        CleanedMB    = [math]::Round($cleanedMB, 1)
        ManifestPath = $manifestPath
        FreeBeforeGB = $freeBefore
        FreeAfterGB  = $freeAfter
    }
}

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
        $preview = Invoke-PcCleanSelection -Items $items
        $preview.Items | Select-Object Name, Category, SizeMB, Safety, Mode, Status, Detail, Path |
            Format-Table -AutoSize | Out-String -Width 220 | Write-Host
        Write-Host ("Total: {0:N2} GB. Re-run with -Execute to clean." -f ($preview.TotalMB / 1024))
        return
    }

    $result = Invoke-PcCleanSelection -Items $items -Execute
    foreach ($row in $result.Items) {
        $label = switch ($row.Status) {
            'cleaned' { 'CLEANED' }
            'failed' { 'FAIL' }
            default { 'SKIP' }
        }
        $suffix = if ($row.Detail -and $row.Status -ne 'cleaned') { " ($($row.Detail))" } else { '' }
        Write-Host ("{0}: {1}{2}" -f $label, $row.Path, $suffix)
    }
    Write-Host ''
    Write-Host ("Cleaned (nominal): {0:N2} GB" -f ($result.CleanedMB / 1024))
    Write-Host ("System drive free: {0:N2} GB -> {1:N2} GB" -f $result.FreeBeforeGB, $result.FreeAfterGB)
    if ($result.ManifestPath) { Write-Host "Manifest: $($result.ManifestPath)" }
}

function Invoke-PcAppUninstall {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$App)

    $paths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )

    $name = [string]$App.DisplayName
    if (-not $name) {
        return [pscustomobject]@{ Status = 'failed'; Message = 'App has no DisplayName.'; AppName = $name }
    }

    $entries = @(Get-ItemProperty $paths -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $name })
    $entry = $null
    if ($App.DisplayVersion) {
        $entry = $entries | Where-Object {
            $_.DisplayVersion -eq $App.DisplayVersion -and $_.UninstallString -eq $App.UninstallString
        } | Select-Object -First 1
    }
    if (-not $entry -and $App.UninstallString) {
        $entry = $entries | Where-Object { $_.UninstallString -eq $App.UninstallString } | Select-Object -First 1
    }
    if (-not $entry) { $entry = $entries | Select-Object -First 1 }
    if (-not $entry -or -not $entry.UninstallString) {
        return [pscustomobject]@{
            Status   = 'failed'
            AppName  = $name
            Message  = 'Uninstall entry was not found in the registry. Re-scan and try again.'
        }
    }

    $command = [string]$entry.UninstallString
    $exe = $null
    $arguments = ''

    if ($command -match '^\s*"([^"]+)"\s*(.*)$') {
        $exe = $Matches[1]
        $arguments = $Matches[2]
    } elseif ($command -match '(?i)^\s*(MsiExec\.exe|msiexec\.exe)\b\s*(.*)$') {
        $exe = 'msiexec.exe'
        $arguments = $Matches[2]
    } elseif ($command -match '^\s*([A-Za-z]:\\[^\r\n]*?\.exe)\s*(.*)$') {
        $exe = $Matches[1]
        $arguments = $Matches[2]
    }

    if (-not $exe) {
        return [pscustomobject]@{
            Status  = 'failed'
            AppName = $name
            Message = "Unsupported uninstall command: $command"
        }
    }

    if ($exe -notmatch '(?i)^msiexec(\.exe)?$' -and -not (Test-Path -LiteralPath $exe -ErrorAction SilentlyContinue)) {
        return [pscustomobject]@{
            Status  = 'failed'
            AppName = $name
            Message = "Uninstaller not found: $exe"
        }
    }

    try {
        $process = Start-Process -FilePath $exe -ArgumentList $arguments -PassThru -ErrorAction Stop
        $exited = $process.WaitForExit(5000)
        if ($exited) {
            return [pscustomobject]@{
                Status     = 'completed'
                AppName    = $name
                Executable = $exe
                Arguments  = $arguments
                Pid        = $process.Id
                ExitCode   = $process.ExitCode
                Message    = 'Uninstaller finished.'
            }
        }
        return [pscustomobject]@{
            Status     = 'started'
            AppName    = $name
            Executable = $exe
            Arguments  = $arguments
            Pid        = $process.Id
            Message    = 'Uninstaller started. Finish it in the window that opened.'
        }
    } catch {
        return [pscustomobject]@{
            Status     = 'failed'
            AppName    = $name
            Executable = $exe
            Arguments  = $arguments
            Message    = $_.Exception.Message
        }
    }
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
