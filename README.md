<h1 align="center">pc-manager</h1>

<p align="center">
  快速分析 Windows 电脑的所有磁盘，生成结构化清单，并配套 <b>AI Skill 库</b> 做文件分类、清理、迁移和照片整理。
</p>

<p align="center">
  <a href="https://github.com/jiuhew/pc-manager/stargazers"><img src="https://img.shields.io/github/stars/jiuhew/pc-manager?logo=github&label=Stars" alt="GitHub stars"></a>
  <a href="https://github.com/jiuhew/pc-manager/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat" alt="MIT License"></a>
  <a href="https://github.com/jiuhew/pc-manager/tags"><img src="https://img.shields.io/github/v/tag/jiuhew/pc-manager?label=tag&color=1a73e8" alt="Latest tag"></a>
  <a href="https://github.com/jiuhew/pc-manager/actions/workflows/validate.yml"><img src="https://img.shields.io/github/actions/workflow/status/jiuhew/pc-manager/validate.yml?label=validate" alt="Validate"></a>
  <br>
  <a href="https://github.com/jiuhew/pc-manager"><img src="https://img.shields.io/badge/PowerShell-%3E%3D7-5391FE?logo=powershell&logoColor=fff" alt="PowerShell 7+"></a>
  <a href="https://github.com/jiuhew/pc-manager"><img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=fff" alt="Windows"></a>
  <a href="https://github.com/jiuhew/pc-manager/tree/main/skills"><img src="https://img.shields.io/badge/AI%20Skills-7-8B5CF6" alt="AI Skills"></a>
  <a href="https://github.com/jiuhew/pc-manager"><img src="https://img.shields.io/badge/scan-C%3A%20D%3A%20E-success" alt="Scan C D E"></a>
</p>

> 核心原则：**先只读分析，再让用户确认，最后才执行。** 默认 dry-run，只有 `-Execute` 才会真正删除或移动。

## 目录

- [已验证](#已验证)
- [特性](#特性)
- [快速开始](#快速开始)
- [GUI 控制台](#gui-控制台)
- [存储策略与审计](#存储策略与审计)
- [命令](#命令)
- [AI Skill 库](#ai-skill-库)
- [输出结构](#输出结构)
- [架构](#架构)
- [安全](#安全)
- [实践迭代](#实践迭代)
- [Roadmap](#roadmap)
- [贡献](#贡献)
- [安全](#安全)
- [更新日志](#更新日志)
- [License](#license)

## 已验证

- Windows 11（10.0.26300），C/D/E 三盘全量扫描约 **3–6 分钟**（受 OneDrive/索引/磁盘负载影响；空闲时约 166 秒），约 **158 万文件**；`-Fast` 模式 C 盘约 **96 秒**。
- `scan` / `report`（Markdown + HTML）/ `clean` dry-run / `dedupe` 隔离 / `organize` 移动+junction / 照片整理 dry-run 均已自测通过。
- 真实验证过：OneDrive 占位识别、junction 跳过、回收站清理、迅雷/优酷/爱奇艺缓存、旧安装包、照片按年月归类（1,499 项移动，0 失败）。

## 特性

- **全盘扫描**：C/D/E 等固定磁盘的容量、Top 目录、文件类型、大文件、空目录、junction。
- **云占位识别**：OneDrive / iCloud 的逻辑大小 vs 实际本地占用，避免误报。
- **垃圾分级**：`safe` / `elevated` / `confirm` / `review`，区分用户缓存、系统缓存、回收站、旧安装包、孤立残留。
- **迁移建议**：Anaconda、WSL、Docker、GitHub、CUDA、SDK、游戏库等。
- **重复文件检测**：大小分组 + SHA-256，重复项移动到隔离区，不直接删除。
- **快速模式**：`-Fast` 自动跳过 `WinSxS`、`Windows\Installer`、`SoftwareDistribution`、`Package Cache`，C 盘从 132s 降到 96s。
- **自定义排除**：`-Exclude` 指定不扫描的目录，适合大型游戏/备份目录。
- **可选并行**：`-Parallel` 多盘并行；不同物理磁盘时更快，同一物理磁盘会抢 I/O，收益有限甚至更慢，所以默认关闭。
- **照片整理**：优先读取 EXIF 拍摄时间，按 `YYYY\YYYY-MM_事件` 归类，保留原始文件名，生成 manifest。JPEG/TIFF 直接读取；HEIC/CR3/RAW 安装 ExifTool 后支持。
- **AI Skill 库**：扫描、清理、照片、文档、去重、迁移、存储策略 7 个 skill，可直接安装到 OpenCode。
- **存储策略审计**：内置通用容量预算、目录规范、仓库空间策略和 P0/P1/P2 健康评分；`audit` 输出机器级问题清单，GUI/AI 建议会读取审计结果。
- **本地 Web GUI**：Node.js 内置模块搭建，零 npm 依赖；支持多盘扫描、按项清理、应用卸载、AI 建议计划，先预览再确认执行，并生成 manifest。
- **核心纯 PowerShell**：扫描、分类、清理、迁移逻辑不需要额外运行时；GUI 是可选层（Node.js 22+，推荐 26）。

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

# 5. 空目录清理（默认 dry-run；Batch all-cache = 已知缓存根 + AppData 缓存/临时/日志）
pwsh -File pc-manager.ps1 empty-dirs -ScanPath reports\scan-<timestamp>.json -Batch all-cache
pwsh -File pc-manager.ps1 empty-dirs -ScanPath reports\scan-<timestamp>.json -Batch all-cache -Execute

# 6. 安装 AI skills
pwsh -File pc-manager.ps1 skills -Install
```

扫描输出：

```
reports/scan-20261107-130000.json   # 完整结构化数据
reports/scan-20261107-130000.md     # 人类可读报告
```

## GUI 控制台

不喜欢命令行表格的话，可以直接启动本地 Web 控制台：

```powershell
# 默认 http://127.0.0.1:7788/
node gui/server.mjs --open

# 或使用 PowerShell 启动器
pwsh -File scripts\start-gui.ps1

# 清理系统缓存需要管理员权限
pwsh -File scripts\start-gui.ps1 -Admin
```

GUI 读取 `reports/scan-*.json`，采用**左侧功能侧栏 + 右侧内容**的单页布局，为后续系统分析等功能预留入口。

- **多盘扫描**：新建扫描时列出本机所有固定磁盘（C/D/E…），默认全选，可单独取消；显示每个盘的空闲容量。
- **任务进度条**：扫描/预览/清理/归档/卸载开始后，顶部显示进度条；点击进度条打开详情（日志、逐项进度、取消任务），不再使用侧栏抽屉。
- **清理**：勾选项目（`review` 项不可选）→ **预览**（重新测量）→ **确认**（勾选确认框）→ 执行 → `reports/clean/<timestamp>/manifest.csv`。
- **应用卸载**：在“应用”页对单个应用点击卸载；服务端会重新读取注册表匹配卸载命令，调用应用自带卸载程序，不直接删除安装目录。
- **权限切换**：侧栏标题旁的权限徽标可点击，查看当前模式并请求以管理员身份重启。
- **AI 建议**：根据扫描结果生成可编辑、可复制的指令，例如“视频按年月归档到 E:\Media\Videos”“清理安全缓存”“迁移 CUDA”。每条建议都是一段 Markdown 指令，可以修改路径/规则后复制给 AI 助手执行；GUI 本身不会在 AI 页直接执行操作。

服务默认只绑定 `127.0.0.1`，只接受当前 scan 中存在的清理路径，并拒绝 `WinSxS`、`Windows\Installer`、`Package Cache`、pagefile 等受保护路径；AI 计划的源路径也必须属于当前扫描识别出的媒体目录或迁移候选。详细说明见 [gui/README.md](gui/README.md)。

## 存储策略与审计

通用存储策略见 **[docs/storage-strategy.md](docs/storage-strategy.md)**：

- 容量预算（系统盘 ≥15%/50GB，数据盘 ≥10%/20GB）
- Tier 0–3 分层（系统/活跃项目/媒体/归档）
- 单一 Work/Media/Archive/Download 根目录规范
- 代码仓库空间策略（数据集/构建产物/Git LFS/工作区合并）
- 文件生命周期（下载 7/30 天、安装包 30 天、归档 1 年）
- 路径卫生、云占位、junction、空目录、大文件、应用卸载
- P0/P1/P2 分级和健康评分

审计命令：

```powershell
# 人类可读报告（写到 reports/audit-<timestamp>.md）
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json [-Output docs\analysis\audit.md]

# 输出 JSON 给 agent
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json -Json
```

`scan` 会自动把 `Audit` 写入 JSON。GUI 的 AI 建议会读取 `Audit.Findings`，生成“空间策略”类可复制建议。

本机分析示例：[docs/analysis/storage-analysis-2026-11-07.md](docs/analysis/storage-analysis-2026-11-07.md)。

## 命令

| 命令 | 作用 | 是否写盘 |
|---|---|---|
| `scan` | 扫描磁盘并生成 JSON/Markdown 报告 | 只写 reports/ |
| `report` | 从已有 JSON 重新生成报告 | 只写报告 |
| `audit` | 按通用存储策略生成健康分、容量预算和路径问题 | 只写报告 |
| `clean` | 清理缓存/回收站/旧安装包 | 仅 `-Execute` |
| `organize` | 目录迁移 + junction，或照片年月整理 | 仅 `-Execute` |
| `dedupe` | 查找重复文件并移动到隔离区 | 仅 `-Execute` |
| `skills` | 列出/安装 AI skills | 仅 `-Install` |
| `version` | 版本号 | 否 |

### scan

```powershell
pwsh -File pc-manager.ps1 scan [-Drives C,D,E] [-Fast] [-Exclude <dir1,dir2>] [-Parallel] [-Output reports] [-Json]
```

- `-Drives`：默认所有固定磁盘。
- `-Fast`：只统计顶层目录，并跳过 `WinSxS`、`Windows\Installer`、`SoftwareDistribution`、`Package Cache`。
- `-Exclude`：额外排除目录，逗号分隔。
- `-Parallel`：多盘并行；同一物理磁盘上可能更慢，默认顺序。
- `-Json`：同时把 JSON 输出到控制台。

### audit

```powershell
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json [-Output audit.md] [-Json]
```

- 读取扫描 JSON，不重新扫描、不修改文件。
- 输出健康分（0–100）、容量预算、Tier 角色、P0/P1/P2 问题、Top 目录和 7/30/90 天建议。
- `-Json` 适合 agent/GUI 读取；不带 `-Json` 时写 Markdown 报告。

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
| `storage-strategy` | 容量预算、目录规范、仓库空间策略、路径卫生与审计 |

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
  Strategy.ps1           存储策略审计、健康分、P0/P1/P2 问题
  Classify.ps1           垃圾/迁移/媒体分类与建议
  Report.ps1             Markdown/HTML 报告
  Clean.ps1              清理与去重
  Organize.ps1           目录迁移、照片整理
  Skills.ps1             skill 安装
skills/                  AI Skill 库
config/default.json      阈值配置
gui/                     可选本地 Web GUI（Node.js 内置模块，零依赖）
  server.mjs             HTTP API、任务、SSE
  bridge.ps1             调用 PowerShell 清理函数
  public/                无框架前端
docs/                    规范、schema、安全、迭代日志
  storage-strategy.md    通用存储策略
  analysis/              本机存储分析报告（含日期）
scripts/install-skills.ps1
scripts/start-gui.ps1    启动 GUI（可选 -Admin）
scripts/consolidate-downloads.ps1  合并下载根（默认 dry-run，-Execute 写 manifest）
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

## 贡献

欢迎提交 Issue 和 PR。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [docs/safety.md](docs/safety.md)。

## 安全

发现安全问题请使用 GitHub 私密安全公告，不要公开 Issue。详见 [SECURITY.md](SECURITY.md)。

## 更新日志

版本变更见 [CHANGELOG.md](CHANGELOG.md)。

## License

MIT
