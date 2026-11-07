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

## Tool improvements

- Added cloud placeholder handling (`0x400000`, `0x1000`, `0x100000`).
- Added junction detection (`ReparsePoint` + no cloud flags).
- Added safety levels and dry-run defaults.
- Added quarantine for duplicates.
- Added photo year/month organizer with manifest.
- Added AI skill library and validation script.
