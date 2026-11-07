# Junk candidates catalog (path -> category). Used by classify and clean.
$script:JunkCandidates = @(
    @{ Name='User TEMP'; Path=$env:TEMP; Category='User cache' },
    @{ Name='Local TEMP'; Path="$env:LOCALAPPDATA\Temp"; Category='User cache' },
    @{ Name='CrashDumps'; Path="$env:LOCALAPPDATA\CrashDumps"; Category='User cache' },
    @{ Name='D3DSCache'; Path="$env:LOCALAPPDATA\D3DSCache"; Category='User cache' },
    @{ Name='NVIDIA DXCache'; Path="$env:LOCALAPPDATA\NVIDIA\DXCache"; Category='User cache' },
    @{ Name='NVIDIA GLCache'; Path="$env:LOCALAPPDATA\NVIDIA\GLCache"; Category='User cache' },
    @{ Name='INetCache'; Path="$env:LOCALAPPDATA\Microsoft\Windows\INetCache"; Category='User cache' },
    @{ Name='WebCache'; Path="$env:LOCALAPPDATA\Microsoft\Windows\WebCache"; Category='User cache' },
    @{ Name='Explorer thumbnails'; Path="$env:LOCALAPPDATA\Microsoft\Windows\Explorer"; Category='User cache' },
    @{ Name='pip cache'; Path="$env:LOCALAPPDATA\pip\Cache"; Category='Dev cache' },
    @{ Name='npm cache'; Path="$env:LOCALAPPDATA\npm-cache"; Category='Dev cache' },
    @{ Name='Yarn cache'; Path="$env:LOCALAPPDATA\Yarn\Cache"; Category='Dev cache' },
    @{ Name='pnpm cache'; Path="$env:LOCALAPPDATA\pnpm-cache"; Category='Dev cache' },
    @{ Name='uv cache'; Path="$env:LOCALAPPDATA\uv\cache"; Category='Dev cache' },
    @{ Name='electron cache'; Path="$env:LOCALAPPDATA\electron"; Category='Dev cache' },
    @{ Name='electron-builder'; Path="$env:LOCALAPPDATA\electron-builder"; Category='Dev cache' },
    @{ Name='Windows Update cache'; Path="$env:SystemRoot\SoftwareDistribution\Download"; Category='System' },
    @{ Name='$WinREAgent'; Path="$env:SystemDrive\`$WinREAgent"; Category='System' },
    @{ Name='Windows Logs'; Path="$env:SystemRoot\Logs"; Category='System' },
    @{ Name='Windows Temp'; Path="$env:SystemRoot\Temp"; Category='System' },
    @{ Name='WER'; Path="$env:ProgramData\Microsoft\Windows\WER"; Category='System' },
    @{ Name='Delivery Optimization'; Path="$env:ProgramData\Microsoft\Windows\DeliveryOptimization"; Category='System' },
    @{ Name='inetpub'; Path="$env:SystemDrive\inetpub"; Category='System' }
)

function Get-JunkCandidates {
    param([object[]]$Scan, [object]$Config)

    $junk = @()
    foreach ($c in $script:JunkCandidates) {
        $path = $c.Path
        # Resolve $env: prefix to actual path using switch
        switch -regex ($path) {
            '^\\$env:TEMP$'            { $path = $env:TEMP }
            '^\\$env:LOCALAPPDATA$'  { $path = $env:LOCALAPPDATA }
            '^\\$env:SystemRoot$'    { $path = $env:SystemRoot }
            '^\\$env:SystemDrive$'   { $path = $env:SystemDrive }
        }
        $mb = $null
        if (Test-Path -LiteralPath $path -ErrorAction SilentlyContinue) {
            $stack = [System.Collections.Generic.Stack[string]]::new()
            $stack.Push($path)
            while ($stack.Count -gt 0) {
                $dir = $stack.Pop()
                try { $entries = [System.IO.Directory]::EnumerateFileSystemEntries($dir) } catch { continue }
                foreach ($e in $entries) {
                    try {
                        $attr = [int][System.IO.File]::GetAttributes($e)
                        if (($attr -band 0x400) -ne 0 -and (($attr -band $script:CloudFlags) -eq 0)) { continue }
                        if (($attr -band 0x10) -ne 0) { $stack.Push($e); continue }
                        $fi = [System.IO.FileInfo]$e
                        $mb += $fi.Length
                    } catch { }
                }
            }
        }
        if ($mb -and $mb -gt 0) {
            $junk += [pscustomobject]@{ Name=$c.Name; SizeMB=[math]::Round($mb/1MB,1); Category=$c.Category; Path=$path }
        }
    }
    return $junk
}

function Get-PcRoot {
    return $script:PcRoot
}