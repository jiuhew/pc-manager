---
name: PC Inventory
description: 当用户要求分析 Windows 电脑的磁盘占用、所有盘的文件分布、哪些文件占空间、生成磁盘报告时使用。运行 pc-manager scan，读取 JSON/Markdown 报告并给出结论。
---

# PC Inventory

## 工作流

1. 运行扫描（只读）：

```powershell
pwsh -File pc-manager.ps1 scan -Drives C,D,E
```

2. 读取生成的文件：
   - `reports/scan-<timestamp>.json`：完整结构化数据
   - `reports/scan-<timestamp>.md`：人类可读报告

3. 汇报顺序：
   - 每个盘的总量、已用、可用、可用率
   - Top 目录（按大小）
   - 文件类型（照片/视频/文档/压缩包/安装包/开发）
   - 云占位文件（逻辑大小 vs 实际本地）
   - 大文件
   - 孤立卸载项/失效启动项
   - 可清理和可迁移建议

## 规则

- `scan` / `report` 是只读操作，不要直接删除。
- 区分**逻辑大小**和**实际占用**：
  - OneDrive/iCloud 占位文件显示很大，本地可能接近 0。
  - `WinSxS` 硬链接会被普通统计重复计算。
  - junction 会跟随到其他盘。
- 不要把云占位文件列为"可迁移"。
- 报告里的 `Junk`、`Migration`、`Media`、`Recommendations` 已经由分类器生成，可直接引用。

## 快速模式

```powershell
pwsh -File pc-manager.ps1 scan -Drives C,D,E -Fast
```

`-Fast` 只统计顶层目录，不做扩展名和大文件扫描，适合快速摸底。
