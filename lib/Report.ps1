function New-MdTable {
    param([string[]]$Headers, [object[]]$Rows)
    if (-not $Rows) { return "_No data._`n" }
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('| ' + ($Headers -join ' | ') + ' |')
    [void]$sb.AppendLine('|' + (($Headers | ForEach-Object { '---' }) -join '|') + '|')
    foreach ($r in $Rows) {
        [void]$sb.AppendLine('| ' + (($r | ForEach-Object { [string]$_ }) -join ' | ') + ' |')
    }
    return $sb.ToString() + "`n"
}

function New-MarkdownReport {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Scan)

    if (-not $Scan.PSObject.Properties['Junk']) { $Scan = Add-PcAnalysis -Scan $Scan }

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('# PC Manager Report')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine(("- Generated: {0}" -f $Scan.GeneratedAt))
    [void]$sb.AppendLine(("- Computer: {0} / {1}" -f $Scan.Computer, $Scan.User))
    [void]$sb.AppendLine(("- OS: {0}" -f $Scan.OS))
    [void]$sb.AppendLine(("- Scan time: {0}s ({1})" -f $Scan.ScanSeconds, $(if ($Scan.FastMode) { 'fast' } else { 'full' })))
    [void]$sb.AppendLine()

    [void]$sb.AppendLine('## Disk overview')
    $rows = @()
    foreach ($d in $Scan.Drives) {
        $pct = if ($d.TotalGB -gt 0) { [math]::Round($d.FreeGB / $d.TotalGB * 100, 1) } else { 0 }
        $rows += , @($d.Id, $d.TotalGB, $d.UsedGB, $d.FreeGB, "$pct%", $d.TotalFiles, $d.ScanSeconds)
    }
    [void]$sb.Append((New-MdTable -Headers @('Drive', 'Total GB', 'Used GB', 'Free GB', 'Free %', 'Files', 'Scan s') -Rows $rows))

    foreach ($d in $Scan.Drives) {
        [void]$sb.AppendLine(("## Drive {0}" -f $d.Id))
        [void]$sb.AppendLine()
        [void]$sb.AppendLine('### Top folders')
        $rows = @()
        foreach ($f in ($d.TopFolders | Select-Object -First 15)) {
            $rows += , @($f.Name, $f.SizeGB, $f.Files)
        }
        [void]$sb.Append((New-MdTable -Headers @('Folder', 'Size GB', 'Files') -Rows $rows))

        if ($d.Extensions.Count -gt 0) {
            [void]$sb.AppendLine('### File types')
            $rows = @()
            foreach ($x in ($d.Extensions | Select-Object -First 15)) {
                $rows += , @($x.Ext, $x.Kind, $x.Count, $x.SizeGB)
            }
            [void]$sb.Append((New-MdTable -Headers @('Ext', 'Kind', 'Count', 'Size GB') -Rows $rows))
        }

        if ($d.Cloud.Count -gt 0) {
            [void]$sb.AppendLine('### Cloud placeholders')
            $rows = @()
            foreach ($c in $d.Cloud) {
                $rows += , @($c.Path, $c.LogicalGB, $c.LocalGB, $c.Files, $c.LocalFiles)
            }
            [void]$sb.Append((New-MdTable -Headers @('Path', 'Logical GB', 'Local GB', 'Files', 'Local files') -Rows $rows))
        }
    }

    [void]$sb.AppendLine('## Junk candidates')
    $rows = @()
    foreach ($j in ($Scan.Junk | Select-Object -First 80)) {
        $rows += , @($j.Name, $j.Category, $j.SizeGB, $j.Safety, $j.Path)
    }
    [void]$sb.Append((New-MdTable -Headers @('Item', 'Category', 'Size GB', 'Safety', 'Path') -Rows $rows))

    [void]$sb.AppendLine('## Migration candidates')
    $rows = @()
    foreach ($m in ($Scan.Migration | Select-Object -First 30)) {
        $rows += , @($m.Name, $m.SizeGB, $m.SuggestedTarget, $m.Path)
    }
    [void]$sb.Append((New-MdTable -Headers @('Item', 'Size GB', 'Suggested target', 'Path') -Rows $rows))

    [void]$sb.AppendLine('## Media inventory')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine(("- Photos: {0} files / {1:N2} GB" -f $Scan.Media.PhotoCount, $Scan.Media.PhotoGB))
    [void]$sb.AppendLine(("- Videos: {0} files / {1:N2} GB" -f $Scan.Media.VideoCount, $Scan.Media.VideoGB))
    [void]$sb.AppendLine(("- Audio: {0} files / {1:N2} GB" -f $Scan.Media.AudioCount, $Scan.Media.AudioGB))
    [void]$sb.AppendLine()
    $rows = @()
    foreach ($f in ($Scan.Media.MediaFolders | Select-Object -First 20)) {
        $rows += , @($f.Drive, $f.Folder, $f.SizeGB, $f.Files)
    }
    [void]$sb.Append((New-MdTable -Headers @('Drive', 'Folder', 'Size GB', 'Files') -Rows $rows))

    [void]$sb.AppendLine('## Orphans and broken entries')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine(("Orphaned uninstall entries: {0}" -f @($Scan.Orphans.UninstallEntries).Count))
    foreach ($o in ($Scan.Orphans.UninstallEntries | Select-Object -First 15)) {
        [void]$sb.AppendLine(("- {0} {1} -> {2}" -f $o.DisplayName, $o.DisplayVersion, $o.InstallLocation))
    }
    [void]$sb.AppendLine()
    [void]$sb.AppendLine(("Broken startup entries: {0}" -f @($Scan.Orphans.RunKeys).Count))
    foreach ($o in ($Scan.Orphans.RunKeys | Select-Object -First 15)) {
        [void]$sb.AppendLine(("- {0}: {1}" -f $o.Name, $o.Command))
    }
    [void]$sb.AppendLine()
    $appxItems = @($Scan.Orphans.AppxData | Where-Object { $_.Package })
    [void]$sb.AppendLine(("Orphaned Store app data: {0}" -f $appxItems.Count))
    foreach ($o in ($appxItems | Select-Object -First 15)) {
        [void]$sb.AppendLine(("- {0}: {1} MB" -f $o.Package, $o.SizeMB))
    }
    [void]$sb.AppendLine()

    [void]$sb.AppendLine('## Recommendations')
    foreach ($r in $Scan.Recommendations) { [void]$sb.AppendLine("- $r") }
    [void]$sb.AppendLine()

    [void]$sb.AppendLine('## Safety')
    [void]$sb.AppendLine()
    [void]$sb.AppendLine('- `scan` and `report` are read-only.')
    [void]$sb.AppendLine('- `clean`, `dedupe` and `organize` only act with `-Execute`.')
    [void]$sb.AppendLine('- `elevated` items require an Administrator PowerShell session.')
    [void]$sb.AppendLine('- Do not delete `WinSxS`, `Windows\Installer`, `Package Cache`, pagefile, or hiberfil directly.')
    [void]$sb.AppendLine('- Back up or move user data; never delete photos, chats, drafts, or databases blindly.')

    return $sb.ToString()
}

function New-HtmlBars {
    param([object[]]$Rows, [string]$Label, [string]$Value, [string]$Unit = 'GB')
    if (-not $Rows) { return '' }
    $max = ($Rows | Measure-Object -Property $Value -Maximum).Maximum
    if (-not $max -or $max -le 0) { return '' }
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine('<div class="bars">')
    foreach ($r in $Rows) {
        $v = [double]$r.$Value
        $pct = [math]::Round($v / $max * 100, 1)
        $lbl = [System.Net.WebUtility]::HtmlEncode([string]$r.$Label)
        [void]$sb.AppendLine(("<div class='bar'><span class='bar-label'>{0}</span><span class='bar-track'><span class='bar-fill' style='width:{1}%'></span></span><span class='bar-value'>{2:N1} {3}</span></div>" -f $lbl, $pct, $v, $Unit))
    }
    [void]$sb.AppendLine('</div>')
    return $sb.ToString()
}

function New-HtmlReport {
    [CmdletBinding()]
    param([Parameter(Mandatory)]$Scan)

    if (-not $Scan.PSObject.Properties['Junk']) { $Scan = Add-PcAnalysis -Scan $Scan }

    $style = @'
<style>
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;background:#f7f8fa;color:#1f2937}
h1{margin-bottom:4px} h2{margin-top:32px} table{border-collapse:collapse;margin:8px 0 20px;background:#fff}
th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:left;font-size:13px}
th{background:#e5e7eb} tr:nth-child(even){background:#f3f4f6}
code{background:#eef2ff;padding:1px 4px;border-radius:3px}
.bars{margin:8px 0 20px}
.bar{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px}
.bar-label{width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;background:#e5e7eb;height:14px;border-radius:3px;overflow:hidden}
.bar-fill{display:block;height:100%;background:#3b82f6}
.bar-value{width:90px;text-align:right;color:#4b5563}
</style>
'@
    $esc = { param($s) [System.Net.WebUtility]::HtmlEncode([string]$s) }

    $html = [System.Text.StringBuilder]::new()
    [void]$html.AppendLine('<!doctype html><html><head><meta charset="utf-8"><title>PC Manager Report</title>')
    [void]$html.AppendLine($style)
    [void]$html.AppendLine('</head><body>')
    [void]$html.AppendLine('<h1>PC Manager Report</h1>')
    [void]$html.AppendLine(("<p>Generated: {0}<br>Computer: {1} / {2}<br>OS: {3}<br>Scan: {4}s</p>" -f
        (& $esc $Scan.GeneratedAt), (& $esc $Scan.Computer), (& $esc $Scan.User), (& $esc $Scan.OS), $Scan.ScanSeconds))

    $driveRows = foreach ($d in $Scan.Drives) {
        [pscustomobject]@{
            Drive   = $d.Id
            TotalGB = $d.TotalGB
            UsedGB  = $d.UsedGB
            FreeGB  = $d.FreeGB
            FreePct = $(if ($d.TotalGB -gt 0) { [math]::Round($d.FreeGB / $d.TotalGB * 100, 1) } else { 0 })
            Files   = $d.TotalFiles
        }
    }
    [void]$html.AppendLine('<h2>Disk overview</h2>')
    [void]$html.AppendLine((($driveRows | ConvertTo-Html -Fragment) -join "`n"))

    foreach ($d in $Scan.Drives) {
        [void]$html.AppendLine(("<h2>Drive {0}</h2>" -f (& $esc $d.Id)))
        [void]$html.AppendLine('<h3>Top folders</h3>')
        [void]$html.AppendLine((New-HtmlBars -Rows ($d.TopFolders | Select-Object -First 10) -Label 'Name' -Value 'SizeGB' -Unit 'GB'))
        [void]$html.AppendLine((($d.TopFolders | Select-Object -First 15 Name, SizeGB, Files | ConvertTo-Html -Fragment) -join "`n"))
        if ($d.Extensions.Count -gt 0) {
            [void]$html.AppendLine('<h3>File types</h3>')
            [void]$html.AppendLine((New-HtmlBars -Rows ($d.Extensions | Select-Object -First 10) -Label 'Ext' -Value 'SizeGB' -Unit 'GB'))
            [void]$html.AppendLine((($d.Extensions | Select-Object -First 15 Ext, Kind, Count, SizeGB | ConvertTo-Html -Fragment) -join "`n"))
        }
    }

    [void]$html.AppendLine('<h2>Junk candidates</h2>')
    [void]$html.AppendLine((($Scan.Junk | Select-Object -First 80 Name, Category, SizeGB, Safety, Path | ConvertTo-Html -Fragment) -join "`n"))
    [void]$html.AppendLine('<h2>Migration candidates</h2>')
    [void]$html.AppendLine((($Scan.Migration | Select-Object -First 30 Name, SizeGB, SuggestedTarget, Path | ConvertTo-Html -Fragment) -join "`n"))
    [void]$html.AppendLine('<h2>Recommendations</h2><ul>')
    foreach ($r in $Scan.Recommendations) { [void]$html.AppendLine(("<li>{0}</li>" -f (& $esc $r))) }
    [void]$html.AppendLine('</ul>')
    [void]$html.AppendLine('</body></html>')
    return $html.ToString()
}
