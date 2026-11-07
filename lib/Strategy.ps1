$script:StorageStrategyVersion = 1

function Add-StorageFinding {
    param(
        [Parameter(Mandatory)]$List,
        [Parameter(Mandatory)][string]$Id,
        [Parameter(Mandatory)][ValidateSet('P0', 'P1', 'P2')][string]$Severity,
        [Parameter(Mandatory)][string]$Category,
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$Detail,
        [string]$Evidence = '',
        [string]$Action = '',
        [string]$Safety = 'read'
    )
    $List.Add([pscustomobject]@{
        Id       = $Id
        Severity = $Severity
        Category = $Category
        Title    = $Title
        Detail   = $Detail
        Evidence = $Evidence
        Action   = $Action
        Safety   = $Safety
    })
}

function Get-DriveContentProfile {
    param($Drive)
    $active = 0.0; $media = 0.0; $downloads = 0.0; $archive = 0.0
    foreach ($f in @($Drive.TopFolders)) {
        $gb = [double]$f.SizeGB
        if ($f.Name -match '(?i)program files|steam|games|epic|gog|xbox|github|project|work|workspace|repos|code|anaconda|miniconda|wsl|docker|cuda|sdk|visual studio') { $active += $gb }
        if ($f.Name -match '(?i)photos|pictures|videos|video|music|audio|media|dcim|相册|照片|视频|素材') { $media += $gb }
        if ($f.Name -match '(?i)downloads?|下载|迅雷下载|baidunetdiskdownload') { $downloads += $gb }
        if ($f.Name -match '(?i)backup|backups|archive|归档|备份') { $archive += $gb }
    }
    return [pscustomobject]@{
        ActiveGB    = [math]::Round($active, 2)
        MediaGB     = [math]::Round($media, 2)
        DownloadsGB = [math]::Round($downloads, 2)
        ArchiveGB   = [math]::Round($archive, 2)
    }
}

function Get-StorageDriveRole {
    param([string]$DriveId, [string]$SystemDrive, $Profile)
    if ($DriveId -eq $SystemDrive) { return 'OS + applications + caches' }
    if ($Profile.MediaGB -gt ($Profile.ActiveGB * 1.2) -and $Profile.MediaGB -ge 10) { return 'Media + archive' }
    if ($Profile.ActiveGB -gt 0) { return 'Active work + games + projects' }
    return 'Data + archive'
}

function Invoke-StorageAudit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]$Scan,
        $Junk,
        $Migration,
        $Media,
        $Config
    )

    if (-not $Config) { $Config = Read-PcConfig }
    if ($null -eq $Junk) {
        if ($Scan.PSObject.Properties['Junk']) { $Junk = @($Scan.Junk) } else { $Junk = @() }
    }
    if ($null -eq $Migration) {
        if ($Scan.PSObject.Properties['Migration']) { $Migration = @($Scan.Migration) } else { $Migration = @() }
    }
    if ($null -eq $Media) {
        if ($Scan.PSObject.Properties['Media']) { $Media = $Scan.Media } else { $Media = $null }
    }

    $findings = [System.Collections.Generic.List[object]]::new()
    $recommendations = [System.Collections.Generic.List[string]]::new()
    $drives = @($Scan.Drives)
    $systemDrive = $env:SystemDrive

    $totalCap = 0.0; $totalUsed = 0.0; $totalFree = 0.0
    foreach ($d in $drives) {
        $totalCap += [double]$d.TotalGB
        $totalUsed += [double]$d.UsedGB
        $totalFree += [double]$d.FreeGB
    }
    $totalUsedPct = if ($totalCap -gt 0) { [math]::Round($totalUsed / $totalCap * 100, 1) } else { 0 }

    $driveRows = [System.Collections.Generic.List[object]]::new()
    foreach ($d in ($drives | Sort-Object @{ Expression = { if ($_.Id -eq $systemDrive) { 0 } else { 1 } } }, @{ Expression = { [double]$_.FreeGB }; Descending = $true })) {
        $isSystem = $d.Id -eq $systemDrive
        $freePct = if ($d.TotalGB -gt 0) { [math]::Round([double]$d.FreeGB / [double]$d.TotalGB * 100, 1) } else { 0 }
        $profile = Get-DriveContentProfile -Drive $d
        $role = Get-StorageDriveRole -DriveId $d.Id -SystemDrive $systemDrive -Profile $profile
        $targetPct = if ($isSystem) { 15 } else { 10 }
        $targetGB = if ($isSystem) { 50 } else { 20 }
        $status = 'ok'
        if ($freePct -lt 5 -or [double]$d.FreeGB -lt 20) {
            $status = 'critical'
            Add-StorageFinding -List $findings -Id "free-$($d.Id)" -Severity 'P0' -Category 'capacity' `
                -Title "Drive $($d.Id) is critically full" `
                -Detail ("Free space is {0:N1} GB ({1:N1}%). Keep at least {2}% / {3} GB free." -f $d.FreeGB, $freePct, $targetPct, $targetGB) `
                -Evidence ("{0:N1} GB used of {1:N1} GB" -f $d.UsedGB, $d.TotalGB) `
                -Action "Move large projects/media off $($d.Id) or clean regenerable data before it reaches 0 GB."
        } elseif ($freePct -lt $targetPct -or [double]$d.FreeGB -lt $targetGB) {
            $status = 'low'
            Add-StorageFinding -List $findings -Id "free-$($d.Id)" -Severity 'P1' -Category 'capacity' `
                -Title "Drive $($d.Id) is below the free-space budget" `
                -Detail ("Free space is {0:N1} GB ({1:N1}%). Target: >= {2}% / {3} GB." -f $d.FreeGB, $freePct, $targetPct, $targetGB) `
                -Evidence ("{0:N1} GB used of {1:N1} GB" -f $d.UsedGB, $d.TotalGB) `
                -Action "Plan cleanup, archive, or migration for $($d.Id)."
        }
        $driveRows.Add([pscustomobject]@{
            Id       = $d.Id
            Role     = $role
            TotalGB  = [double]$d.TotalGB
            UsedGB   = [double]$d.UsedGB
            FreeGB   = [double]$d.FreeGB
            FreePct  = $freePct
            TargetPct = $targetPct
            Status   = $status
            Files    = [int]$d.TotalFiles
        })
    }

    $junkTotal = 0.0; $safeGB = 0.0; $confirmGB = 0.0; $elevatedGB = 0.0
    $installerGB = 0.0
    foreach ($item in @($Junk)) {
        $gb = [double]$item.SizeGB
        if ($gb -le 0 -and $item.SizeMB) { $gb = [double]$item.SizeMB / 1024 }
        $junkTotal += $gb
        switch ($item.Safety) {
            'safe' { $safeGB += $gb }
            'confirm' { $confirmGB += $gb }
            'elevated' { $elevatedGB += $gb }
        }
        if ($item.Category -eq 'installer') { $installerGB += $gb }
    }

    $junkThreshold = [math]::Max(2, $totalUsed * 0.03)
    if ($junkTotal -ge $junkThreshold) {
        $junkPct = if ($totalUsed -gt 0) { [math]::Round($junkTotal / $totalUsed * 100, 1) } else { 0 }
        Add-StorageFinding -List $findings -Id 'junk-high' -Severity 'P1' -Category 'cleanup' `
            -Title 'Regenerable data exceeds the cleanup budget' `
            -Detail ("Cleanable candidates total {0:N1} GB ({1:N1}% of used space). Safe: {2:N1} GB; confirm: {3:N1} GB; elevated: {4:N1} GB." -f $junkTotal, $junkPct, $safeGB, $confirmGB, $elevatedGB) `
            -Evidence ("{0} candidates" -f @($Junk).Count) `
            -Action 'Preview and clean safe caches first; review confirm-level items separately.'
    }
    if ($installerGB -ge 1) {
        Add-StorageFinding -List $findings -Id 'installer-stale' -Severity 'P2' -Category 'cleanup' `
            -Title 'Old installers are taking meaningful space' `
            -Detail ("Old installers total {0:N1} GB. Keep only installers needed for rollback." -f $installerGB) `
            -Evidence 'Junk candidates with category installer' `
            -Action 'Review installers older than 30 days and remove or archive them.'
    }
    if ($confirmGB -ge 1) {
        Add-StorageFinding -List $findings -Id 'confirm-review' -Severity 'P2' -Category 'cleanup' `
            -Title 'Items needing manual confirmation are waiting' `
            -Detail ("Confirm-level candidates total {0:N1} GB (recycle bin, old installers, orphan data)." -f $confirmGB) `
            -Evidence 'Junk candidates with safety=confirm' `
            -Action 'Review them in the GUI cleanup view before deleting.'
    }

    $cloudLogical = 0.0; $cloudLocal = 0.0
    foreach ($d in $drives) {
        foreach ($c in @($d.Cloud)) {
            $cloudLogical += [double]$c.LogicalGB
            $cloudLocal += [double]$c.LocalGB
            $gap = [double]$c.LogicalGB - [double]$c.LocalGB
            if ($gap -ge 10) {
                Add-StorageFinding -List $findings -Id "cloud-$($c.Path)" -Severity 'P2' -Category 'cloud' `
                    -Title 'Cloud placeholder folder has a large logical/local gap' `
                    -Detail ("{0}: logical {1:N1} GB, local {2:N1} GB. Do not move placeholders as normal files." -f $c.Path, $c.LogicalGB, $c.LocalGB) `
                    -Evidence ("{0} logical files, {1} local files" -f $c.Files, $c.LocalFiles) `
                    -Action 'Keep placeholders in place; use the cloud client to manage offline availability.'
            }
        }
    }

    $mediaGB = 0.0; $photoGB = 0.0; $videoGB = 0.0
    if ($Media) {
        $photoGB = [double]$Media.PhotoGB
        $videoGB = [double]$Media.VideoGB
        $mediaGB = $photoGB + $videoGB
    }
    $mediaFolders = @()
    if ($Media -and $Media.PSObject.Properties['MediaFolders']) {
        $mediaFolders = @($Media.MediaFolders | Where-Object {
            $fileCount = [double]$_.Files
            $sizeGB = [double]$_.SizeGB
            -not ($fileCount -ge 2 -and $fileCount -lt 50 -and $sizeGB -ge 5 -and ($sizeGB / $fileCount) -ge 5)
        })
    }
    $systemMediaGB = 0.0
    foreach ($f in $mediaFolders) {
        if ($f.Drive -eq $systemDrive) { $systemMediaGB += [double]$f.SizeGB }
    }
    if ($systemMediaGB -ge 5) {
        Add-StorageFinding -List $findings -Id 'media-system' -Severity 'P1' -Category 'media' `
            -Title 'Media is stored on the system drive' `
            -Detail ("{0:N1} GB of photo/video data is on {1}. System drive space is the most expensive." -f $systemMediaGB, $systemDrive) `
            -Evidence (($mediaFolders | Where-Object { $_.Drive -eq $systemDrive } | ForEach-Object { "$($_.Drive)\$($_.Folder)" }) -join ', ') `
            -Action 'Archive media to a data drive using the AI media-archive suggestion, then keep only active edits locally.'
    }
    if ($mediaGB -ge 20 -and $mediaFolders.Count -gt 0) {
        $organized = @($mediaFolders | Where-Object { $_.Folder -match '^(19|20)\d{2}([-_].*)?$' })
        $mediaPrefixes = @($mediaFolders | ForEach-Object { "$($_.Drive)\$($_.Folder)" })
        $organizedEvidence = [System.Collections.Generic.List[string]]::new()
        foreach ($d in $drives) {
            foreach ($lf in @($d.LargeFiles)) {
                $lfPath = [string]$lf.Path
                foreach ($prefix in $mediaPrefixes) {
                    if ($lfPath.StartsWith($prefix + '\', [System.StringComparison]::OrdinalIgnoreCase) -and
                        $lfPath -match '\\\d{4}\\\d{4}-\d{2}') {
                        $organizedEvidence.Add($lfPath)
                        break
                    }
                }
            }
        }
        if ($organized.Count -eq 0 -and $organizedEvidence.Count -eq 0) {
            Add-StorageFinding -List $findings -Id 'media-unorganized' -Severity 'P2' -Category 'media' `
                -Title 'Media library is not organized by year/month' `
                -Detail ("{0:N1} GB of photos/videos ({1:N1} GB photo, {2:N1} GB video) is not under YYYY or YYYY-MM folders." -f $mediaGB, $photoGB, $videoGB) `
                -Evidence (($mediaFolders | Select-Object -First 6 | ForEach-Object { "$($_.Drive)\$($_.Folder)" }) -join ', ') `
                -Action 'Use the AI media-archive prompt or Invoke-OrganizeMedia to create YYYY\YYYY-MM folders with a manifest.'
        }
    }
    $mediaDrives = @($mediaFolders | ForEach-Object { $_.Drive } | Select-Object -Unique)
    if ($mediaDrives.Count -gt 1) {
        Add-StorageFinding -List $findings -Id 'media-scattered' -Severity 'P2' -Category 'path' `
            -Title 'Media folders are spread across multiple drives' `
            -Detail ("Media folders exist on: {0}. Consolidate the canonical library on one data drive." -f ($mediaDrives -join ', ')) `
            -Evidence (($mediaFolders | ForEach-Object { "$($_.Drive)\$($_.Folder)" }) -join ', ') `
            -Action 'Choose one primary Media root and archive older items there.'
    }

    $badNamePattern = '(?i)^(new folder|copy of|temp|tmp|old|_old|_backup)'
    $workspacePattern = '(?i)^(github|projects|project|work|workspace|repos|repositories|source|src|code)$'
    $downloadPattern = '(?i)^(downloads?|下载|迅雷下载|baidunetdiskdownload)$'
    $workspaceRoots = [System.Collections.Generic.List[string]]::new()
    $downloadRoots = [System.Collections.Generic.List[string]]::new()
    $workspaceLarge = [System.Collections.Generic.List[string]]::new()
    $downloadLarge = [System.Collections.Generic.List[string]]::new()
    $tempFolders = [System.Collections.Generic.List[string]]::new()
    $emptyDirs = 0
    $reparsePoints = 0
    $largeFileGB = 0.0
    $largeFileCount = 0
    $downloadTotal = 0.0
    $cloudPrefixes = @()
    foreach ($d in $drives) {
        foreach ($c in @($d.Cloud)) {
            if ($c.Path) { $cloudPrefixes += [string]$c.Path }
        }
    }

    foreach ($d in $drives) {
        $emptyDirs += @($d.EmptyDirs).Count
        $reparsePoints += @($d.ReparsePoints).Count
        foreach ($f in @($d.TopFolders)) {
            $path = "$($d.Id)\$($f.Name)"
            $gb = [double]$f.SizeGB
            if ($f.Name -match $workspacePattern) {
                $workspaceRoots.Add($path)
                if ($gb -ge 5) { $workspaceLarge.Add(("{0} ({1:N1} GB)" -f $path, $gb)) }
            }
            if ($f.Name -match $downloadPattern) {
                $downloadTotal += $gb
                if ($gb -ge 1) { $downloadRoots.Add($path) }
                if ($gb -ge 5) { $downloadLarge.Add(("{0} ({1:N1} GB)" -f $path, $gb)) }
            }
            if ($f.Name -match $badNamePattern -and $gb -ge 1) { $tempFolders.Add($path) }
        }
        foreach ($lf in @($d.LargeFiles)) {
            $lfPath = [string]$lf.Path
            $isCloud = $false
            foreach ($prefix in $cloudPrefixes) {
                if ($lfPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { $isCloud = $true; break }
            }
            if ($isCloud) { continue }
            $largeFileCount++
            $largeFileGB += [double]$lf.SizeMB / 1024
        }
    }

    if ($workspaceRoots.Count -gt 1) {
        Add-StorageFinding -List $findings -Id 'workspace-scattered' -Severity 'P2' -Category 'path' `
            -Title 'Project workspaces are scattered' `
            -Detail ("Found {0} likely workspace roots. Use one canonical workspace per machine and archive inactive repos." -f $workspaceRoots.Count) `
            -Evidence ($workspaceRoots -join ', ') `
            -Action 'Pick one workspace root (for example D:\Work), move active repos there, and archive the rest.'
    }
    if ($downloadRoots.Count -gt 1) {
        Add-StorageFinding -List $findings -Id 'downloads-scattered' -Severity 'P2' -Category 'path' `
            -Title 'Download folders are scattered' `
            -Detail ("Found {0} download roots. A single inbox with a 7/30-day triage rule is easier to manage." -f $downloadRoots.Count) `
            -Evidence ($downloadRoots -join ', ') `
            -Action 'Choose one download root, keep an _inbox folder, and archive or delete after triage.'
    }
    if ($downloadLarge.Count -gt 0) {
        Add-StorageFinding -List $findings -Id 'downloads-large' -Severity 'P2' -Category 'path' `
            -Title 'A download root is large enough to need triage' `
            -Detail ("{0:N1} GB sits in download folders. Unreviewed downloads are a common source of duplicate files and old installers." -f $downloadTotal) `
            -Evidence ($downloadLarge -join ', ') `
            -Action 'Apply a 7-day/30-day triage rule: keep, move to a project/media folder, or delete after verifying.'
    }
    if ($workspaceLarge.Count -gt 0) {
        Add-StorageFinding -List $findings -Id 'workspace-large' -Severity 'P2' -Category 'path' `
            -Title 'A project workspace is unusually large' `
            -Detail 'Large workspaces often mix source, build artifacts, datasets, and dependency caches. Keep only source in the repo and move generated data out.' `
            -Evidence ($workspaceLarge -join ', ') `
            -Action 'Archive inactive repos, move datasets/builds outside the repo, and use .gitignore, Git LFS, or external artifact storage.'
    }
    if ($tempFolders.Count -gt 0) {
        Add-StorageFinding -List $findings -Id 'temp-large-folders' -Severity 'P2' -Category 'path' `
            -Title 'Large folders use temporary or duplicate names' `
            -Detail ("{0} large top-level folders look like temporary/backup copies." -f $tempFolders.Count) `
            -Evidence ($tempFolders -join ', ') `
            -Action 'Rename to a descriptive project/data name, merge duplicates, or archive and remove.'
    }
    if ($emptyDirs -ge 5000) {
        Add-StorageFinding -List $findings -Id 'empty-dirs' -Severity 'P2' -Category 'path' `
            -Title 'Many empty directories' `
            -Detail ("{0} empty directories were found. They are low-risk but make navigation and counts noisy." -f $emptyDirs) `
            -Evidence ("{0} empty directories" -f $emptyDirs) `
            -Action 'Review empty directories before removing; keep ones required by tools.'
    }
    if ($reparsePoints -ge 200) {
        Add-StorageFinding -List $findings -Id 'reparse-many' -Severity 'P2' -Category 'path' `
            -Title 'Many junctions or reparse points' `
            -Detail ("{0} reparse points were found. Naive size tools may double-count targets." -f $reparsePoints) `
            -Evidence ("{0} reparse points" -f $reparsePoints) `
            -Action 'Document intentional junctions and avoid recursive backup/scan of both link and target.'
    }
    if ($largeFileGB -ge 20 -or $largeFileCount -ge 50) {
        Add-StorageFinding -List $findings -Id 'large-files' -Severity 'P2' -Category 'review' `
            -Title 'Large files deserve a periodic review' `
            -Detail ("{0} files >= {1} MB total {2:N1} GB. Some may be stale disk images, videos, or installers." -f $largeFileCount, $Config.largeFileMB, $largeFileGB) `
            -Evidence ("{0} large files totaling {1:N1} GB" -f $largeFileCount, $largeFileGB) `
            -Action 'Review the largest files; archive to cold storage or delete only after confirming ownership.'
    }

    $largeArchives = [System.Collections.Generic.List[object]]::new()
    foreach ($d in $drives) {
        foreach ($lf in @($d.LargeFiles)) {
            $lfPath = [string]$lf.Path
            $isCloud = $false
            foreach ($prefix in $cloudPrefixes) {
                if ($lfPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { $isCloud = $true; break }
            }
            if ($isCloud) { continue }
            $ext = [System.IO.Path]::GetExtension($lfPath).ToLowerInvariant()
            $sizeGB = [double]$lf.SizeMB / 1024
            if ($ext -in @('.zip', '.7z', '.rar', '.tar') -and $sizeGB -ge 5) {
                $largeArchives.Add([pscustomobject]@{ Path = $lfPath; SizeGB = [math]::Round($sizeGB, 1) })
            }
        }
    }
    if ($largeArchives.Count -gt 0) {
        $archiveGB = ($largeArchives | Measure-Object SizeGB -Sum).Sum
        $severity = if ($archiveGB -ge 20) { 'P1' } else { 'P2' }
        Add-StorageFinding -List $findings -Id 'large-archives' -Severity $severity -Category 'review' `
            -Title 'Large compressed archives need verification' `
            -Detail ("{0} archives >= 5 GB total {1:N1} GB. They may duplicate existing files or be old installation/backup images." -f $largeArchives.Count, $archiveGB) `
            -Evidence (($largeArchives | Sort-Object SizeGB -Descending | Select-Object -First 6 | ForEach-Object { "$($_.Path) ($($_.SizeGB) GB)" }) -join '; ') `
            -Action 'Verify the archive contents against existing folders. If unique, extract into the canonical media/archive layout and keep a checksum; if duplicate, keep one copy and remove the other.'
    }

    $hiberfilGB = 0.0
    foreach ($d in $drives) {
        foreach ($f in @($d.TopFolders)) {
            if ($f.Name -eq 'hiberfil.sys') { $hiberfilGB += [double]$f.SizeGB }
        }
    }
    if ($hiberfilGB -ge 8) {
        Add-StorageFinding -List $findings -Id 'hiberfil-large' -Severity 'P2' -Category 'system' `
            -Title 'Hibernation file is large' `
            -Detail ("hiberfil.sys uses {0:N1} GB. If hibernation/fast startup is not needed, disable it through Windows settings instead of deleting the file." -f $hiberfilGB) `
            -Evidence ("hiberfil.sys = {0:N1} GB" -f $hiberfilGB) `
            -Action 'If hibernation is unused, run powercfg /h off as administrator; otherwise keep it.'
    }

    $appsGB = 0.0
    $apps = @($Scan.InstalledApps)
    foreach ($a in $apps) { $appsGB += ([double]$a.EstimatedMB / 1024) }
    if ($totalUsed -gt 0 -and $appsGB / $totalUsed -ge 0.2) {
        Add-StorageFinding -List $findings -Id 'apps-large' -Severity 'P2' -Category 'apps' `
            -Title 'Installed applications dominate used space' `
            -Detail ("Tracked applications use about {0:N1} GB ({1:N1}% of used space)." -f $appsGB, ($appsGB / $totalUsed * 100)) `
            -Evidence ("{0} apps" -f $apps.Count) `
            -Action 'Review the largest apps in the GUI Apps view and uninstall unused ones.'
    }
    $orphanCount = 0
    if ($Scan.Orphans) {
        $orphanCount += @($Scan.Orphans.UninstallEntries).Count
        $orphanCount += @($Scan.Orphans.RunKeys).Count
        $orphanCount += @($Scan.Orphans.AppxData).Count
    }
    if ($orphanCount -ge 5) {
        Add-StorageFinding -List $findings -Id 'orphans' -Severity 'P2' -Category 'apps' `
            -Title 'Orphaned application records are accumulating' `
            -Detail ("{0} orphaned uninstall/startup/Store records were found." -f $orphanCount) `
            -Evidence 'Scan.Orphans' `
            -Action 'Review the Diagnostics view; remove only records whose targets are confirmed gone.'
    }

    $tierPlan = [System.Collections.Generic.List[object]]::new()
    foreach ($d in $driveRows) {
        $budget = if ($d.Id -eq $systemDrive) {
            'OS/apps <= 35%; user data <= 25%; free >= 15%'
        } elseif ($d.Role -like 'Active*') {
            'active projects <= 25%; media <= 45%; free >= 10%'
        } else {
            'archive/media <= 70%; backups <= 20%; free >= 10%'
        }
        $tierPlan.Add([pscustomobject]@{
            Drive = $d.Id
            Role  = $d.Role
            Budget = $budget
        })
    }

    $deductions = 0
    foreach ($f in $findings) {
        switch ($f.Severity) {
            'P0' { $deductions += 15 }
            'P1' { $deductions += 7 }
            default { $deductions += 3 }
        }
    }
    $healthScore = [math]::Max(0, 100 - $deductions)
    $grade = if ($healthScore -ge 85) { 'A' } elseif ($healthScore -ge 70) { 'B' } elseif ($healthScore -ge 50) { 'C' } else { 'D' }

    foreach ($f in ($findings | Sort-Object @{ Expression = { switch ($_.Severity) { 'P0' { 0 } 'P1' { 1 } default { 2 } } } })) {
        if ($f.Action -and -not $recommendations.Contains($f.Action)) { $recommendations.Add($f.Action) }
    }

    $topConsumers = [System.Collections.Generic.List[object]]::new()
    foreach ($d in $drives) {
        foreach ($f in @($d.TopFolders | Select-Object -First 8)) {
            $topConsumers.Add([pscustomobject]@{
                Drive = $d.Id
                Path  = "$($d.Id)\$($f.Name)"
                SizeGB = [double]$f.SizeGB
                Files = [int]$f.Files
            })
        }
    }

    return [pscustomobject]@{
        SchemaVersion   = $script:StorageStrategyVersion
        GeneratedAt     = (Get-Date).ToString('s')
        Computer        = $Scan.Computer
        HealthScore     = $healthScore
        Grade           = $grade
        Capacity        = [pscustomobject]@{
            TotalGB   = [math]::Round($totalCap, 2)
            UsedGB    = [math]::Round($totalUsed, 2)
            FreeGB    = [math]::Round($totalFree, 2)
            UsedPct   = $totalUsedPct
            Drives    = @($driveRows)
        }
        Workload        = [pscustomobject]@{
            JunkGB        = [math]::Round($junkTotal, 2)
            SafeGB        = [math]::Round($safeGB, 2)
            ConfirmGB     = [math]::Round($confirmGB, 2)
            ElevatedGB    = [math]::Round($elevatedGB, 2)
            InstallerGB   = [math]::Round($installerGB, 2)
            MediaGB       = [math]::Round($mediaGB, 2)
            PhotoGB       = [math]::Round($photoGB, 2)
            VideoGB       = [math]::Round($videoGB, 2)
            AppsGB        = [math]::Round($appsGB, 2)
            DownloadGB    = [math]::Round($downloadTotal, 2)
            CloudLogicalGB = [math]::Round($cloudLogical, 2)
            CloudLocalGB  = [math]::Round($cloudLocal, 2)
        }
        TierPlan        = @($tierPlan)
        Findings        = @($findings | Sort-Object @{ Expression = { switch ($_.Severity) { 'P0' { 0 } 'P1' { 1 } default { 2 } } } })
        Recommendations = @($recommendations | Select-Object -First 12)
        TopConsumers    = @($topConsumers | Sort-Object SizeGB -Descending | Select-Object -First 20)
    }
}

function ConvertTo-StorageMarkdownTable {
    param([string[]]$Headers, [object[]]$Rows)
    if (-not $Rows -or $Rows.Count -eq 0) { return "_No data._`n" }
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('| ' + ($Headers -join ' | ') + ' |')
    [void]$sb.AppendLine('|' + (($Headers | ForEach-Object { '---' }) -join '|') + '|')
    foreach ($r in $Rows) {
        [void]$sb.AppendLine('| ' + (($r | ForEach-Object { [string]$_ }) -join ' | ') + ' |')
    }
    return $sb.ToString() + "`n"
}

function New-StorageAuditMarkdown {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Audit)

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('# Storage audit')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine("- Generated: $($Audit.GeneratedAt)")
    [void]$sb.AppendLine("- Computer: $($Audit.Computer)")
    [void]$sb.AppendLine("- Health score: **$($Audit.HealthScore)/100** (grade $($Audit.Grade))")
    [void]$sb.AppendLine()

    [void]$sb.AppendLine('## Capacity')
    $rows = @()
    foreach ($d in $Audit.Capacity.Drives) {
        $rows += , @($d.Id, $d.Role, $d.TotalGB, $d.UsedGB, $d.FreeGB, "$($d.FreePct)%", $d.Status)
    }
    [void]$sb.Append((ConvertTo-StorageMarkdownTable -Headers @('Drive', 'Role', 'Total GB', 'Used GB', 'Free GB', 'Free %', 'Status') -Rows $rows))
    [void]$sb.AppendLine(("Total: {0:N1} GB used of {1:N1} GB ({2:N1}%)." -f $Audit.Capacity.UsedGB, $Audit.Capacity.TotalGB, $Audit.Capacity.UsedPct))
    [void]$sb.AppendLine()

    [void]$sb.AppendLine('## Workload')
    $w = $Audit.Workload
    [void]$sb.AppendLine(("- Cleanable: {0:N1} GB (safe {1:N1}, confirm {2:N1}, elevated {3:N1})" -f $w.JunkGB, $w.SafeGB, $w.ConfirmGB, $w.ElevatedGB))
    [void]$sb.AppendLine(("- Media: {0:N1} GB (photo {1:N1}, video {2:N1})" -f $w.MediaGB, $w.PhotoGB, $w.VideoGB))
    [void]$sb.AppendLine(("- Apps (estimated): {0:N1} GB" -f $w.AppsGB))
    [void]$sb.AppendLine(("- Downloads (top-level): {0:N1} GB" -f $w.DownloadGB))
    [void]$sb.AppendLine(("- Cloud: logical {0:N1} GB / local {1:N1} GB" -f $w.CloudLogicalGB, $w.CloudLocalGB))
    [void]$sb.AppendLine()

    [void]$sb.AppendLine('## Findings')
    foreach ($severity in @('P0', 'P1', 'P2')) {
        $group = @($Audit.Findings | Where-Object { $_.Severity -eq $severity })
        if ($group.Count -eq 0) { continue }
        [void]$sb.AppendLine("### $severity")
        $rows = @()
        foreach ($f in $group) {
            $rows += , @($f.Category, $f.Title, $f.Evidence, $f.Action)
        }
        [void]$sb.Append((ConvertTo-StorageMarkdownTable -Headers @('Category', 'Finding', 'Evidence', 'Action') -Rows $rows))
    }

    [void]$sb.AppendLine('## Tier plan')
    $rows = @()
    foreach ($t in $Audit.TierPlan) { $rows += , @($t.Drive, $t.Role, $t.Budget) }
    [void]$sb.Append((ConvertTo-StorageMarkdownTable -Headers @('Drive', 'Role', 'Budget') -Rows $rows))

    [void]$sb.AppendLine('## Top consumers')
    $rows = @()
    foreach ($c in $Audit.TopConsumers) { $rows += , @($c.Path, $c.SizeGB, $c.Files) }
    [void]$sb.Append((ConvertTo-StorageMarkdownTable -Headers @('Path', 'Size GB', 'Files') -Rows $rows))

    [void]$sb.AppendLine('## Recommended actions')
    foreach ($r in $Audit.Recommendations) { [void]$sb.AppendLine("- $r") }
    return $sb.ToString()
}
