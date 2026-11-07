function Invoke-DriveScan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$Drive,
        [switch]$Fast,
        [int]$LargeFileMB = 500,
        [int]$MaxLargeFiles = 200
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $root = "$Drive\"
    $info = Get-DriveInfo -Drive $Drive
    if (-not $info) { throw "Drive not found: $Drive" }

    $totalSize = 0L
    $totalFiles = 0
    $dirCount = 0
    $topSize = @{}
    $topCount = @{}
    $extSize = @{}
    $extCount = @{}
    $large = [System.Collections.Generic.List[object]]::new()
    $emptyDirs = [System.Collections.Generic.List[string]]::new()
    $reparsePoints = [System.Collections.Generic.List[string]]::new()

    $stack = [System.Collections.Generic.Stack[string]]::new()
    $stack.Push($root)

    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        $hasAny = $false
        try {
            foreach ($e in [System.IO.Directory]::EnumerateFileSystemEntries($dir)) {
                $hasAny = $true
                try {
                    $attr = [int][System.IO.File]::GetAttributes($e)
                    if (($attr -band 0x10) -ne 0) {
                        if ($e -like '*\System Volume Information*') { continue }
                        if (($attr -band 0x400) -ne 0 -and (($attr -band $script:CloudFlags) -eq 0)) {
                            $reparsePoints.Add($e)
                            continue
                        }
                        $stack.Push($e)
                        $dirCount++
                    } else {
                        $len = ([System.IO.FileInfo]$e).Length
                        $totalSize += $len
                        $totalFiles++

                        $rel = $e.Substring($root.Length)
                        $idx = $rel.IndexOf('\')
                        $top = if ($idx -ge 0) { $rel.Substring(0, $idx) } else { $rel }
                        if (-not $topSize.ContainsKey($top)) { $topSize[$top] = 0L; $topCount[$top] = 0 }
                        $topSize[$top] += $len
                        $topCount[$top]++

                        if (-not $Fast) {
                            $ext = [System.IO.Path]::GetExtension($e).ToLowerInvariant()
                            if (-not $ext) { $ext = '(none)' }
                            if (-not $extSize.ContainsKey($ext)) { $extSize[$ext] = 0L; $extCount[$ext] = 0 }
                            $extSize[$ext] += $len
                            $extCount[$ext]++

                            if ($len -ge ($LargeFileMB * 1MB) -and $large.Count -lt $MaxLargeFiles) {
                                $large.Add([pscustomobject]@{
                                    Path     = $e
                                    SizeMB   = [math]::Round($len / 1MB, 1)
                                    Modified = ([System.IO.FileInfo]$e).LastWriteTime
                                })
                            }
                        }
                    }
                } catch { }
            }
        } catch {
            continue
        }
        if (-not $hasAny) { $emptyDirs.Add($dir) }
    }

    $topFolders = @()
    foreach ($k in $topSize.Keys) {
        $topFolders += [pscustomobject]@{
            Name   = $k
            SizeGB = [math]::Round($topSize[$k] / 1GB, 2)
            Files  = $topCount[$k]
        }
    }
    $topFolders = $topFolders | Sort-Object SizeGB -Descending

    $extensions = @()
    if (-not $Fast) {
        foreach ($k in $extSize.Keys) {
            $extensions += [pscustomobject]@{
                Ext    = $k
                Count  = $extCount[$k]
                SizeGB = [math]::Round($extSize[$k] / 1GB, 2)
                Kind   = Get-ExtCategory $k
            }
        }
        $extensions = $extensions | Sort-Object SizeGB -Descending | Select-Object -First 80
    }

    $cloud = @()
    if ($Drive -eq $env:SystemDrive) {
        $config = Read-PcConfig
        foreach ($p in $config.cloudRoots) {
            $u = Get-CloudUsage -Path $p
            if ($u) { $cloud += $u }
        }
    }

    $sw.Stop()
    return [pscustomobject]@{
        Id            = $Drive
        Root          = $root
        TotalGB       = $info.TotalGB
        FreeGB        = $info.FreeGB
        UsedGB        = $info.UsedGB
        TotalFiles    = $totalFiles
        TotalSizeGB   = [math]::Round($totalSize / 1GB, 2)
        DirCount      = $dirCount
        TopFolders    = @($topFolders)
        Extensions    = @($extensions)
        LargeFiles    = @($large | Sort-Object SizeMB -Descending)
        EmptyDirs     = @($emptyDirs)
        ReparsePoints = @($reparsePoints)
        Cloud         = @($cloud)
        ScanSeconds   = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    }
}

function Invoke-PcScan {
    [CmdletBinding()]
    param(
        [string[]]$Drives,
        [switch]$Fast
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $config = Read-PcConfig
    if (-not $Drives -or $Drives.Count -eq 0) { $Drives = Get-FixedDrives }

    $normalized = @()
    foreach ($d in $Drives) {
        foreach ($part in ([string]$d -split ',')) {
            $x = $part.Trim().ToUpperInvariant()
            if (-not $x) { continue }
            if ($x -notmatch ':$') { $x += ':' }
            $normalized += $x
        }
    }
    $normalized = @($normalized | Select-Object -Unique)

    $driveResults = @()
    foreach ($d in $normalized) {
        Write-Host "[pc-manager] scanning $d ..."
        $driveResults += Invoke-DriveScan -Drive $d -Fast:$Fast -LargeFileMB $config.largeFileMB -MaxLargeFiles $config.maxLargeFiles
    }

    Write-Host '[pc-manager] reading installed apps and orphan records ...'
    $apps = Get-InstalledApps
    $orphans = Get-OrphanInfo

    $sw.Stop()
    return [pscustomobject]@{
        SchemaVersion = 1
        GeneratedAt   = (Get-Date).ToString('s')
        Computer      = $env:COMPUTERNAME
        User          = $env:USERNAME
        OS            = [System.Environment]::OSVersion.VersionString
        FastMode      = [bool]$Fast
        ScanSeconds   = [math]::Round($sw.Elapsed.TotalSeconds, 1)
        Drives        = @($driveResults)
        InstalledApps = @($apps)
        Orphans       = $orphans
    }
}
