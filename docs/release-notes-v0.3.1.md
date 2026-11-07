# pc-manager v0.3.1

空目录清理、媒体整理修复与单盘建议。

## Highlights

- **空目录清理**：新增 `pc-manager empty-dirs`，支持 `-Batch cache` 和 `-Batch all-cache`。默认 dry-run，执行前重新确认目录为空，只处理 `%USERPROFILE%\AppData` 下的缓存、临时和日志空目录。
- **安全边界**：跳过受保护路径、reparse point、云占位、`Packages`、微信、OneDrive 和 `.git`；只做非递归删除；预览和执行都会生成 CSV 与 summary。
- **原地整理**：`Invoke-OrganizeMedia` 支持 `-Source` 等于 `-Destination`，已在 `YYYY\YYYY-MM` 的文件会跳过，而不是生成 `_1` 副本。
- **单盘感知**：AI 媒体计划在 `MediaFolders` 为空时从扫描到的大文件推导媒体根目录；单盘机器的迁移候选以 `external/compact` 建议展示。
- **审计文案**：工作区建议不再硬编码 `D:\Work`。

## Verified

- `tests\validate.ps1`：通过。
- `empty-dirs -Batch all-cache` dry-run：516 个候选，3 个跳过，0 个失败。
- Node 测试：31 / 31 通过。
- `pc-manager version`：`0.3.1`。

## Notes

- `empty-dirs` 是 CLI 功能，GUI 暂无入口。
- 只删除空目录，且执行时再次检查；不会删除非空目录。
- 受保护路径、云占位、junction / reparse point 一律跳过。

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
