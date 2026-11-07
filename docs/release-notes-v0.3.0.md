# pc-manager v0.3.0

Apps 批量更新/卸载、交互模式与界面整理。

## Highlights

- **批量应用管理**：Apps 表格支持勾选、全选、批量通过 winget 更新、批量调用应用自带卸载器卸载；批量操作统一在上方执行，并保留逐项结果。
- **更新可靠性**：更新任务增加超时、winget 进程树终止、安装后版本校验和明确的失败原因，不再静默卡住。
- **交互模式**：QQ、腾讯会议等需要 UAC 或安装向导的应用可用交互模式更新；腾讯会议和 QQ 会通过 `winget --override` 传递 `/S` 静默开关。
- **界面整理**：移除顶部 topbar，扫描历史、刷新和新扫描操作集中到清理页；清理筛选移到表头；Apps 面板标题、筛选、搜索和刷新合并到一行。
- **新增 API**：`/api/apps/update` 和 `/api/apps/uninstall-batch`，均要求显式确认；单应用卸载仍保留。

## Verified

- Node 测试：32 / 32 通过，包含批量更新/卸载、路径安全和服务器端点测试。
- `tests\validate.ps1`：通过。
- `tests\smoke-features.ps1`：通过。
- PowerShell `pc-manager version`：`0.3.0`。

## Notes

- 批量更新依赖 `winget`；需要管理员权限或安装向导的应用请使用交互模式。
- 批量卸载仍会重新读取注册表条目并调用应用自带卸载器，不直接删除安装目录。
- 无破坏性变更；单应用更新/卸载和现有 CLI 保持兼容。

**Full changelog:** [CHANGELOG.md](https://github.com/jiuhew/pc-manager/blob/main/CHANGELOG.md)
