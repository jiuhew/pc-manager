# pc-manager v0.1.1

性能与照片整理改进。

## Highlights

- **快速模式更快**：`-Fast` 自动跳过 `WinSxS`、`Windows\Installer`、`SoftwareDistribution`、`Package Cache`。测试机 C 盘从 **132s 降到 96s**。
- **自定义排除**：`-Exclude` 跳过大型游戏/备份目录。
- **可选并行扫描**：`-Parallel` 适用于不同物理磁盘；同一物理磁盘上默认顺序扫描更快。
- **EXIF 拍摄时间**：JPEG/TIFF 直接读取 `DateTimeOriginal`；HEIC/CR3/RAW 安装 ExifTool 后自动支持。
- **HTML 条形图**：Top 目录和文件类型可视化。

## Quick start

```powershell
pwsh -File pc-manager.ps1 scan -Drives C,D,E
pwsh -File pc-manager.ps1 scan -Drives C,D,E -Fast
pwsh -File pc-manager.ps1 report -ScanPath reports\scan-<timestamp>.json -Format html
```

## Verified

- Sequential full C/D/E: about **3–6 minutes** depending on disk load (~166 seconds on an idle run), ~1.58 million files.
- Fast C: about **96 seconds**.
- Parallel scanning is opt-in; when drives share a physical disk, I/O contention can reduce or negate the benefit.
- EXIF test: file time 18:33, EXIF 13:52; organizer used `2024-11` from EXIF.

## Notes

- For HEIC/CR3/RAW capture time, install [ExifTool](https://exiftool.org/) and make sure `exiftool` is on `PATH`.
- Without ExifTool, those formats fall back to the file timestamp.
- `-Parallel` is only beneficial when drives are on different physical disks.

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
