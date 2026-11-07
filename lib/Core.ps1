$script:PcManagerVersion = '0.1.0'

function Get-PcRoot {
    return $script:PcRoot
}

function Get-FixedDrives {
    Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue |
        Where-Object { $_.DriveType -eq 3 } |
        Select-Object -ExpandProperty DeviceID
}

function Get-DriveInfo {
    param([Parameter(Mandatory)][string]$Drive)
    Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$Drive'" -ErrorAction SilentlyContinue |
        Select-Object DeviceID,
            @{n = 'TotalGB'; e = { [math]::Round($_.Size / 1GB, 2) } },
            @{n = 'FreeGB'; e = { [math]::Round($_.FreeSpace / 1GB, 2) } },
            @{n = 'UsedGB'; e = { [math]::Round(($_.Size - $_.FreeSpace) / 1GB, 2) } }
}

function Test-IsAdmin {
    return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )
}

$script:CloudFlags = 0x400000 -bor 0x1000 -bor 0x100000

function Get-DirSizeMB {
    param([Parameter(Mandatory)][string]$Path, [switch]$LocalOnly)

    if (-not (Test-Path -LiteralPath $Path -ErrorAction SilentlyContinue)) { return 0 }
    $total = 0L
    $stack = [System.Collections.Generic.Stack[string]]::new()
    $stack.Push($Path)

    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
        foreach ($e in $entries) {
            try {
                $attr = [int][System.IO.File]::GetAttributes($e)
                if (($attr -band 0x10) -ne 0) {
                    if (($attr -band 0x400) -ne 0 -and (($attr -band $script:CloudFlags) -eq 0)) { continue }
                    $stack.Push($e)
                } else {
                    if ($LocalOnly -and (($attr -band $script:CloudFlags) -ne 0)) { continue }
                    $total += ([System.IO.FileInfo]$e).Length
                }
            } catch { }
        }
    }
    return [math]::Round($total / 1MB, 1)
}

function Get-CloudUsage {
    param([Parameter(Mandatory)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path -ErrorAction SilentlyContinue)) { return $null }

    $logical = 0L
    $local = 0L
    $files = 0
    $localFiles = 0
    $stack = [System.Collections.Generic.Stack[string]]::new()
    $stack.Push($Path)

    while ($stack.Count -gt 0) {
        $dir = $stack.Pop()
        try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
        foreach ($e in $entries) {
            try {
                $attr = [int][System.IO.File]::GetAttributes($e)
                if (($attr -band 0x10) -ne 0) {
                    if (($attr -band 0x400) -ne 0 -and (($attr -band $script:CloudFlags) -eq 0)) { continue }
                    $stack.Push($e)
                    continue
                }
                $len = ([System.IO.FileInfo]$e).Length
                $logical += $len
                $files++
                if (($attr -band $script:CloudFlags) -eq 0) {
                    $local += $len
                    $localFiles++
                }
            } catch { }
        }
    }

    return [pscustomobject]@{
        Path       = $Path
        LogicalGB  = [math]::Round($logical / 1GB, 2)
        LocalGB    = [math]::Round($local / 1GB, 2)
        Files      = $files
        LocalFiles = $localFiles
    }
}

function Get-ExtCategory {
    param([string]$Extension)

    $ext = $Extension.ToLowerInvariant()
    $photo = @('.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.bmp', '.gif', '.tif', '.tiff', '.avif', '.raw',
        '.cr2', '.cr3', '.nef', '.arw', '.dng', '.orf', '.rw2', '.raf', '.srw', '.pef')
    $video = @('.mp4', '.mov', '.avi', '.mkv', '.wmv', '.m4v', '.3gp', '.flv', '.ts', '.mts', '.m2ts', '.webm')
    $audio = @('.mp3', '.flac', '.wav', '.aac', '.m4a', '.ogg', '.wma', '.ape')
    $doc = @('.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.md', '.epub', '.mobi', '.csv')
    $archive = @('.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.cab')
    $installer = @('.exe', '.msi', '.msix', '.appx', '.msp')
    $dev = @('.ps1', '.py', '.js', '.ts', '.tsx', '.jsx', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.json', '.yaml', '.yml', '.toml')

    if ($photo -contains $ext) { return 'photo' }
    if ($video -contains $ext) { return 'video' }
    if ($audio -contains $ext) { return 'audio' }
    if ($doc -contains $ext) { return 'document' }
    if ($archive -contains $ext) { return 'archive' }
    if ($installer -contains $ext) { return 'installer' }
    if ($dev -contains $ext) { return 'dev' }
    return 'other'
}

function Read-PcConfig {
    param([string]$Path)
    $default = [pscustomobject]@{
        largeFileMB       = 500
        maxLargeFiles     = 200
        maxExtensionItems = 80
        installerAgeDays  = 30
        minMigrationGB    = 5
        cloudRoots        = @(
            "$env:USERPROFILE\OneDrive",
            "$env:USERPROFILE\iCloudPhotos",
            "$env:USERPROFILE\iCloudDrive"
        )
        downloadDirs      = @(
            "$env:USERPROFILE\Downloads",
            'D:\Downloads',
            'D:\Download',
            'E:\Download',
            'E:\BaiduNetdiskDownload'
        )
    }
    if (-not $Path) {
        $candidate = Join-Path $script:PcRoot 'config\default.json'
        if (Test-Path -LiteralPath $candidate) { $Path = $candidate }
    }
    if ($Path -and (Test-Path -LiteralPath $Path)) {
        try {
            $user = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($p in $default.PSObject.Properties) {
                if (-not $user.PSObject.Properties[$p.Name]) {
                    $user | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value
                }
            }
            return $user
        } catch {
            return $default
        }
    }
    return $default
}

function Get-InstalledApps {
    $paths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    Get-ItemProperty $paths -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -and -not $_.SystemComponent } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallLocation, UninstallString,
            @{n = 'EstimatedMB'; e = { if ($_.EstimatedSize) { [math]::Round($_.EstimatedSize / 1KB, 1) } else { 0 } } } |
        Sort-Object EstimatedMB -Descending |
        Select-Object -First 120
}

function Get-OrphanInfo {
    $result = [pscustomobject]@{
        UninstallEntries = @()
        RunKeys          = @()
        AppxData         = @()
    }

    $paths = @(
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
        'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
    )
    $uninstall = @()
    foreach ($e in (Get-ItemProperty $paths -ErrorAction SilentlyContinue)) {
        if (-not $e.DisplayName) { continue }
        $bad = $false
        if ($e.InstallLocation) {
            $loc = $e.InstallLocation.Trim('"')
            if ($loc -and -not (Test-Path -LiteralPath $loc -ErrorAction SilentlyContinue)) { $bad = $true }
        }
        if ($e.UninstallString -match '^\s*"?([^"]+\.exe)') {
            $exe = $Matches[1]
            $leaf = Split-Path -Leaf $exe
            if ($leaf -notmatch '^(msiexec|MsiExec)\.exe$' -and $exe -match '[\\/]' -and -not (Test-Path -LiteralPath $exe -ErrorAction SilentlyContinue)) {
                $bad = $true
            }
        }
        if ($bad) {
            $uninstall += [pscustomobject]@{
                DisplayName     = $e.DisplayName
                DisplayVersion  = $e.DisplayVersion
                InstallLocation = $e.InstallLocation
                UninstallString = $e.UninstallString
            }
        }
    }
    $result.UninstallEntries = $uninstall

    $runKeys = @(
        'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
        'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'
    )
    $missing = @()
    foreach ($k in $runKeys) {
        $p = Get-ItemProperty $k -ErrorAction SilentlyContinue
        if (-not $p) { continue }
        $p.PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' } | ForEach-Object {
            $cmd = [string]$_.Value
            if ($cmd -match '^\s*"?([^"]+\.exe)') {
                $exe = $Matches[1]
                if ($exe -match '[\\/]' -and -not (Test-Path -LiteralPath $exe -ErrorAction SilentlyContinue)) {
                    $missing += [pscustomobject]@{ Key = $k; Name = $_.Name; Command = $cmd }
                }
            }
        }
    }
    $result.RunKeys = $missing

    $installed = Get-AppxPackage -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PackageFamilyName
    $pkgRoot = Join-Path $env:LOCALAPPDATA 'Packages'
    $appx = @()
    if (Test-Path -LiteralPath $pkgRoot -ErrorAction SilentlyContinue) {
        foreach ($d in (Get-ChildItem -LiteralPath $pkgRoot -Force -Directory -ErrorAction SilentlyContinue)) {
            if ($installed -notcontains $d.Name) {
                $mb = Get-DirSizeMB $d.FullName
                if ($mb -ge 10) {
                    $appx += [pscustomobject]@{ Package = $d.Name; SizeMB = $mb }
                }
            }
        }
    }
    $result.AppxData = $appx | Sort-Object SizeMB -Descending

    return $result
}
