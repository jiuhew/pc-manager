function Get-JunkCandidates {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]$Scan,
        $Config
    )

    if (-not $Config) { $Config = Read-PcConfig }
    $items = [System.Collections.Generic.List[object]]::new()
    $seen = @{}

    $add = {
        param($Name, $Path, $Category, $Safety, $Reason, $Mode = 'path')
        if (-not $Path) { return }
        if ($seen.ContainsKey($Path)) { return }
        if (-not (Test-Path -LiteralPath $Path -ErrorAction SilentlyContinue)) { return }
        $seen[$Path] = $true
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        if (-not $item) { return }
        $mb = if ($item.PSIsContainer) { Get-DirSizeMB -Path $Path } else { [math]::Round($item.Length / 1MB, 1) }
        if ($mb -le 0) { return }
        $items.Add([pscustomobject]@{
            Name     = $Name
            Path     = $Path
            SizeMB   = $mb
            SizeGB   = [math]::Round($mb / 1024, 2)
            Category = $Category
            Safety   = $Safety
            Mode     = $Mode
            Reason   = $Reason
        })
    }

    # User-level caches
    & $add 'User TEMP' $env:TEMP 'cache' 'safe' 'Temporary files, safe to remove'
    & $add 'Local TEMP' (Join-Path $env:LOCALAPPDATA 'Temp') 'cache' 'safe' 'Temporary files, safe to remove'
    & $add 'CrashDumps' (Join-Path $env:LOCALAPPDATA 'CrashDumps') 'cache' 'safe' 'Application crash dumps'
    & $add 'D3DSCache' (Join-Path $env:LOCALAPPDATA 'D3DSCache') 'cache' 'safe' 'DirectX shader cache'
    & $add 'NVIDIA DXCache' (Join-Path $env:LOCALAPPDATA 'NVIDIA\DXCache') 'cache' 'safe' 'NVIDIA shader cache'
    & $add 'NVIDIA GLCache' (Join-Path $env:LOCALAPPDATA 'NVIDIA\GLCache') 'cache' 'safe' 'NVIDIA shader cache'
    & $add 'INetCache' (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\INetCache') 'cache' 'safe' 'System network cache'
    & $add 'WebCache' (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\WebCache') 'cache' 'safe' 'Web cache'
    & $add 'Explorer thumbnails' (Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer') 'cache' 'safe' 'Thumbnail and icon cache'
    & $add 'pip cache' (Join-Path $env:LOCALAPPDATA 'pip\Cache') 'cache' 'safe' 'Python package cache'
    & $add 'npm cache' (Join-Path $env:LOCALAPPDATA 'npm-cache') 'cache' 'safe' 'npm package cache'
    & $add 'Yarn cache' (Join-Path $env:LOCALAPPDATA 'Yarn\Cache') 'cache' 'safe' 'Yarn package cache'
    & $add 'pnpm cache' (Join-Path $env:LOCALAPPDATA 'pnpm-cache') 'cache' 'safe' 'pnpm package cache'
    & $add 'uv cache' (Join-Path $env:LOCALAPPDATA 'uv\cache') 'cache' 'safe' 'uv package cache'
    & $add 'electron cache' (Join-Path $env:LOCALAPPDATA 'electron') 'cache' 'safe' 'Electron download cache'
    & $add 'electron-builder cache' (Join-Path $env:LOCALAPPDATA 'electron-builder') 'cache' 'safe' 'Electron build cache'

    # App updater caches
    Get-ChildItem -LiteralPath $env:LOCALAPPDATA -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '(-updater|^@.*-updater)$' } |
        ForEach-Object { & $add $_.Name $_.FullName 'updater' 'safe' 'Application update cache' }
    Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Programs') -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '\.update-' } |
        ForEach-Object { & $add $_.Name $_.FullName 'updater' 'safe' 'Update staging copy' }

    # System caches (need elevation)
    & $add '$WinREAgent' "$env:SystemDrive\`$WinREAgent" 'system' 'elevated' 'WinRE servicing temporary files'
    & $add 'Windows Update cache' (Join-Path $env:SystemRoot 'SoftwareDistribution\Download') 'system' 'elevated' 'Windows Update downloads' 'contents'
    & $add 'Windows Temp' (Join-Path $env:SystemRoot 'Temp') 'system' 'elevated' 'System temporary files' 'contents'
    & $add 'Windows Logs' (Join-Path $env:SystemRoot 'Logs') 'system' 'elevated' 'System logs' 'contents'
    & $add 'WER' (Join-Path $env:ProgramData 'Microsoft\Windows\WER') 'system' 'elevated' 'Error reports' 'contents'
    & $add 'Delivery Optimization' (Join-Path $env:ProgramData 'Microsoft\Windows\DeliveryOptimization') 'system' 'elevated' 'Delivery Optimization cache' 'contents'

    # Recycle bins
    foreach ($d in $Scan.Drives) {
        $rb = "$($d.Id)\`$Recycle.Bin"
        & $add "Recycle Bin $($d.Id)" $rb 'recycle' 'confirm' 'Deleted files still on disk'
    }

    # Old installers in common download folders
    $cutoff = (Get-Date).AddDays(-1 * [int]$Config.installerAgeDays)
    foreach ($dir in $Config.downloadDirs) {
        if (-not (Test-Path -LiteralPath $dir -ErrorAction SilentlyContinue)) { continue }
        Get-ChildItem -LiteralPath $dir -Force -File -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Extension -match '^\.(exe|msi|msix|appx|msp)$' -and
                $_.Length -ge 50MB -and
                $_.LastWriteTime -lt $cutoff
            } |
            Select-Object -First 100 |
            ForEach-Object {
                & $add $_.Name $_.FullName 'installer' 'confirm' 'Old installer, application is likely already installed'
            }
    }

    # Orphaned Store app data
    foreach ($o in @($Scan.Orphans.AppxData)) {
        if (-not $o) { continue }
        & $add $o.Package (Join-Path $env:LOCALAPPDATA "Packages\$($o.Package)") 'orphan' 'confirm' 'Data from an uninstalled Store app'
    }

    return @($items | Sort-Object SizeMB -Descending)
}

function Get-MigrationCandidates {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Scan, $Config)

    if (-not $Config) { $Config = Read-PcConfig }
    $minGB = [double]$Config.minMigrationGB
    $rows = [System.Collections.Generic.List[object]]::new()

    $known = @(
        @{ Path = (Join-Path $env:USERPROFILE 'anaconda3'); Target = 'D:\anaconda3'; Reason = 'Conda environments are large and portable; move + junction.' },
        @{ Path = (Join-Path $env:USERPROFILE 'miniconda3'); Target = 'D:\miniconda3'; Reason = 'Conda environments are large and portable; move + junction.' },
        @{ Path = (Join-Path $env:LOCALAPPDATA 'Docker\wsl'); Target = 'D:\Docker\wsl'; Reason = 'Docker WSL disk image; move + junction or change Disk image location.' },
        @{ Path = (Join-Path $env:USERPROFILE 'GitHub'); Target = 'D:\GitHub'; Reason = 'Git repositories are portable; move + junction.' },
        @{ Path = (Join-Path $env:USERPROFILE 'Documents\GitHub'); Target = 'D:\GitHub'; Reason = 'Git repositories are portable; move + junction.' },
        @{ Path = 'C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA'; Target = 'D:\CUDA'; Reason = 'CUDA toolkit can be reinstalled to another drive.' },
        @{ Path = 'C:\Program Files\Windows Kits'; Target = 'D:\Windows Kits'; Reason = 'Windows SDK can be reinstalled to another drive.' },
        @{ Path = 'C:\Program Files (x86)\Microsoft Visual Studio'; Target = 'D:\Microsoft Visual Studio'; Reason = 'Visual Studio can be reinstalled to another drive.' }
    )

    foreach ($k in $known) {
        if (-not (Test-Path -LiteralPath $k.Path -ErrorAction SilentlyContinue)) { continue }
        $ki = Get-Item -LiteralPath $k.Path -Force -ErrorAction SilentlyContinue
        if ($ki -and (($ki.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { continue }
        $mb = Get-DirSizeMB -Path $k.Path
        if ($mb / 1024 -ge $minGB) {
            $rows.Add([pscustomobject]@{
                Name           = Split-Path $k.Path -Leaf
                Path           = $k.Path
                SizeGB         = [math]::Round($mb / 1024, 2)
                SuggestedTarget = $k.Target
                Reason         = $k.Reason
            })
        }
    }

    # WSL distro data under Packages
    $pkgRoot = Join-Path $env:LOCALAPPDATA 'Packages'
    if (Test-Path -LiteralPath $pkgRoot -ErrorAction SilentlyContinue) {
        Get-ChildItem -LiteralPath $pkgRoot -Force -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match 'CanonicalGroupLimited|Ubuntu|Debian|kali|openSUSE|AlmaLinux' } |
            ForEach-Object {
                if (($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { return }
                $mb = Get-DirSizeMB -Path $_.FullName
                if ($mb / 1024 -ge $minGB) {
                    $rows.Add([pscustomobject]@{
                        Name            = "WSL: $($_.Name)"
                        Path            = $_.FullName
                        SizeGB          = [math]::Round($mb / 1024, 2)
                        SuggestedTarget = 'D:\wsl'
                        Reason          = 'Use wsl --export / --import and restore the default user.'
                    })
                }
            }
    }

    # Game libraries on the system drive
    foreach ($d in $Scan.Drives) {
        if ($d.Id -ne $env:SystemDrive) { continue }
        foreach ($f in $d.TopFolders) {
            if ($f.Name -match '^(Steam|SteamLibrary|Epic Games|GOG Games|Games|XboxGames)$' -and $f.SizeGB -ge $minGB) {
                $rows.Add([pscustomobject]@{
                    Name            = $f.Name
                    Path            = "$($d.Id)\$($f.Name)"
                    SizeGB          = $f.SizeGB
                    SuggestedTarget = 'D:\Games'
                    Reason          = 'Game libraries can be moved through the launcher or via move + junction.'
                })
            }
        }
    }

    return @($rows | Sort-Object SizeGB -Descending)
}

function Get-MediaInventory {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Scan)

    $photoGB = 0.0; $photoCount = 0
    $videoGB = 0.0; $videoCount = 0
    $audioGB = 0.0; $audioCount = 0
    $mediaFolders = [System.Collections.Generic.List[object]]::new()

    foreach ($d in $Scan.Drives) {
        foreach ($x in $d.Extensions) {
            switch ($x.Kind) {
                'photo' { $photoGB += [double]$x.SizeGB; $photoCount += [int]$x.Count }
                'video' { $videoGB += [double]$x.SizeGB; $videoCount += [int]$x.Count }
                'audio' { $audioGB += [double]$x.SizeGB; $audioCount += [int]$x.Count }
            }
        }
        foreach ($f in $d.TopFolders) {
            if ($f.Name -match 'photo|picture|image|dcim|camera|video|movie|相册|照片|视频|素材' -and $f.SizeGB -ge 1) {
                $mediaFolders.Add([pscustomobject]@{ Drive = $d.Id; Folder = $f.Name; SizeGB = $f.SizeGB; Files = $f.Files })
            }
        }
    }

    return [pscustomobject]@{
        PhotoGB    = [math]::Round($photoGB, 2)
        PhotoCount = $photoCount
        VideoGB    = [math]::Round($videoGB, 2)
        VideoCount = $videoCount
        AudioGB    = [math]::Round($audioGB, 2)
        AudioCount = $audioCount
        MediaFolders = @($mediaFolders | Sort-Object SizeGB -Descending)
    }
}

function Get-Recommendations {
    param($Scan, $Junk, $Migration, $Media)

    $out = [System.Collections.Generic.List[string]]::new()

    $junkTotal = 0.0
    foreach ($j in @($Junk)) { $junkTotal += [double]$j.SizeGB }
    if ($junkTotal -ge 1) {
        $out.Add(("Cleanable cache/leftovers: {0:N1} GB. Review the junk table and run clean with -Execute." -f $junkTotal))
    }

    foreach ($m in @($Migration)) {
        if ($m.SizeGB -ge 5) {
            $out.Add(("Migration candidate: {0} ({1:N1} GB) -> {2}" -f $m.Path, $m.SizeGB, $m.SuggestedTarget))
        }
    }

    if ($Media.PhotoGB + $Media.VideoGB -ge 50) {
        $out.Add(("Media library: {0:N1} GB photos + {1:N1} GB video. Use the photo-organizer skill for YYYY/YYYY-MM naming." -f $Media.PhotoGB, $Media.VideoGB))
    }

    foreach ($d in $Scan.Drives) {
        $rb = @($Junk | Where-Object { $_.Category -eq 'recycle' -and $_.Path -like "$($d.Id)*" })
        foreach ($r in $rb) {
            if ($r.SizeGB -ge 1) {
                $out.Add(("Recycle Bin {0}: {1:N1} GB. Empty it after confirming nothing is needed." -f $d.Id, $r.SizeGB))
            }
        }
        foreach ($c in $d.Cloud) {
            if ($c.LogicalGB - $c.LocalGB -ge 10) {
                $out.Add(("Cloud placeholder {0}: logical {1:N1} GB, local {2:N1} GB. Do not move placeholders." -f $c.Path, $c.LogicalGB, $c.LocalGB))
            }
        }
        if ($d.TotalFiles -gt 0 -and $d.TotalSizeGB -gt 0) {
            $out.Add(("Drive {0} - {1:N1} GB used, {2:N1} GB free, {3} files." -f $d.Id, $d.UsedGB, $d.FreeGB, $d.TotalFiles))
        }
    }

    $orphanUninstall = @($Scan.Orphans.UninstallEntries | Where-Object { $_.DisplayName })
    if ($orphanUninstall.Count -gt 0) {
        $out.Add(("Orphaned uninstall entries: {0}. Review before removing registry keys." -f $orphanUninstall.Count))
    }
    if (@($Scan.Orphans.RunKeys).Count -gt 0) {
        $out.Add(("Broken startup entries: {0}. Remove them if the target app is gone." -f @($Scan.Orphans.RunKeys).Count))
    }

    return @($out)
}

function Add-PcAnalysis {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Scan)

    $config = Read-PcConfig
    $junk = Get-JunkCandidates -Scan $Scan -Config $config
    $migration = Get-MigrationCandidates -Scan $Scan -Config $config
    $media = Get-MediaInventory -Scan $Scan
    $recs = Get-Recommendations -Scan $Scan -Junk $junk -Migration $migration -Media $media

    $Scan | Add-Member -NotePropertyName Junk -NotePropertyValue @($junk) -Force
    $Scan | Add-Member -NotePropertyName Migration -NotePropertyValue @($migration) -Force
    $Scan | Add-Member -NotePropertyName Media -NotePropertyValue $media -Force
    $Scan | Add-Member -NotePropertyName Recommendations -NotePropertyValue @($recs) -Force

    if (Get-Command Invoke-StorageAudit -ErrorAction SilentlyContinue) {
        try {
            $audit = Invoke-StorageAudit -Scan $Scan -Junk $junk -Migration $migration -Media $media -Config $config
            $Scan | Add-Member -NotePropertyName Audit -NotePropertyValue $audit -Force
        } catch {
            $Scan | Add-Member -NotePropertyName Audit -NotePropertyValue $null -Force
        }
    }
    return $Scan
}
