# Iteration log

Real-world lessons that shaped `pc-manager`.

## 2026-11-07 — C drive cleanup

- OneDrive showed 269.8 GB logical but only 9.1 GB local. **Cloud placeholders must be measured separately.**
- `C:\Users` appeared larger than the whole drive because of placeholders and junctions.
- `WinSxS` was 23 GB by naive recursion, but hardlinks overcount. Use DISM, not manual deletion.
- Root-level CEF/Chromium leftovers and logs were safe to delete; root files needed admin.
- `powercfg -h off` frees `hiberfil.sys` but disables Fast Startup. User chose to keep it.
- `Set-AppxDefaultVolume` did not change the per-user Store location; the Settings page `ms-settings:savelocations` did.
- Do **not** change `ProgramFilesDir`; Microsoft does not support it.

## 2026-11-07 — Migration

- Anaconda, Docker WSL, GitHub, Downloads: move + junction works and preserves paths.
- WSL: `wsl --export` → `--unregister` → `--import`, then restore `[user] default` in `/etc/wsl.conf`.
- Docker: moving `%LOCALAPPDATA%\Docker\wsl` + junction keeps the WSL registry `BasePath` valid.
- Store apps: move via Settings; new content location via Settings.

## 2026-11-07 — PowerShell pitfalls

- `Rm`, `Del`, `Move`, `Copy` are aliases; helper functions with those names are shadowed.
- Deleting directories needs `-Recurse -Force -Confirm:$false`.
- PowerShell smart quotes in scripts cause parser errors.
- Uninstallers can be asynchronous: exit code 0 does not mean done. Check process/service/dir/registry.
- `Start-Process -Verb RunAs` + transcript log is the reliable elevation pattern.

## 2026-11-07 — D/E inventory

- D: 197.7 GB Steam (`BlackMythWukong` 139.6 + `ItTakesTwo` 44.8), 22.1 GB Anaconda, 21.0 GB WSL, 16.9 GB Docker, 10.6 GB GitHub.
- E: 201.5 GB photos, including a single **90.5 GB `新疆.zip`** (229 MP4, 371 ARW, 715 JPG, 97 RAF, 46 DNG).
- E recycle bin held **18 GB**; Youku cache 20.7 GB; Xunlei `.ts`/`.xltd` caches 11.9 GB; iQiyi cache 6 GB; Delivery Optimization 4.8 GB; old Adobe installers 7.4 GB.
- Photo folder naming was mixed: `dji`, `杂`, `2026_nv_party`, `merry_chrismas_1226`, `日本`, `年会`, `nvidia walking`, `婚假`.
- `杂` had 1,481 files; split by basename group + file month into `YYYY\YYYY-MM_未分类`.
- Same-name CR3 files across folders were **not** duplicates (camera counter reuse).
- Only one hash-confirmed duplicate (6.8 MB); do not over-promise dedupe savings.
- Photo organization moved 1,499 items with zero failures; manifest + README generated.

## 2026-11-07 — v0.1.1

- `-Fast` excludes `WinSxS`, `Windows\Installer`, `SoftwareDistribution`, and `Package Cache`: C scan 132s -> 96s.
- Parallel C/D/E on the same physical disk showed I/O contention (one run 290s vs 166s sequential, another sequential run 391s under load). Timing is load-dependent; made `-Parallel` opt-in and kept sequential as the default.
- EXIF `DateTimeOriginal` works for JPEG/TIFF via `System.Drawing`; HEIC/CR3/RAW use ExifTool when available.
- HTML report gained bar charts for top folders and file types.
- Version bumped to 0.1.1.

## 2026-11-07 — v0.2.0

- Local GUI: zero-dependency Node.js 22+ server, local-only binding, preview -> confirm -> execute, live job logs, cancel, and admin relaunch.
- Storage strategy + audit: health score, capacity budget, tier plan, P0/P1/P2 findings, and path/media/download/workspace checks.
- Safe cleanup: per-item selection, protected-path checks, recycle-bin handling, per-item manifests; locked files are skipped instead of forced.
- Media: 5,117 photos / 67.18 GB and 306 videos / 57.65 GB archived with zero failures; `-DateResolver` supports per-file date overrides.
- Download triage: 14.84 GB reduced to 0.08 MB; 3.34 GB archived, 3.26 GB Thunder cache deleted, 8.24 GB HLS moved; zero failures.
- Cache cleanup: 459 MB reclaimed; `WebCache` and Explorer thumbnail caches were skipped because `dllhost`/`explorer` held them open.
- Version bumped to 0.2.0.

## 2026-11-07 — v0.2.1

- App insights `updatesMatched` now counts apps with an available update, aligning with the Apps page badges.
- Documented the Apps overview cards, filters, icon-only uninstall, and `/api/apps/insights/:id`.
- Version bumped to 0.2.1.

## 2026-11-07 — v0.2.2

- AI suggestions now read the drive topology first: system drive, data drives, free space, and single-drive vs multi-drive.
- Single-drive machines: no cross-drive migration; media goes to `%USERPROFILE%\Videos` and `Pictures`.
- Migration candidates are generated only for real data drives with enough free space.
- Updated `storage-strategy`, `photo-organizer`, and `app-migration` skills plus `docs/storage-strategy.md`.
- Version bumped to 0.2.2.

## 2026-11-07 — v0.3.0

- Apps table gained selection checkboxes, select-all, bulk winget updates, and bulk uninstall via each app's own uninstaller.
- App updates now enforce a timeout, kill the winget process tree, verify the installed version, and support an interactive mode for UAC/setup-wizard installers.
- Tencent Meeting and QQ pass their `/S` switch through `winget --override` to avoid GUI installers hanging the update job.
- Removed the top topbar, moved clean filters into table headers, and simplified the Apps panel header.
- Version bumped to 0.3.0.

## 2026-11-07 - v0.3.1

- Added `pc-manager empty-dirs` with `cache` and `all-cache` batches: dry-run by default, re-checks emptiness before deletion, skips reparse/cloud/protected paths, and writes CSV preview/manifest plus summary JSON.
- Kept the single-drive media and migration fixes: in-place organization, already-organized files are skipped instead of duplicated, and media roots are derived from scanned files when `MediaFolders` is empty.
- Version bumped to 0.3.1.

## Tool improvements

- Added cloud placeholder handling (`0x400000`, `0x1000`, `0x100000`).
- Added junction detection (`ReparsePoint` + no cloud flags).
- Added safety levels and dry-run defaults.
- Added quarantine for duplicates.
- Added photo year/month organizer with manifest.
- Added AI skill library and validation script.
