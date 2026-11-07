# pc-manager v0.2.2

AI 建议先分析机器拓扑，再决定是否迁移和媒体目标。

## Highlights

- **先看盘再建议**：AI 建议读取系统盘、数据盘、空闲空间和单盘/多盘状态，不再假设一定存在 `D:`/`E:`。
- **单盘机器**：不生成跨盘迁移；照片进 `%USERPROFILE%\Pictures`，视频进 `%USERPROFILE%\Videos`，不再生成不存在的 `D:\Media` 目标。
- **多盘机器**：只向真实存在且空闲足够的数据盘提迁移；空间不足时跳过，不再生成不可执行的目标。
- **避免空操作**：源目录已经是用户 `Videos`/`Pictures` 时，不再生成“移动到自己”的媒体计划。
- **审计适配**：单盘媒体改为 P2 `media-system-single`，建议整理到用户媒体目录；只有存在数据盘时才使用 P1 “媒体在系统盘”建议。
- **Skills 同步**：`storage-strategy`、`photo-organizer`、`app-migration` 和 `docs/storage-strategy.md` 都补充了单盘规则。

## Verified

- Node 测试：29 / 29 通过，覆盖单盘媒体目标、单盘无迁移、目标盘缺失/空间不足、用户目录子路径等场景。
- `tests\validate.ps1`：通过。
- `tests\smoke-features.ps1`：通过，包含单盘迁移候选为空的断言。
- PowerShell `pc-manager version`：`0.2.2`。

## Notes

- 无破坏性变更；现有 CLI 和 GUI API 保持兼容。
- 单盘机器仍可整理媒体，只是目标改为用户目录，不再建议换盘。
- 多盘迁移建议会校验目标盘是否存在于扫描结果中，并要求目标空闲空间不小于迁移体积。

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
