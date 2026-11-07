# pc-manager v0.2.0

GUI 控制台、存储策略审计、安全清理与媒体整理。

## Highlights

- **本地 Web GUI（零依赖）**：只用 Node.js 内置模块，提供概览、磁盘、应用、清理和 AI 建议页面；支持新扫描、多盘选择、实时任务进度与取消。默认地址 `http://127.0.0.1:7788/`，只监听本机。
- **存储策略与审计**：新增 `docs/storage-strategy.md`、`audit` 命令和 `storage-strategy` skill。输出健康分、容量预算、P0/P1/P2 发现、分层计划和 Top 占用。
- **安全清理引擎**：清理项按 `safe` / `elevated` / `confirm` / `review` 分级，强制“预览 → 确认 → 执行”，受保护路径校验，逐项结果与 CSV manifest。GUI 只能操作当前 scan JSON 中的 `Junk` 列表。
- **媒体整理**：`Invoke-OrganizeMedia` 支持照片/视频按 `YYYY\YYYY-MM` 归档、重名加序号、manifest；新增 `-DateResolver` 可按文件覆盖日期。`scripts/consolidate-downloads.ps1` 支持下载根目录的 dry-run 整合。
- **AI 建议**：固定按媒体文件、工程文件、缓存管理三类生成可编辑、可复制的任务指令；不再直接执行移动/清理。
- **GUI 运维能力**：应用卸载会重新读取注册表条目后调用自带卸载器；支持管理员重启；扫描/清理任务可取消；所有执行写入 `reports/clean/<timestamp>/manifest.csv`。

## Quick start

```powershell
pwsh -File pc-manager.ps1 scan -Drives C,D,E
pwsh -File pc-manager.ps1 report -ScanPath reports\scan-<timestamp>.json -Format html
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json
pwsh -File scripts\start-gui.ps1
```

GUI 需要 Node.js 22+，无需 `npm install`。需要清理系统缓存时，以管理员身份启动：

```powershell
pwsh -File scripts\start-gui.ps1 -Admin
```

## Verified

- Full C/D/E scan: ~1.58 million files; ~166 seconds on an idle run, 3–6 minutes under load. Fast C: ~96 seconds.
- Media archive: 5,117 photos / 67.18 GB and 306 videos / 57.65 GB moved with zero failures; photo manifests and folder convention generated.
- Download triage: 14.84 GB reduced to 0.08 MB; 3.34 GB archived, 3.26 GB Thunder cache deleted, 8.24 GB HLS moved to the media library; zero failures.
- Safe cache cleanup: 459 MB reclaimed; locked `WebCache` and Explorer thumbnail caches were skipped and reported instead of forced.
- `tests/validate.ps1`, the PowerShell smoke tests, and the Node test suite pass.

## Notes

- The GUI is local-only. Do not expose it to untrusted networks without authentication and TLS.
- `clean`, `organize`, and `dedupe` remain dry-run by default; destructive actions require explicit confirmation and `-Execute`.
- Elevated cleanup items require an administrator session; otherwise they are skipped with a clear message.
- HLS downloads are kept as `.ts` segments plus `index.m3u8`; play them with VLC or merge with ffmpeg (not bundled).
- `Invoke-OrganizeMedia -DateResolver` is optional; default behavior is unchanged.
- No breaking changes from v0.1.x.

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
