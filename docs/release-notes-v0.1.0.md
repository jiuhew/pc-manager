# pc-manager v0.1.0

首个可用版本：快速盘点 Windows 所有磁盘，生成结构化报告，并通过 AI Skill 库完成清理、迁移、去重和照片整理。

## Highlights

- **全盘扫描**：C/D/E 等固定磁盘的容量、Top 目录、文件类型、大文件、空目录、junction。
- **真实占用**：识别 OneDrive/iCloud 占位文件，区分逻辑大小与实际本地占用。
- **分级清理**：`safe` / `elevated` / `confirm` / `review`，默认 dry-run。
- **迁移建议**：Anaconda、WSL、Docker、GitHub、CUDA、SDK、游戏库。
- **重复文件**：大小分组 + SHA-256，移动到隔离区并生成 manifest。
- **照片整理**：按 `YYYY\YYYY-MM_事件` 归类，保留原始文件名。
- **6 个 AI Skill**：盘点、清理、照片、文档、去重、迁移。

## Quick start

```powershell
git clone https://github.com/jiuhew/pc-manager.git
cd pc-manager

pwsh -File pc-manager.ps1 scan -Drives C,D,E
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json
pwsh -File pc-manager.ps1 skills -Install
```

## Verified

- Windows 11 (10.0.26300), C/D/E full scan in **166 seconds**, about **1.58 million files**.
- OneDrive logical 269.8 GB / local 9.85 GB correctly separated.
- Photo organization: **1,499 moves, 0 failures**.
- `tests/validate.ps1` passes; GitHub Actions validation succeeds.

## Safety

- `scan` and `report` are read-only.
- `clean`, `dedupe`, and `organize` require `-Execute`.
- Duplicates go to quarantine, not deletion.
- System-critical paths are never targeted.

## Known limitations

- EXIF capture time is not read yet; photo organization uses file modification time.
- Drives are scanned sequentially; parallel scanning is planned.
- GitHub Release creation is manual (tag `v0.1.0` already exists).

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
