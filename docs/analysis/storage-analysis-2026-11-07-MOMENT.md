# 本机存储空间全面检查（MOMENT / wjh96）

- 检查日期：2026-11-07
- 电脑：MOMENT / wjh96
- 扫描：`reports/scan-20261107-182950.json`（C: 全量只读扫描，725,574 个文件，344.1 秒）
- 报告：`reports/scan-20261107-182950.md`
- 审计：`reports/audit-20261107-182950.json`
- 策略依据：[`docs/storage-strategy.md`](../storage-strategy.md)
- 健康分：**85 / 100（A）**
- P0：0 · P1：0 · P2：5

> 本机只有一块固定磁盘 C:（952.19 GB），没有 D:/E: 数据盘。
> 因此策略中的“分层到数据盘”无法直接执行；迁移目标应改为外置 SSD/云归档，或先做同盘结构整理。

## 1. 结论

1. **容量健康**：C: 已用 427.69 GB，空闲 524.50 GB（55.1%），远高于 15% 红线，没有紧急清理压力。
2. **主要空间在用户目录，而不是系统**：`C:\Users` 逻辑 463.41 GB，其中 OneDrive 占位逻辑 248.50 GB、本地仅 10.42 GB；真实本地占用最大的是 Desktop 108.32 GB、AppData 63.33 GB。
3. **最大可识别本地媒体**：
   - `Desktop\婚礼` 58.19 GB（婚礼视频，`pocket` 子目录 57.81 GB）
   - `Desktop\Learn` 30.56 GB（课程/毕业答辩视频，`GP Go!` 28.50 GB）
   - `Pictures` 19.15 GB
   - `Desktop\Photo` 11.57 GB
   - `Videos` 10.37 GB
   - `Desktop\pocket` 7.95 GB
4. **工程占用**：Docker WSL 镜像 18.39 GB（`docker_data.vhdx` 18.25 GB），但审计建议的 `D:\Docker\wsl` 在本机不存在。
5. **可直接回收的空间约 21–22 GB**，且不碰用户数据：
   - 休眠文件 12.59 GB（`powercfg /h off`）
   - `C:\qycache\temp_cache` 6.02 GB（应用缓存，需先关闭相关应用）
   - 安全缓存/更新残留 2.71 GB（GUI/CLI 预览后清理）
   - 系统缓存/日志 0.46 GB（需管理员）

## 2. 容量与角色

| 盘 | 角色 | 总量 | 已用 | 空闲 | 空闲率 | 状态 |
|---|---|---:|---:|---:|---:|---|
| C: | 系统 + 应用 + 用户数据（唯一盘） | 952.19 GB | 427.69 GB | 524.50 GB | 55.1% | 正常 |

预算：OS/应用 ≤ 35%；用户数据 ≤ 25%；空闲 ≥ 15%。当前空闲 55.1%，预算充足。

## 3. 空间去向

| 路径 | 本地大小 | 说明 |
|---|---:|---|
| `C:\Users\wjh96` | ~248 GB 本地 | 不含 OneDrive 占位逻辑大小 |
| `C:\Users\wjh96\Desktop` | 108.32 GB | 婚礼 58.19 + Learn 30.56 + Photo 11.57 + pocket 7.95 |
| `C:\Users\wjh96\AppData` | 63.33 GB | Local 53.56、Roaming 9.40、LocalLow 0.38 |
| `C:\Windows` | 45.27 GB | 系统，不动 |
| `C:\Program Files (x86)` | 38.57 GB | 含 Steam 游戏 |
| `C:\Program Files` | 31.71 GB | 应用 |
| `C:\Users\wjh96\Pictures` | 19.15 GB | MarryMe 9.17、Yunnan_05 2.92、Macau 2.47 |
| `C:\hiberfil.sys` | 12.59 GB | 休眠文件 |
| `C:\Users\wjh96\Videos` | 10.37 GB | 请回答1988 4.95 + 电影 5.42 |
| `C:\Users\wjh96\xwechat_files` | 7.43 GB | 微信文件，用户数据 |
| `C:\qycache` | 6.03 GB | temp_cache 6.02 |
| `C:\data` | 5.92 GB | 含 `U\old\GP Go!.7z` 1.12 GB |
| `C:\eSupport` | 3.77 GB | OEM 驱动/支持文件 |
| `C:\pagefile.sys` | 2.00 GB | 页面文件，不动 |

### 云占位

| 路径 | 逻辑大小 | 本地大小 | 逻辑文件 | 本地文件 |
|---|---:|---:|---:|---:|
| `C:\Users\wjh96\OneDrive` | 248.50 GB | 10.42 GB | 72,710 | 1,453 |
| `C:\Users\wjh96\iCloudDrive` | 0.01 GB | 0.00 GB | 8 | 4 |

**不要把 OneDrive 占位文件当普通大文件移动/删除。**

## 4. 建议分类

### 1. 媒体文件建议

#### P2 · 媒体分散在 Desktop / Pictures / Videos / OneDrive

- 问题：没有唯一的媒体根；婚礼、旅行、课程视频、电影分散在至少 6 个目录。
- 证据：`Desktop\婚礼` 58.19 GB、`Desktop\Photo` 11.57 GB、`Desktop\pocket` 7.95 GB、`Pictures` 19.15 GB、`Videos` 10.37 GB。
- 动作：
  1. 选定唯一媒体根，例如 `C:\Users\wjh96\Pictures`（本机只有 C:）。
  2. 用 `photo-organizer` 按 `YYYY\YYYY-MM_事件` 归档：照片进 `Pictures`，视频进 `Videos`。
  3. 先 dry-run 生成 manifest，确认后再移动；不要删除原片。
- 预计释放/迁移量：约 108 GB（Desktop 媒体）同盘移动，**不释放空间**，只改善结构。
- 风险/权限：婚礼视频属于唯一素材，必须先备份到外置盘/云，再考虑整理；移动不删除。

#### P2 · 婚礼素材 58.19 GB 集中在桌面

- 问题：`Desktop\婚礼\pocket` 57.81 GB，包含 4 个约 16 GB 的 DJI 原片及同名 `.LRF` 代理文件。
- 证据：`DJI_20260923225704_0002_D.MP4` 16.01 GB、`...0003_D.MP4` 16.01 GB、`...0004_D.MP4` 16.01 GB、`...0001_D.MP4` 2.93 GB、`...0005_D.MP4` 2.46 GB。
- 动作：先复制到外置 SSD/可信云盘并校验；再归入 `Pictures\2026\2026-09_婚礼`。`.LRF` 是低码率代理文件，确认成片后可按需归档，但不要盲目删除。
- 预计释放/迁移量：移动 0；若备份后删除本地副本，最多约 58 GB（需用户明确确认）。
- 风险/权限：高价值唯一数据，禁止直接删除；建议 3-2-1 备份。

#### P2 · 课程视频 30.56 GB

- 问题：`Desktop\Learn\GP Go!` 28.50 GB，主要是毕业答辩/课程录屏，长期放在桌面。
- 证据：`MVI_5017.MP4` 20.75 GB、`MVI_5018.MP4` 2.09 GB、`MVI_5021.MP4` 1.62 GB、`MVI_5020.MP4` 1.33 GB。
- 动作：归入 `Videos\2025\2025-05_毕业答辩` 或外置归档；保留原始文件。
- 预计释放/迁移量：同盘移动 0；外置归档后释放约 30.56 GB。
- 风险/权限：个人资料，只移动/备份，不删除。

#### P2 · 可能的重复照片目录

- 问题：`Desktop\Photo` 与 `Pictures` 存在同名/同主题目录（`Macau`、`Vietnam`/`越南`）。
- 证据：`Desktop\Photo\Macau` 2.47 GB 与 `Pictures\Macau` 2.47 GB；`Desktop\Photo\Vietnam` 5.61 GB 与 `Pictures\越南` 0.01 GB。
- 动作：用 `duplicate-finder` 做 SHA-256 比对，重复项移入隔离区，不直接删除。
- 预计释放/迁移量：需比对后确认，可能 2–5 GB。
- 风险/权限：先哈希比对，保留 manifest。

### 2. 工程文件建议

#### P2 · Docker WSL 镜像 18.39 GB，且迁移目标不存在

- 问题：`C:\Users\wjh96\AppData\Local\Docker\wsl\disk\docker_data.vhdx` 18.25 GB；审计建议 `D:\Docker\wsl`，但本机没有 D:。
- 证据：`Migration` 候选 18.36 GB；`AppData\Local\Docker` 18.39 GB。
- 动作（按优先级）：
  1. 关闭 Docker Desktop，执行 `docker system prune` 清理未使用镜像/容器/卷。
  2. 用 Hyper-V `Optimize-VHD` 或 Docker 设置压缩 vhdx（需管理员）。
  3. 如需迁移，只能迁移到外置 SSD 或新增数据盘；不要迁到不存在的 D:。
- 预计释放/迁移量：压缩可回收未知（通常数 GB）；迁移 18+ GB 到外置盘。
- 风险/权限：需停止 Docker；不要直接删除 vhdx。

#### P2 · 工作区根分散（低影响）

- 问题：`C:\Workspace` 0.18 GB 与 `C:\Projects` 0.01 GB 两个工作区根。
- 证据：`C:\Workspace` 含 `agent`、`coze-studio`、`react_explore`；`C:\Projects\pc-manager` 是本仓库。
- 动作：统一到 `C:\Workspace`（本机唯一盘），或明确保留 `C:\Projects` 作为工具仓库根。**当前体积很小，优先级低于媒体和 Docker。**
- 预计释放/迁移量：约 0。
- 风险/权限：移动仓库可能影响已打开的 IDE/路径，先确认。

#### P2 · `C:\data` 旧归档与课程压缩包

- 问题：`C:\data` 5.92 GB，含 `U\old\GP Go!.7z` 1.12 GB，可能与 `Desktop\Learn\GP Go!` 内容重叠。
- 证据：`C:\data\U\old\GP Go!.7z` 1.12 GB（2024-09-23）。
- 动作：哈希/解包比对；确认是备份后再决定归档或去重，不直接删除。
- 预计释放/迁移量：最多约 1.12 GB（确认重复后）。
- 风险/权限：用户资料，需确认。

#### P2 · 应用数据占用较大

- 问题：`AppData\Local` 53.56 GB，主要是 Docker 18.39、Doubao 7.30、Microsoft 6.78、Google 5.02、Programs 3.25、JianyingPro 3.22、Packages 2.76、Feishu 2.12。
- 动作：用各应用自带“清除缓存”功能；不要手动删除 `Packages`、聊天/数据库目录。
- 预计释放/迁移量：取决于应用缓存，通常 2–8 GB。
- 风险/权限：聊天记录、草稿、数据库只备份不删除。

### 3. 缓存管理文件建议

#### P2 · 安全缓存 2.71 GB（可直接预览清理）

- 问题：用户缓存、缩略图、更新残留。
- 证据（`clean` dry-run）：User TEMP 940.7 MB、uv cache 596.8 MB、Explorer thumbnails 326.8 MB、obsidian-updater 315.7 MB、@opencodedesktop-updater 254.8 MB、adrive-updater 143.7 MB、WebCache 73.0 MB、INetCache 65.6 MB、veee-updater 56.3 MB、D3DSCache 1.4 MB。
- 动作：GUI 清理页勾选 `safe` 项 → 预览 → 确认执行；或 `pc-manager clean -Category cache`（默认 dry-run）。
- 预计释放量：**2.71 GB**。
- 风险/权限：低；会重新生成。执行会写 manifest。

#### P2 · `C:\qycache\temp_cache` 6.02 GB

- 问题：非标准缓存目录，分类器未纳入 Junk；文件今天仍在更新（`data-00.pgf` 至 `data-05.pgf`，每个约 1 GB）。
- 证据：`C:\qycache\temp_cache` 6.02 GB，37 个文件。
- 动作：先确认属于哪个应用（名称指向奇艺/视频缓存）；关闭该应用后用其“清除缓存”功能，或确认无进程占用后清理。
- 预计释放量：最多 **6.02 GB**。
- 风险/权限：缓存可再生；不要在应用运行时强删。建议先做一次文件占用检查。

#### P2 · 休眠文件 12.59 GB

- 问题：`C:\hiberfil.sys` 12.59 GB。
- 动作：若不用休眠/快速启动，管理员执行 `powercfg /h off`；需要时 `powercfg /h on` 恢复。
- 预计释放量：**12.59 GB**。
- 风险/权限：需要管理员；不要直接删除文件。

#### P2 · 系统缓存/日志 0.46 GB（需管理员）

- 证据：`C:\Windows\SoftwareDistribution\Download` 0.23 GB、`C:\Windows\Logs` 0.23 GB。
- 动作：管理员会话中预览后清理；Windows Update 缓存会在下次更新重建。
- 预计释放量：0.46 GB。
- 风险/权限：需管理员。

#### P2 · 空目录 74,672 个（路径卫生）

- 问题：空目录数量异常多，影响导航和文件计数。
- 证据：`EmptyDirs = 74,672`；reparse point 56 个。
- 动作：先导出清单，抽样确认；保留工具/构建/同步所需空目录，再分批删除。
- 预计释放量：接近 0（仅元数据），主要是可读性收益。
- 风险/权限：不要递归跟随 reparse point；删除前确认无应用依赖。

## 5. 路径与文件夹问题

- 工作区：`C:\Workspace` 与 `C:\Projects` 两个根（体积很小）。
- 媒体：Desktop、Pictures、Videos、OneDrive 四处分散，缺少唯一媒体根。
- 下载：`C:\Users\wjh96\Downloads` 仅 0.56 GB，健康，不需要分流。
- 空目录：74,672 个；reparse point 56 个。
- 云占位：OneDrive 逻辑 248.50 GB / 本地 10.42 GB；保持占位。
- 孤立项：卸载记录 0；失效启动项 1（`QuarkUpdaterTaskUser1.0.0.21`，指向 QuarkUpdater）；Store 应用数据 0。
- 大文件：≥500 MB 共 75 个 / 189.45 GB；其中 OneDrive 占位 28 个 / 40.69 GB，本地 47 个 / 148.76 GB。本地大文件主要由婚礼视频、课程视频、Docker vhdx、电影构成。

## 6. 7 / 30 / 90 天计划

### 7 天

- 备份婚礼素材（58.19 GB）到外置 SSD 或可信云盘，校验文件数/大小。
- GUI 清理页执行 2.71 GB `safe` 缓存（预览 → 确认）。
- 确认休眠是否使用；不用则 `powercfg /h off`（12.59 GB）。
- 关闭奇艺/视频应用后清理 `C:\qycache\temp_cache`（最多 6.02 GB）。

### 30 天

- 用 `photo-organizer` 将 Desktop/Pictures/Videos 媒体归入 `Pictures\YYYY\YYYY-MM_事件`，先 dry-run。
- 用 `duplicate-finder` 比对 `Desktop\Photo` 与 `Pictures` 的 Macau/Vietnam 目录。
- Docker：`docker system prune` + 压缩 vhdx；确认是否需要外置盘迁移。
- 核对 `C:\data\U\old\GP Go!.7z` 是否与 Desktop 课程重复。
- 导出空目录清单，分批清理。

### 90 天

- 建立每月 `scan` + `audit` 节奏，观察健康分和 Top 目录变化。
- 课程/旧项目视频归档到外置盘；建立年度媒体归档。
- 规划外置 SSD 或第二块数据盘，把媒体/Learn/Docker 从系统盘分层出去。
- 保持 OneDrive 占位策略；不要把 Git/Docker/数据库放入同步目录。

## 7. 需要确认的动作

- **清理**：2.71 GB safe 缓存；6.02 GB `qycache` 缓存；12.59 GB 休眠文件；0.46 GB 系统缓存/日志。
- **移动/归档**：婚礼 58.19 GB、课程 30.56 GB、Desktop\Photo 11.57 GB、Desktop\pocket 7.95 GB、Pictures/Videos 媒体。
- **迁移**：Docker vhdx 18+ GB（外置盘）；工作区合并（可选）。
- **复核**：74,672 个空目录；1 个失效启动项；大文件 47 个本地 / 148.76 GB。

## 8. 不要做的事

- 不要删除 OneDrive 占位文件，也不要按 248.50 GB 逻辑大小判断本地占用。
- 不要直接删除 `hiberfil.sys`、`pagefile.sys`、`WinSxS`、`Windows\Installer`、`Package Cache`。
- 不要删除婚礼原片、课程视频、微信文件、聊天记录和数据库。
- 不要为了“腾空间”删除唯一素材；先备份、校验，再谈删除。
- 不要把审计建议中的 `D:\...` 直接执行——本机没有 D: 盘。
- 不要递归跟随 reparse point 做备份或删除。

## 9. 本次检查产物

- `reports/scan-20261107-182950.json` / `.md`
- `reports/audit-20261107-182950.json`
- `reports/clean-dryrun.txt`
- `reports/detail-20261107.json`、`reports/detail-largefiles.json`、`reports/detail-media.json`
- GUI：`http://127.0.0.1:7788/`（已加载本次扫描）

## 10. AI 建议（单盘优化后）

GUI 的 AI 建议已按本机实际情况调整，不再出现 `D:\...` 目标：

- **媒体**：从扫描的大文件中识别出 `Desktop\婚礼`、`Desktop\Learn`、`Videos`，目标统一为 `C:\Users\wjh96\Media\Videos`；照片目标为 `C:\Users\wjh96\Media\Photos`。每张卡片都会明确说明“同盘整理，不释放空间”。
- **工程**：Docker/WSL 不再建议迁移到 `D:\Docker\wsl`，改为“清理/压缩 vhdx 或迁移到外置 SSD”的建议；另有一条“单盘环境：用外置盘或云做归档层”的策略建议。
- **工作区**：改为在 `C:\Workspace` 与 `C:\Projects` 之间选一个根，不再建议 `D:\Work`。
- **缓存**：保留 2.71 GB 安全缓存清理和休眠文件建议。
- 单盘扫描的 `Migration.SuggestedTarget` 现在为空，报告显示 `external/compact (single drive)`。

## 11. 媒体整理执行结果（2026-11-07 18:49）

按 AI 建议执行了 4 组同盘整理，目标改为现有目录，不新建 `Media`：

| 来源 | 目标 | 移动 | 失败 | 跳过 | 说明 |
|---|---|---:|---:|---:|---|
| `Desktop\婚礼` | `C:\Users\wjh96\Videos` | 6 | 0 | 0 | 约 54.8 GB 视频 |
| `Desktop\Learn` | `C:\Users\wjh96\Videos` | 7 | 0 | 0 | 约 27.1 GB 课程视频 |
| `C:\Users\wjh96\Videos` | `C:\Users\wjh96\Videos` | 21 | 0 | 13 | 原地整理，13 个已在正确年月目录 |
| `C:\Users\wjh96\Pictures` | `C:\Users\wjh96\Pictures` | 2,004 | 0 | 0 | 原地整理照片 |

合计：**移动 2,038 个文件，失败 0**；随后又移走 `Pictures` 中 16 个残留视频（2.74 GB），两批合计 **2,054 个文件**。

整理后：

- `Videos`：2023（2）、2025（6）、2026（26），共 34 个视频；年月目录外媒体文件 0。
- `Pictures`：2025（214）、2026（1,790），共 2,004 张照片；年月目录外媒体文件 0。
- `Desktop\婚礼` 剩余 27 个非视频文件（LRF/音频/表格等，约 4.69 GB）。
- `Desktop\Learn` 剩余 2,442 个非视频文件（约 4.10 GB）。
- 同盘移动，C: 空闲仍为 523.25 GB（未释放空间，符合预期）。

Manifest：

- `reports/organize/ai-media-20261107-184958/1-media-video/manifest.csv`
- `reports/organize/ai-media-20261107-184958/2-media-video-2/manifest.csv`
- `reports/organize/ai-media-20261107-184958/3-media-video-3/manifest.csv`
- `reports/organize/ai-media-20261107-184958/4-media-photo/manifest.csv`
- `reports/organize/ai-media-20261107-184958/5-pictures-video/manifest.csv`

核对结果：`reports/media-exec-verify.json`、`reports/media-final-check.json`（两个标准目录外媒体均为 0）。

## 12. 执行后复核（19:04 全量扫描）

- 扫描：`reports/scan-20261107-190432.json`（726,036 个文件，134.2 秒）
- 健康分：**85/100（A）**，P0/P1 = 0，P2 = 5
- 容量：C: 已用 428.96 GB，空闲 523.24 GB
- 可清理：12 项 / 3.17 GB
- 媒体统计：照片 91.14 GB / 65,952 个，视频 190.67 GB / 1,821 个（包含 OneDrive 逻辑大小）
- 空目录：74,688 个；reparse point：56 个；大文件：75 个
- 迁移候选：Docker WSL 18.36 GB，`SuggestedTarget` 为空（单盘，建议压缩/外置）

剩余 P2：OneDrive 占位、工作区分散、空目录、大文件复核、休眠文件。

## 13. 第二批媒体建议执行（2026-11-07 19:06）

19:04 扫描后 AI 又生成 4 条媒体建议，按现有 `Videos`/`Pictures` 目标执行：

| 来源 | 目标 | 移动 | 失败 | 跳过 | 说明 |
|---|---|---:|---:|---:|---|
| `Videos`（原地） | `Videos` | 0 | 0 | 50 | 已全部在年月目录 |
| `Desktop\Photo` | `Videos` | 18 | 0 | 0 | 约 3.12 GB 视频 |
| `Desktop\pocket` | `Videos` | 39 | 0 | 0 | 约 6.90 GB 视频 |
| `Pictures`（原地） | `Pictures` | 0 | 0 | 2,004 | 已全部在年月目录 |

合计：**移动 57 个视频，失败 0，跳过 2,054 个已归档文件**。

核对：

- `Videos` 年月目录外媒体：0
- `Pictures` 年月目录外媒体：0
- `Desktop\Photo` 仍有 1,261 张照片（不属于本次 4 条建议）
- `Desktop\pocket` 仍有 56 张照片（不属于本次 4 条建议）
- C: 空闲 523.22 GB（同盘移动，符合预期）

Manifest：

- `reports/organize/ai-media-20261107-190634/1-media-video/manifest.csv`
- `reports/organize/ai-media-20261107-190634/2-media-video-2/manifest.csv`
- `reports/organize/ai-media-20261107-190634/3-media-video-3/manifest.csv`
- `reports/organize/ai-media-20261107-190634/4-media-photo/manifest.csv`

核对文件：`reports/media-final-check-190634.json`。

## 14. 剩余照片整理（2026-11-07 19:19）

把两条媒体建议未覆盖的 Desktop 照片也归入 `Pictures`：

| 来源 | 目标 | 移动 | 失败 | 说明 |
|---|---|---:|---:|---|
| `Desktop\Photo` | `C:\Users\wjh96\Pictures` | 1,261 | 0 | 约 8.53 GB 照片 |
| `Desktop\pocket` | `C:\Users\wjh96\Pictures` | 56 | 0 | 约 0.69 GB 照片 |

整理后：

- `Pictures` 年月目录：2025（1,101 个 / 7.37 GB）、2026（2,220 个 / 18.26 GB），共 3,321 张照片
- `Pictures`、`Videos` 年月目录外媒体：0
- `Desktop\Photo`、`Desktop\pocket` 中剩余照片/视频：0
- C: 空闲 525.12 GB

Manifest：

- `reports/organize/media-extras-20261107-191951/1-desktop-photo/manifest.csv`
- `reports/organize/media-extras-20261107-191951/2-desktop-pocket/manifest.csv`

核对文件：`reports/media-extras-verify-191951.json`。
