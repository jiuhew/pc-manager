# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-11-07

### Fixed

- App insights `updatesMatched` now counts apps with an available update, matching the Apps page badges instead of subtracting unmatched winget entries.

### Changed

- Documented the Apps overview cards, icon-only uninstall action, app filters, and the `/api/apps/insights/:id` endpoint.
- Version bumped to 0.2.1.

## [0.2.0] - 2026-11-07

### Added

- Local web GUI (`gui/`) built with Node.js built-in modules only: overview, drives, apps, migration, and diagnostics views; new scans; live job logs over SSE.
- Per-item cleanup selection with a mandatory preview -> confirm -> execute flow, administrator awareness, and `reports/clean/<timestamp>/manifest.csv`.
- `Invoke-PcCleanSelection` with protected-path checks (`WinSxS`, `Windows\Installer`, `Package Cache`, pagefile/hiberfil), recycle-bin detection, and structured per-item results.
- `scripts/start-gui.ps1` launcher, including `-Admin` relaunch.
- Node test suite for path safety, scan compaction, AI planning, and HTTP API; PowerShell smoke tests for guarded cleanup and media organizing.
- Multi-drive selection in the GUI: `/api/drives` lists fixed drives, and new scans default to all detected drives.
- App uninstall from the Apps view: confirms first, re-reads the registry entry, and runs the app's own uninstaller.
- AI suggestions tab with editable, copyable task instructions for media archiving, safe/confirm cleanup, and migration; users can hand the text to an AI agent. The read-only preview/execute API remains available.
- Single-page shell with a left navigation sidebar for current and future tools (system analysis, etc.), compact overview, icon actions, and a custom scan picker.
- Top job progress bar replacing the side drawer; click it to see live logs, per-item progress, and cancel.
- New Overview page: health score ring, CPU/memory/GPU/motherboard/physical disk details, storage allocation, top consumers, and audit findings. The old inline overview and the separate Migration/Diagnostics tabs were removed; migration advice lives in AI suggestions.
- `/api/system` hardware endpoint (CIM + nvidia-smi VRAM fallback), system-info cache, and responsive small-card layout.
- New monitor + AI sparkle brand logo, favicon, and the "AI 系统清理" slogan.
- AI suggestion cards can be ignored per scan (persisted in localStorage) and restored later.
- The old "重新分析" action is now "复制分析提示词": it copies a complete agent prompt using the current scan and audit instead of re-running the local planner.
- Apps page overview: installed/update/suggested-uninstall/usage-record cards, automatic `winget upgrade` checks, per-app update versions, and last-used estimates from Prefetch/UserAssist.
- Icon-only uninstall action and app filters for all / update available / suggested uninstall.
- Removed the meaningless AI prompt "reset" button; edits can still be changed directly in the textarea.
- Clickable permission chip next to the sidebar title with an admin/standard mode menu and an `/api/relaunch` action for requesting elevation.
- `Invoke-OrganizeMedia`: archive photos/videos by `YYYY\YYYY-MM` with collision handling and CSV manifest.
- `Invoke-OrganizeMedia` accepts an optional `-DateResolver` scriptblock so callers can override the archive date per file, for example to use an event folder date when EXIF is known to be wrong.
- `Invoke-Organize` now returns structured results and writes a manifest when moving a directory + junction.
- Repository-level storage strategy: `docs/storage-strategy.md` with capacity budgets, tiering, directory conventions, repo/workspace rules, lifecycle, path hygiene, and P0/P1/P2 thresholds.
- `audit` command and `lib/Strategy.ps1`: health score, drive roles, capacity/workload summary, findings, tier plan, and top consumers from a scan.
- `storage-strategy` skill for agent-driven space analysis, plus a machine-specific analysis in `docs/analysis/`.
- Scans now include an `Audit` object; GUI AI suggestions read audit findings and generate "storage strategy" cards.
- Large archive, download root, workspace, hibernation file, and media-organization checks in the audit.
- Media AI plans no longer apply the global photo/video total to a fallback folder. Generic media roots and fallback folders are labeled "待预览"; the real file count/size is measured by the read-only preview.
- `scripts/consolidate-downloads.ps1`: dry-run-first download-root consolidation with per-file moves, collision handling, and per-file manifest. Same-volume and cross-volume sources are supported; locked files are reported instead of aborting the whole folder.

### Fixed

- `-Exclude` values passed through `pwsh -File` are normalized as comma-separated lists.

### Changed

- `clean` now uses the shared selection engine and writes a CSV manifest; dry-run output includes preview status per item.
- AI suggestions are grouped into three fixed categories: 媒体文件建议 (media), 工程文件建议 (engineering), and 缓存管理文件建议 (cache). The GUI shows one section per category, and the `storage-strategy` skill requires the same grouping.
- Version bumped to 0.2.0.

## [0.1.2] - 2026-11-07

### Added

- Integrated windows-c-drive-cleanup features: junk candidate catalog, initial `clean` command integration, and orphan detection.

### Fixed

- Restored the truncated `lib/Core.ps1`, which was missing `Get-FixedDrives`, `Get-DirSizeMB`, `Read-PcConfig`, and other helpers.
- `pc-manager version` now reports the version (`0.1.2`).

## [0.1.1] - 2026-11-07

### Added

- Photo organizer reads EXIF `DateTimeOriginal` (0x9003) for JPEG/TIFF and falls back to the file timestamp; use `-NoExif` to disable.
- Optional ExifTool support for HEIC, CR3, ARW, DNG, NEF, RAF and other RAW formats.
- `-Fast` mode excludes `WinSxS`, `Windows\Installer`, `SoftwareDistribution`, and `Package Cache` (C: scan 132s -> 96s on the test machine).
- `-Exclude` for custom scan exclusions.
- Opt-in `-Parallel` scanning for drives on different physical disks.
- HTML report bar charts for top folders and file types.

### Changed

- Default scan remains sequential; `-Parallel` only helps when drives are on different physical disks. When they share a disk, I/O contention can reduce or negate the benefit.
- Version bumped to 0.1.1.

## [0.1.0] - 2026-11-07

### Added

- `pc-manager scan`: full and fast inventory of all fixed Windows drives.
- Markdown and HTML reports with disk overview, top folders, file types, cloud placeholders, junk candidates, migration candidates, media inventory, orphans, and recommendations.
- `pc-manager clean`: safety-graded cleanup (`safe`, `elevated`, `confirm`, `review`) with dry-run by default.
- `pc-manager organize`: directory move + junction, and year/month photo organizer with manifest.
- `pc-manager dedupe`: size grouping + SHA-256, quarantine instead of deletion, CSV manifest.
- Six AI skills: `pc-inventory`, `disk-cleanup`, `photo-organizer`, `document-organizer`, `duplicate-finder`, `app-migration`.
- Cloud placeholder detection (`0x400000`, `0x1000`, `0x100000`), junction detection, and local-vs-logical size reporting.
- Documentation: report schema, naming conventions, safety rules, iteration log.
- GitHub Actions validation workflow.

### Changed

- README uses a centered title, description, badges, and table of contents.

### Fixed

- `-Input` parameter conflicted with PowerShell's automatic `$Input` variable; renamed to `-ScanPath`.
- `StringBuilder.Append` return values leaked into reports, producing `System.Object[]` and duplicated content.
- Protected paths could throw from `Test-Path`; all checks now use `-ErrorAction SilentlyContinue`.
- `-Drives C,D,E` was parsed as a single string; comma and space separated drives are supported.
- Migration candidates no longer suggest directories that are already junctions.
- Duplicate `%TEMP%` and `%LOCALAPPDATA%\Temp` entries are deduplicated.
- Photo organizer skips already-organized `YYYY` and `YYYY-MM_*` directories.

[Unreleased]: https://github.com/jiuhew/pc-manager/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/jiuhew/pc-manager/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/jiuhew/pc-manager/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/jiuhew/pc-manager/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jiuhew/pc-manager/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jiuhew/pc-manager/releases/tag/v0.1.0
