---
name: Disk Cleanup
description: 当用户要清理磁盘垃圾、缓存、旧安装包、回收站、孤立残留时使用。基于 pc-manager scan 的 Junk 列表，按 safe/elevated/confirm 分级，默认 dry-run，确认后执行。
---

# Disk Cleanup

## 工作流

1. 扫描并生成候选：

```powershell
pwsh -File pc-manager.ps1 scan -Drives C,D,E
```

2. 预览（不删除）：

```powershell
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json
```

3. 按类别预览：

```powershell
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json -Category cache
```

4. 用户确认后执行：

```powershell
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json -Execute
```

5. 系统项需要管理员 PowerShell：

```powershell
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json -Execute -Admin
```

## 安全分级

| Safety | 含义 | 处理 |
|---|---|---|
| `safe` | 用户缓存/更新包，可再生 | 可直接清 |
| `elevated` | `$WinREAgent`、Windows 更新缓存、日志 | 管理员执行 |
| `confirm` | 回收站、旧安装包、孤立数据 | 必须让用户确认 |
| `review` | 孤立注册表项 | 只报告，不自动删 |

## 绝对不要删

- `C:\Windows\WinSxS`（用 DISM）
- `C:\Windows\Installer`（用 PatchCleaner）
- `C:\ProgramData\Package Cache`
- `pagefile.sys`、`hiberfil.sys`、`swapfile.sys`
- 用户文档、聊天记录、草稿、数据库、照片原片
- 正在运行程序的安装目录

## 执行原则

- 默认 dry-run，只有 `-Execute` 才真正删除。
- 每步记录 before/after 可用空间。
- 删除前确认没有进程占用。
- 不确定的先备份或移动到隔离区。
- 卸载器可能是异步的：退出码 0 不代表完成，要检查进程/服务/目录/注册表。
