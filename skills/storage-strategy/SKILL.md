---
name: Storage Strategy
description: 当用户要分析磁盘空间分配、制定存储策略、找出路径/文件夹管理问题、清理或归档空间、评估代码仓库/项目工作区占用、给出 AI 空间建议时使用。读取 docs/storage-strategy.md，运行 pc-manager scan/audit，按媒体文件、工程文件、缓存管理三类输出健康分、P0/P1/P2 问题和可执行方案。
---

# Storage Strategy

## 何时使用

- 用户问“磁盘空间去哪了”“怎么分配比较合理”“哪些文件夹太乱”
- 需要制定机器级目录规范、容量预算、归档/备份策略
- 需要分析代码仓库、项目工作区、媒体库、下载目录的空间问题
- 需要把复杂清理/迁移/归档任务拆成可执行计划
- GUI 的 AI 建议需要更完整的空间策略上下文

## 输入

优先使用已有扫描：

```powershell
Get-ChildItem reports\scan-*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

没有可用扫描时，先运行只读扫描：

```powershell
pwsh -File pc-manager.ps1 scan -Drives C,D,E
```

需要最新结果时再扫描；不要为了分析删除任何文件。

## 先分析机器拓扑（必做）

在给任何迁移/媒体建议前，先从扫描的 `Drives` 判断：

- **系统盘 / 数据盘**：`SystemDrive` 是 C: 还是其他盘；哪些盘是独立数据盘。
- **单盘机器**（只有一块固定盘）：
  - 不提出跨盘迁移；不要生成 `D:\`、`E:\` 等不存在的目标。
  - 照片主库：`%USERPROFILE%\Pictures`；视频主库：`%USERPROFILE%\Videos`；音乐：`%USERPROFILE%\Music`。
  - 归档：`%USERPROFILE%\Archive` 或用户指定目录；冷数据用外置盘/云。
  - 重点放在清理、去重、压缩、归档，而不是迁移。
- **多盘机器**：
  - 只向 `Drives` 中真实存在、且空闲空间足够的数据盘提迁移。
  - 优先数据盘，避免把系统盘作为媒体/归档目标。
  - 目标盘空闲小于迁移体积时，不要生成不可执行的迁移建议。

## 工作流

1. **读策略**
   - 阅读 `docs/storage-strategy.md`，以其中的预算、目录规范、阈值和 P0/P1/P2 分级为准。
2. **读扫描**
   - 找到最新的 `reports/scan-*.json`。
   - 只使用结构化字段：`Drives`、`TopFolders`、`Extensions`、`LargeFiles`、`Cloud`、`Junk`、`Migration`、`Media`、`InstalledApps`、`Orphans`、`Audit`。
3. **运行审计**
   - 优先使用扫描里已有的 `Audit`。
   - 没有时运行：

```powershell
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json -Json
```

4. **分析**
   - 先看 `Capacity`：每个盘的总量、已用、空闲、空闲率、角色。
   - 再看 `Workload`：可清理、媒体、应用、下载、云占位。
   - 按 `P0 → P1 → P2` 输出 `Findings`，不要只按体积排序。
   - 结合 `TopConsumers` 和 `TierPlan` 解释“为什么”。
5. **给出方案（固定三类）**
   - 所有可执行建议必须归入 **媒体文件建议 / 工程文件建议 / 缓存管理文件建议** 三类，不要混在一起。
   - 每条建议写清楚：问题、证据、动作、预计释放/迁移量、风险、是否需要管理员、是否可回滚。
   - 复杂任务（视频归档、目录迁移、批量清理）先给预览计划，不要直接执行。
   - 分类拿不准时：用户创作/拍摄产生的照片视频 → 媒体；源码、仓库、依赖、开发工具/应用迁移 → 工程；可再生或系统产生的缓存、日志、临时文件、安装包、回收站 → 缓存。
6. **固化结果**
   - 需要长期保留时，把审计报告写到 `docs/analysis/`，例如：
     `docs/analysis/storage-analysis-YYYY-MM-DD.md`。
   - 不要把用户个人路径/大文件清单写进 skill 或策略文档；分析报告单独放。

## 输出格式

```markdown
# 空间分析

## 结论
- 健康分：79/100（B）
- 总容量 / 已用 / 空闲：
- 主要矛盾（1–3 条）：

## 机器拓扑
- 系统盘 / 数据盘：
- 单盘 / 多盘：
- 可用目标盘（必须来自扫描）：

## 容量与角色
| 盘 | 角色 | 总量 | 已用 | 空闲 | 空闲率 | 状态 |

## 建议分类（固定三类，按此顺序输出）
### 1. 媒体文件建议
> 照片、视频、素材、媒体归档压缩包；对应 `photo-organizer`。

- P0/P1/P2：
- 问题：
- 证据：
- 动作：
- 预计释放/迁移量：
- 风险/权限：

### 2. 工程文件建议
> 项目工作区、代码仓库、构建产物、依赖缓存、开发工具/应用迁移；对应 `storage-strategy` + `app-migration`。

- P0/P1/P2：
- 问题：
- 证据：
- 动作：
- 预计释放/迁移量：
- 风险/权限：

### 3. 缓存管理文件建议
> 缓存、临时文件、日志、旧安装包、回收站、更新残留；对应 `disk-cleanup`。

- P0/P1/P2：
- 问题：
- 证据：
- 动作：
- 预计释放量：
- 风险/权限：

## 路径与文件夹问题
- 工作区是否分散：
- 下载/媒体是否分散：
- 临时/重复命名：
- 空目录/junction：
- 云占位：

## 7 / 30 / 90 天计划
- 7 天：
- 30 天：
- 90 天：

## 需要确认的动作
- 清理：
- 移动/归档：
- 迁移：
```

## 分类规则

| 类别 | 包含 | 典型动作 | 对应 skill |
|---|---|---|---|
| 媒体文件建议 | 照片、视频、音频、素材、媒体压缩包、相机/手机导出 | 按年月归档、合并媒体根、冷媒体进 Archive | `photo-organizer` |
| 工程文件建议 | 项目工作区、Git 仓库、构建产物、依赖缓存、数据集/模型、开发工具和应用迁移 | 统一 Work 根、移出构建产物、拆分数据集、迁移 CUDA/Anaconda/WSL/游戏 | `storage-strategy`、`app-migration` |
| 缓存管理文件建议 | 缓存、临时文件、日志、崩溃转储、旧安装包、回收站、更新残留 | 按 safe/elevated/confirm 分级清理 | `disk-cleanup` |

判断顺序：

1. 文件是否由用户拍摄/创作并需要长期保留？是 → 媒体。
2. 是否属于代码、项目、开发环境或应用安装？是 → 工程。
3. 是否可重新生成、可重新下载或属于系统残留？是 → 缓存。
4. 仍然不确定时，归入“工程文件建议”并标记“需人工复核”，不要直接建议删除。

## 关键规则

- **只读优先**：`scan`、`audit`、预览都不修改文件。
- **用户数据只移不删**：照片、视频、文档、聊天、数据库、下载文件不能因为“策略”直接删除。
- **可再生数据**：缓存、日志、临时文件、构建产物、旧安装包可以清理，但要分级和预览。
- **云占位**：OneDrive/iCloud 的逻辑大小不等于本地占用；不要移动占位文件。
- **junction/reparse**：不要同时统计/备份链接和目标；不要递归跟随。
- **WinSxS/Installer/Package Cache/pagefile/hiberfil**：绝不直接删除。
- **仓库策略**：源码留在仓库；数据集、模型、构建产物、依赖缓存、虚拟机镜像移出仓库；大文件用 Git LFS/外部存储。
- **一个根**：一台机器尽量只有一个 Work 根、一个 Media 根、一个 Archive 根、一个 Download 收件箱。
- **单盘**：只有系统盘时，不提出跨盘迁移；媒体进 `%USERPROFILE%\Videos/Pictures`，不要把目标写成不存在的 `D:`/`E:`。
- **manifest**：任何移动/清理都要写 CSV manifest；GUI 和 CLI 已内置。

## 常用命令

```powershell
# 只读扫描
pwsh -File pc-manager.ps1 scan -Drives C,D,E

# 审计（人类可读）
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json

# 审计（JSON，给 agent）
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-<timestamp>.json -Json

# 清理预览
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-<timestamp>.json

# 单目录迁移 + junction（先 dry-run）
pwsh -File pc-manager.ps1 organize -Source C:\path -Destination D:\path

# 媒体按年月归档（通过 GUI AI 建议或 Invoke-OrganizeMedia）
```

## 参考

- `docs/storage-strategy.md`：完整策略、预算、阈值、目录规范
- `lib/Strategy.ps1`：`Invoke-StorageAudit` 实现
- `docs/analysis/`：本机历史分析报告
- `gui/lib/ai.mjs`：GUI AI 建议生成
- `skills/disk-cleanup/SKILL.md`：清理安全等级
- `skills/app-migration/SKILL.md`：应用/目录迁移
- `skills/photo-organizer/SKILL.md`：照片/视频归档
