# pc-manager v0.2.1

v0.2.0 的小型后续版本，集中修复 App insights 统计并补齐文档。

## Fixed

- App insights 的 `updatesMatched` 现在直接统计有可用更新的应用数量，与 Apps 页面徽标一致；不再使用 `updates.length - unmatchedUpdates.length` 的近似计算。

## Docs

- 补充 Apps 概览卡片：已安装/可更新/建议卸载/使用记录。
- 补充 `winget` 更新检查、按 Prefetch/UserAssist 估算上次使用时间。
- 补充图标化卸载操作、应用筛选（全部/可更新/建议卸载）和 `/api/apps/insights/:id` 端点。

## Notes

- 无破坏性变更；PowerShell 验证、smoke tests 和 Node 测试均通过。
- 继续使用 v0.2.0 的 GUI、审计、清理和媒体整理能力即可。

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
