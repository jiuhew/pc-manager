<p align="center">
  <a href="https://github.com/jiuhew/pc-manager/stargazers"><img src="https://img.shields.io/github/stars/jiuhew/pc-manager?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/jiuhew/pc-manager/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="MIT License"></a>
  <a href="https://github.com/jiuhew/pc-manager/tags"><img src="https://img.shields.io/github/v/tag/jiuhew/pc-manager?label=tag&color=1a73e8" alt="Latest tag"></a>
  <a href="https://github.com/jiuhew/pc-manager/actions/workflows/validate.yml"><img src="https://img.shields.io/github/actions/workflow/status/jiuhew/pc-manager/validate.yml?label=validate" alt="Validate"></a>
  <br>
  <a href="https://github.com/jiuhew/pc-manager"><img src="https://img.shields.io/badge/PowerShell-%3E%3D7-5391FE?logo=powershell&logoColor=fff" alt="PowerShell 7+"></a>
  <a href="https://github.com/jiuhew/pc-manager"><img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=fff" alt="Windows"></a>
  <a href="https://github.com/jiuhew/pc-manager/tree/main/skills"><img src="https://img.shields.io/badge/AI%20Skills-6-8B5CF6" alt="AI Skills"></a>
  <a href="https://github.com/jiuhew/pc-manager"><img src="https://img.shields.io/badge/scan-C%3A%20D%3A%20E-success" alt="Scan C D E"></a>
</p>

# pc-manager

快速分析 Windows 电脑的所有磁盘，生成结构化清单，并配套 **AI Skill 库** 做文件分类、清理、迁移和照片整理。

> 核心原则：**先只读分析，再让用户确认，最后才执行。** 默认 dry-run，只有 `-Execute` 才会真正删除或移动。

## 已验证

- Windows 11（10.0.26300），C/D/E 三盘全量扫描约 **166 秒**，约 **158 万文件**。
- `scan` / `report`（Markdown + HTML）/ `clean` dry-run / `dedupe` 隔离 / `organize` 移动+junction / 照片整理 dry-run 均已自测通过。
- 真实验证过：OneDrive 占位识别、junction 跳过、回收站清理、迅雷/优酷/爱奇艺缓存、旧安装包、照片按年月归类（1,499 项移动，0 失败）。

## 特性

- **全盘扫描**：C/D/E 等固定磁盘的容量、Top 目录、文件类型、大文件、空目录、junction。
- **云占位识别**：OneDrive / iCloud 的逻辑大小 vs 实际本地占用，避免误报。
- **垃圾分级**：`safe` / `elevated` / `confirm` / `review`，区分用户缓存、系统缓存、回收站、旧安装包、孤立残留。
- **迁移建议**：Anaconda、WSL、Docker、GitHub、CUDA、SDK、游戏库等。
- **重复文件检测**：大小分组 + SHA-256，重复项移动到隔离区，不直接删除。
- **照片整理**：按 `YYYY\YYYY-MM_事件` 归类，保留原始文件名，生成 manifest。
- **AI Skill 库**：扫描、清理、照片、文档、去重、迁移 6 个 skill，可直接安装到 OpenCode。
- **纯 PowerShell**：Windows 原生，无需 Python/Node 运行时。

## 快速开始

```powershell
# 1. 全盘扫描（只读）
pwsh -File pc-manager.ps1 scan -Drives C,D,E

# 2. 快速模式（只统计顶层目录）
pwsh -File pc-manager.ps1 scan -Drives C,D,E -Fast

# 3. 查看可清理项（dry-run）
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json

# 4. 确认后清理
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json -Execute

# 5. 安装 AI skills
pwsh -File pc-manager.ps1 skills -Install
```

扫描输出：

```
reports/scan-20261107-130000.json   # 完整结构化数据
reports/scan-20261107-130000.md     # 人类可读报告
```

## 命令

| 命令 | 作用 | 是否写盘 |
|---|---|---|
| `scan` | 扫描磁盘并生成 JSON/Markdown 报告 | 只写 reports/ |
| `report` | 从已有 JSON 重新生成报告 | 只写报告 |
| `clean` | 清理缓存/回收站/旧安装包 | 仅 `-Execute` |
| `organize` | 目录迁移 + junction，或照片年月整理 | 仅 `-Execute` |
| `dedupe` | 查找重复文件并移动到隔离区 | 仅 `-Execute` |
| `skills` | 列出/安装 AI skills | 仅 `-Install` |
| `version` | 版本号 | 否 |

### scan

```powershell
pwsh -File pc-manager.ps1 scan [-Drives C,D,E] [-Fast] [-Output reports] [-Json]
```

- `-Drives`：默认所有固定磁盘。
- `-Fast`：只统计顶层目录，不做扩展名/大文件/空目录扫描。
- `-Json`：同时把 JSON 输出到控制台。

### clean

```powershell
pwsh -File pc-manager.ps1 clean [-ScanPath scan.json] [-Category cache|system|installer|recycle|orphan] [-Execute] [-Admin]
```

- 不传 `-ScanPath` 时会先做一次快速扫描。
- `elevated` 项需要管理员 PowerShell。
- `recycle` 项使用 `Clear-RecycleBin`。

### organize

```powershell
# 迁移目录并保留原路径
pwsh -File pc-manager.ps1 organize -Source C:\path\app -Destination D:\path\app [-Execute]

# 照片/资料按年月整理
pwsh -File pc-manager.ps1 organize -Source E:\Photos [-Execute]
```

### dedupe

```powershell
pwsh -File pc-manager.ps1 dedupe -Source E:\Photos [-Execute] [-KeepDuplicates]
```

重复项移动到：

```
D:\Backup\duplicates\<timestamp>\
```

并生成 `manifest.csv`。

## AI Skill 库

`skills/` 下包含：

| Skill ID | 用途 |
|---|---|
| `pc-inventory` | 全盘盘点、读报告、总结 |
| `disk-cleanup` | 分级清理缓存/回收站/旧安装包 |
| `photo-organizer` | 照片/视频按年月/事件整理、命名规范 |
| `document-organizer` | PDF/PPT/课程资料/电子书整理 |
| `duplicate-finder` | 重复文件检测与隔离 |
| `app-migration` | Anaconda/WSL/Docker/游戏迁移 |

安装到 OpenCode 全局 skill 目录：

```powershell
pwsh -File pc-manager.ps1 skills -Install
# 或
pwsh -File scripts\install-skills.ps1
```

安装位置：`%USERPROFILE%\.config\opencode\skills\`。

## 输出结构

```json
{
  "SchemaVersion": 1,
  "GeneratedAt": "2026-11-07T13:00:00",
  "Computer": "PC",
  "OS": "Microsoft Windows NT ...",
  "FastMode": false,
  "ScanSeconds": 42.1,
  "Drives": [
    {
      "Id": "C:",
      "TotalGB": 506.6,
      "FreeGB": 200.0,
      "UsedGB": 306.6,
      "TotalFiles": 123456,
      "TopFolders": [{"Name": "Users", "SizeGB": 100.0, "Files": 50000}],
      "Extensions": [{"Ext": ".mp4", "Kind": "video", "Count": 100, "SizeGB": 20.0}],
      "LargeFiles": [{"Path": "...", "SizeMB": 800, "Modified": "..."}],
      "EmptyDirs": ["..."],
      "ReparsePoints": ["..."],
      "Cloud": [{"Path": "...OneDrive", "LogicalGB": 269.8, "LocalGB": 9.5, "Files": 81054}]
    }
  ],
  "InstalledApps": [],
  "Orphans": {"UninstallEntries": [], "RunKeys": [], "AppxData": []},
  "Junk": [],
  "Migration": [],
  "Media": {},
  "Recommendations": []
}
```

完整字段说明见 [docs/report-schema.md](docs/report-schema.md)。

## 架构

```
pc-manager.ps1           CLI 入口
lib/
  Core.ps1               通用工具、云占位、安装应用、孤立项
  Inventory.ps1          磁盘扫描器
  Classify.ps1           垃圾/迁移/媒体分类与建议
  Report.ps1             Markdown/HTML 报告
  Clean.ps1              清理与去重
  Organize.ps1           目录迁移、照片整理
  Skills.ps1             skill 安装
skills/                  AI Skill 库
config/default.json      阈值配置
docs/                    规范、schema、安全、迭代日志
scripts/install-skills.ps1
tests/validate.ps1       语法/结构校验
```

## 安全

- `scan` / `report` 只读。
- `clean` / `dedupe` / `organize` 默认 dry-run，只有 `-Execute` 执行。
- 不直接删除 `WinSxS`、`Windows\Installer`、`Package Cache`、pagefile、hiberfil。
- 用户数据（照片、聊天、草稿、数据库）只移动/备份，不删除。
- 重复文件移动到隔离区，保留 manifest。
- 系统项需要管理员权限。

详见 [docs/safety.md](docs/safety.md)。

## 实践迭代

这个项目来自真实机器的清理实践，记录了 OneDrive 占位、WinSxS 硬链接、junction、PowerShell 别名坑、异步卸载器、照片压缩包、回收站、优酷/迅雷缓存等经验。

见 [docs/iteration-log.md](docs/iteration-log.md)。

## Roadmap

- [ ] HTML 报告增加图表（目录树/类型占比）
- [ ] 扫描结果增量缓存
- [ ] 规则引擎配置化（YAML/JSON）
- [ ] 多盘并行扫描
- [ ] EXIF 读取（照片按拍摄时间归档）
- [ ] Linux/macOS 支持

## License

MIT
