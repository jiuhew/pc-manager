# 本机存储空间分析（2026-11-07）

- 电脑：SISYPHUS
- 扫描：`reports/scan-20261107-164128.json`（C/D/E 全量扫描）
- 原始审计：`docs/analysis/storage-audit-2026-11-07.md`、`docs/analysis/storage-audit-2026-11-07.json`
- 策略依据：[`docs/storage-strategy.md`](../storage-strategy.md)
- 首次审计健康分：**66/100（C）**
- 最新复盘（18:06 扫描）：**88/100（A）**，见第 14 节

> 说明：分数偏低主要来自**结构和路径问题**，不是容量告急。总空闲仍有 1.1 TB，三块盘空闲率 53%–66%；真正值得处理的是 90.5 GB 的**唯一照片归档包**、分散的下载/工作区、79,707 个空目录和 965 个 reparse point。

## 1. 结论摘要

1. **容量本身健康**：总容量 1,906.6 GB，已用 784.4 GB（41.1%），空闲 1,122.2 GB。没有盘接近红线，C: 空闲 53.5%，D: 55.2%，E: 66.4%。
2. **最大单项异常**：`E:\Photos\归档\新疆.zip` 约 **90.5 GB**。进一步检查确认：包内是 **1,463 张 JPG，拍摄时间 2025-06-25，约 90.51 GB 未压缩**，且按文件名在 `E:\Photos` 中未找到同名文件，因此很可能是**唯一照片归档**，不能直接删除。
3. **可清理空间很少**：`Junk` 只有 0.6 GB，日常“清缓存”解决不了主要问题；重点是归档、去重、下载分流和仓库瘦身。
4. **路径结构问题**：
   - 工作区分散在 `D:\GitHub`（10.6 GB）和 `E:\Project`（3.3 GB）。
   - 下载分散在 `D:\迅雷下载`（10.0 GB）、`D:\Downloads`（1.9 GB）、`E:\BaiduNetdiskDownload`（1.4 GB）。
   - 空目录 79,707 个，reparse point 965 个，说明历史迁移/junction 较多，普通大小统计容易重复。
   - `C:\Users` 显示 320.6 GB 是**逻辑大小**，其中 OneDrive 逻辑 269.8 GB、本地只有 10.9 GB；不要按 320 GB 去清理或迁移占位文件。
5. **盘角色建议**：
   - **C:**：系统 + 应用 + 缓存。
   - **D:**：活跃游戏/开发/项目（`D:\Program Files (x86)` 215.3 GB 主要是 Steam 游戏，`D:\anaconda3`、`D:\wsl`、`D:\Docker`、`D:\GitHub`）。
   - **E:**：媒体 + 归档（`E:\Photos` 215.7 GB，`E:\Box`、`E:\Ebooks`、`E:\Project`）。

## 2. 容量分配

| 盘 | 角色 | 总量 | 已用 | 空闲 | 空闲率 | 状态 |
|---|---|---:|---:|---:|---:|---|
| C: | 系统 + 应用 + 缓存 | 506.61 GB | 235.52 GB | 271.09 GB | 53.5% | 正常 |
| D: | 活跃游戏 + 开发 + 项目 | 700.00 GB | 313.82 GB | 386.18 GB | 55.2% | 正常 |
| E: | 媒体 + 归档 | 700.00 GB | 235.03 GB | 464.97 GB | 66.4% | 正常 |
| **合计** | | **1,906.61 GB** | **784.37 GB** | **1,122.24 GB** | **41.1% 已用** | |

### 建议预算

| 盘 | 预算 |
|---|---|
| C: | OS/应用 ≤ 35%；用户数据 ≤ 25%；空闲 ≥ 15% |
| D: | 活跃项目 ≤ 25%；媒体 ≤ 45%；空闲 ≥ 10% |
| E: | 归档/媒体 ≤ 70%；备份 ≤ 20%；空闲 ≥ 10% |

按当前状态，三块盘都还有充足余量；不需要为了“腾空间”做激进清理。应优先把**结构**整理好，避免未来增长失控。

## 3. 空间去向（Top 目录）

| 路径 | 大小 | 文件数 | 判断 |
|---|---:|---:|---|
| `C:\Users` | 320.55 GB* | 496,257 | *逻辑大小；OneDrive 占位导致，本地实际约 10.9 GB |
| `E:\Photos` | 215.66 GB | 5,428 | 媒体主库，已看到 `2026\2026-09_*` 年月结构 |
| `D:\Program Files (x86)` | 215.31 GB | 47,522 | 主要是 Steam 游戏（黑神话、双人成行等） |
| `C:\Windows` | 58.17 GB | 261,058 | 系统，不动 |
| `C:\Program Files` | 43.15 GB | 102,404 | 应用，按需卸载 |
| `D:\anaconda3` | 22.11 GB | 531,076 | 开发环境，保留在 D: |
| `C:\Program Files (x86)` | 21.35 GB | 61,831 | 应用 |
| `D:\wsl` | 20.96 GB | 2 | WSL 镜像 + `ubuntu2404.tar` |
| `D:\Docker` | 16.86 GB | 2 | Docker vhdx |
| `C:\hiberfil.sys` | 12.74 GB | 1 | 休眠文件，可评估是否关闭 |
| `D:\GitHub` | 10.58 GB | 466 | 项目工作区，另有 `.git` pack 4.9 GB |
| `C:\pagefile.sys` | 10.50 GB | 1 | 页面文件，不建议手动删 |
| `D:\迅雷下载` | 9.97 GB | 9,614 | 下载收件箱，需要分流 |
| `C:\ProgramData` | 8.59 GB | 19,962 | 应用共享数据 |
| `E:\Box` | 6.59 GB | 3,072 | 资料/同步数据 |
| `D:\AppData` | 6.53 GB | 32,618 | 重定向的应用数据 |
| `E:\Ebooks` | 5.19 GB | 109 | 电子书，归档候选 |
| `E:\Project` | 3.29 GB | 8,062 | 第二个工作区，建议合并 |
| `E:\SteamLibrary` | 2.26 GB | 5,970 | 小游戏库 |
| `D:\Downloads` | 1.92 GB | 48 | 第二下载根 |

## 4. 路径和文件夹管理问题

### 4.1 P1：90.5 GB 的唯一照片归档包

- 文件：`E:\Photos\归档\新疆.zip`（约 90.5 GB）
- 内容检查：
  - **1,463 个条目**，全部是 JPG；
  - 未压缩总量 **90.51 GB**；
  - 条目时间集中在 **2025-06-25**；
  - 内部目录形如 `单人-卢亦凡/单人-卢亦凡/王久赫/IMG_8069.JPG`；
  - 抽查前 8 个文件名，在 `E:\Photos` 中均未找到同名文件。
- 结论：这**不是已解压照片的重复备份**，更像是一次完整人像拍摄的原始交付包。不要按“重复归档”直接删除。
- 建议：
  1. 解包到 `E:\Media\Photos\2025\2025-06_单人-卢亦凡\`（或严格按目标布局放到 `2025\2025-06\`）；
  2. 解包后核对 1,463 个文件、总大小和抽样校验和；
  3. 确认无误后，删除 zip（数据仍在媒体库中，净空间不变，但媒体库可检索）；或把 zip 移到 `E:\Archive\Photos\` 作为冷备（会继续占用 90.5 GB）；
  4. 解包需要临时约 90.5 GB 空闲，E: 当前 465 GB，足够。
- 空间含义：**“删除 zip”本身不是净释放**，因为解包后 JPG 仍占 90.5 GB；真正的收益是让这 1,463 张照片进入统一媒体库，而不是把压缩包当垃圾清掉。

> 同类的 `D:\wsl\ubuntu2404.tar`（10.25 GB）也值得确认：如果 WSL 已经 import 完成，这个 tar 可能只是安装备份，可在验证后移到 Archive 或删除。

### 4.2 下载目录分散

- `D:\迅雷下载`：9.97 GB
- `D:\Downloads`：1.92 GB
- `E:\BaiduNetdiskDownload`：1.42 GB

建议只保留一个下载收件箱，例如 `D:\Downloads\_inbox`，按 7 天/30 天规则分流：

- 7 天内：保留在 `_inbox`
- 7–30 天：确认后移到项目/媒体/归档
- 30 天以上：删除或归档，不在下载目录长期堆积

### 4.3 工作区分散

- `D:\GitHub`：10.58 GB
- `E:\Project`：3.29 GB
- `D:\GitHub\huazhang-cs-books\.git` 里有一个约 **4.9 GB** 的 pack 文件

建议：

1. 选一个唯一工作区根，例如 `D:\Work`；
2. 活跃仓库放 `D:\Work\<org>\<repo>`；
3. 6 个月未提交的仓库归档到 `E:\Archive\repos` 或打包为 bundle；
4. 大仓库检查历史大文件：
   ```powershell
   git count-objects -vH
   git rev-list --objects --all | Measure-Object
   ```
   必要时用 Git LFS 或重写历史；不要把数据集、模型、构建产物留在仓库。

### 4.4 空目录和 junction

- 空目录：**79,707** 个
- Reparse point / junction：**965** 个

这些不一定都要清理，但需要知道：

- 空目录会让导航和文件计数变噪音；可先列出、确认再删除。
- junction 可能是主动迁移留下的（例如 Anaconda/WSL/Docker/游戏），**不要递归跟随**；备份时不要同时备份链接和目标。
- 普通大小工具可能重复计算 junction 目标，导致“C 盘怎么这么大”的误判。

### 4.5 云占位

- `C:\Users\Jiuhe\OneDrive`：逻辑 **269.8 GB**，本地 **10.9 GB**
- 80,659 个逻辑文件，19,827 个本地文件

结论：

- 不要把 OneDrive 占位文件当普通大文件移动或删除；
- 不要把 Git 仓库、WSL/Docker 镜像、数据库、虚拟机放进 OneDrive；
- `C:\Users` 的 320 GB 是逻辑统计，不能作为“本地占用 320 GB”的依据。

### 4.6 休眠文件

- `C:\hiberfil.sys`：12.74 GB

如果不用休眠/快速启动，可由管理员执行：

```powershell
powercfg /h off
```

可回收约 12.7 GB。不要直接删除 `hiberfil.sys`。

## 5. 媒体库判断

- 全局照片：143.8 GB / 123,569 个
- 全局视频：165.0 GB / 16,903 个
- 音频：2.9 GB / 941 个
- 主媒体目录：`E:\Photos`（215.66 GB）
- 已看到 `E:\Photos\2026\2026-09_DJI航拍\...` 这种年月结构，因此**不应**简单判定“媒体未按年月归档”。

建议：

- 以 `E:\Media\Photos` / `E:\Media\Videos` 作为统一媒体根（或继续用 `E:\Photos`，但只保留一个权威根）；
- 把 `新疆.zip` 解包进媒体库，而不是把唯一归档包当垃圾删除；
- 新素材继续按 `YYYY\YYYY-MM_事件` 进入；
- 不活跃年份可整体移到 `E:\Archive\Photos`，但保留索引/清单。

## 6. 7 / 30 / 90 天计划

### 7 天

- 解包 `E:\Photos\归档\新疆.zip` 到 `E:\Media\Photos\2025\2025-06_单人-卢亦凡`，核对 1,463 个文件后，再决定保留 zip 作为冷备还是删除。
- 合并下载入口：把 `D:\迅雷下载`、`E:\BaiduNetdiskDownload` 的未处理文件移入一个 `_inbox`。
- 决定是否关闭休眠：`powercfg /h off`（可省 12.7 GB）。
- 清理 0.6 GB 安全缓存（收益小，但低风险）。

### 30 天

- 建统一工作区根 `D:\Work`；把活跃仓库从 `D:\GitHub`/`E:\Project` 迁入，归档不活跃仓库。
- 检查 `D:\GitHub\huazhang-cs-books` 的 4.9 GB pack：是否包含可移到 LFS/外部存储的大文件。
- 确认 `D:\wsl\ubuntu2404.tar` 是否还需要；不需要则移到 `E:\Archive` 或删除。
- 清理空目录前先导出清单；保留工具/构建所需的空目录。
- 记录 965 个 junction 的用途，避免备份重复。

### 90 天

- 给媒体库建立年度归档节奏：`E:\Photos\2025` 等旧年份移到 `E:\Archive\Photos`。
- 评估 Steam 游戏库：不活跃游戏卸载重下，或迁移到更大的数据盘。
- 给仓库设置体积阈值：> 2 GB 检查构建产物；> 5 GB 拆分数据集；> 20 GB 必须审计。
- 每季度运行 `scan` + `audit`，对比健康分和 Top 目录变化。

## 7. 推荐命令与 AI 建议

```powershell
# 重新审计
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-20261107-164128.json

# 输出 JSON 给 agent / GUI
pwsh -File pc-manager.ps1 audit -ScanPath reports\scan-20261107-164128.json -Json

# 预览清理（不要直接 -Execute）
pwsh -File pc-manager.ps1 clean -ScanPath reports\scan-20261107-164128.json
```

在 GUI 的 **AI 建议** tab 中，现在会额外读取 `Audit.Findings`，生成“空间策略”类建议。这些建议是可编辑、可复制的文本；确认后交给 agent 执行，执行前仍要预览。

## 8. 不要做的事

- 不要因为 `C:\Users` 显示 320 GB 就移动/删除 OneDrive 占位文件。
- 不要直接删除 `WinSxS`、`Windows\Installer`、`Package Cache`、`hiberfil.sys`、`pagefile.sys`。
- 不要删除 90.5 GB 的 `新疆.zip`：已确认它包含 1,463 张未在 `E:\Photos` 中找到的照片，很可能是唯一副本。先解包和校验。
- 不要同时备份 junction 和目标目录。
- 不要把 Git 仓库、Docker/WSL 镜像、数据库放进 OneDrive 同步目录。
- 不要把“清理缓存”当作主要策略；当前可清理量只有 0.6 GB。

## 9. 第二次 AI 分析（媒体拆分与唯一归档）

### 9.1 媒体预览结果

| 来源 | 文件数 | 大小 | 目标 |
|---|---:|---:|---|
| `E:\Photos` 照片 | 5,117 | 67.18 GB | `E:\Media\Photos\YYYY\YYYY-MM` |
| `E:\Photos` 视频 | 303 | 57.61 GB | `E:\Media\Videos\YYYY\YYYY-MM` |
| `C:\Users\Jiuhe\Videos` | 3 | 0.04 GB | `E:\Media\Videos\YYYY\YYYY-MM` |
| **合计** | **5,423** | **124.83 GB** | |

### 9.2 拆分后的真实影响

- `E:\Photos → E:\Media` 是同盘移动，**E: 的总已用/空闲不会变化**；变化的是目录结构。
- 拆分后大致变成：
  - `E:\Media\Photos`：约 67.18 GB
  - `E:\Media\Videos`：约 57.65 GB（含 C 盘 3 个）
  - `E:\Photos` 剩余：约 90.87 GB（主要是 `新疆.zip` + 少量 PSD/PPTX/ZIP）
- 因此这是**组织优化**，不是空间回收。
- 精确 `YYYY\YYYY-MM` 会扁平化事件名（如 `2024-11_NVIDIA_personal`）。manifest 会保留原 Source 路径，可追溯；如果希望目录本身保留事件名，用 `YYYY\YYYY-MM_事件`。

### 9.3 真正的空间回收点

| 动作 | 可释放/变化 | 性质 |
|---|---:|---|
| 关闭休眠 `powercfg /h off` | ~12.7 GB | 真实释放（C:） |
| 下载目录分流/清理 | 最多 ~13.3 GB | 部分可释放，需逐项确认 |
| 旧安装包/缓存 | ~0.6 GB | 低风险，收益小 |
| 解包并删除 `新疆.zip` | 净空间约 0 | 数据仍在媒体库；不是净释放 |
| 媒体拆分 | 0 | 同盘组织，不是释放 |
| 工作区合并 | 0 | 结构优化，可能跨盘移动 |

### 9.4 健康分情景

- 当前：**66 / C**
- 只移除 `新疆.zip`（`ubuntu2404.tar` 仍在）：`large-archives` 从 P1 降为 P2，约 **+4 → 70 / C**
- `新疆.zip` 和 `ubuntu2404.tar` 都处理完：该 finding 消失，约 **+7 → 73 / B**
- 关闭休眠：约 **+3 → 76 / B**
- 下载分流 + 工作区合并 + 空目录/链接整理：路径类 P2 减少，理想可到 **80+ / B**

### 9.5 建议顺序

1. 先解包并校验 `新疆.zip`，确认 1,463 张照片完整；再决定删除 zip 还是移到 `E:\Archive`。
2. 再决定媒体拆分是否保留事件名；确认后执行 5,423 个文件的同盘移动，写 3 份 manifest。
3. 处理下载分流（D:\迅雷下载、D:\Downloads、E:\BaiduNetdiskDownload）。
4. 合并工作区到 `D:\Work`，检查 `D:\GitHub` 的 4.9 GB pack。
5. 评估关闭休眠；最后再清理空目录/junction。

> 详细媒体整理计划见 [`media-organize-plan-2026-11-07.md`](media-organize-plan-2026-11-07.md)。

## 11. 媒体整理执行结果（2026-11-07）

- `E:\Media\Photos`：**6,346 个 / 92.03 GB**（图片 5,878 个）
- `E:\Media\Videos`：**540 个 / 123.30 GB**（全部视频）
- `E:\Media` 合计：**6,886 个 / 215.33 GB**
- 失败：**0**
- `E:\Photos` 剩余：**7 个非媒体文件 / 0.37 GB**
- `新疆.zip` 已解包到 `E:\Media\Photos\2025\2025-06_新疆`，归档包不再存在
- `D:\Media` 中间目录已清空并移除
- 三个 manifest 均成功：`reports\organize\media-20261107-phase1\...`
- `C:\Users\Jiuhe\Videos` 剩余 333 个非视频小文件（约 0.06 GB），未动

媒体库现在已经是：

```text
E:\Media\Photos\YYYY\YYYY-MM
E:\Media\Videos\YYYY\YYYY-MM
```

尚未执行：`E:\Photos` 非媒体文件整理、`D:\Downloads` 14.8 GB 分流、休眠文件处理。

## 12. 最新复盘（17:48 全量扫描）

健康分：**82/100（B）**，比首次审计的 66/100 提升 16 分。

### 容量

| 盘 | 已用 | 空闲 | 空闲率 |
|---|---:|---:|---:|
| C: | 235.28 GB | 271.33 GB | 53.6% |
| D: | 308.85 GB | 391.15 GB | 55.9% |
| E: | 240.33 GB | 459.67 GB | 65.7% |
| **合计** | **784.46 GB** | **1,122.15 GB** | **41.1% 已用** |

### 已解决

- 媒体已归入 `E:\Media\Photos` / `Videos`，无媒体散落
- `新疆.zip` 已解包（1,463 张）到 `2025-06_新疆`
- 下载目录已合并为 `D:\Downloads`（14.8 GB），`downloads-scattered` 消失
- 工作区不再分散（`workspace-scattered` 消失）
- `large-archives` 从 P1 降为 P2（只剩 `D:\wsl\ubuntu2404.tar` 10.3 GB）
- 无 P0 / P1 问题

### 剩余 P2（6 项）

| 类别 | 问题 | 证据 |
|---|---|---|
| cloud | OneDrive 占位逻辑/本地差距 | 80,712 逻辑文件，19,880 本地文件 |
| path | 下载根体积偏大 | `D:\Downloads` 14.8 GB |
| path | 空目录过多 | 79,613 个 |
| review | 大文件需要复核 | 129 个，合计 366.1 GB |
| review | 大压缩包需要核对 | `D:\wsl\ubuntu2404.tar` 10.3 GB |
| system | 休眠文件偏大 | `hiberfil.sys` 12.7 GB |

### 下一步建议

1. 分流 `D:\Downloads`（14.8 GB）：7/30 天规则，保留/归档/删除逐项确认
2. 确认 `D:\wsl\ubuntu2404.tar` 是否还需要；不需要则移到 Archive 或删除
3. 不用休眠则 `powercfg /h off`（约 12.7 GB）
4. 空目录先导出清单再清理；junction 不要递归跟随
5. OneDrive 占位保持原位，不搬迁

当前 AI 建议已刷新到 17:48 扫描，共 8 条，无 P0/P1，不再出现错误的媒体归档/下载分散建议。

## 13. 最新状态（18:01 全量扫描）

删除 `D:\wsl\ubuntu2404.tar` 后：

- 健康分：**85/100（A）**
- 总已用：**774.60 GB**
- 总空闲：**1,132.01 GB**
- P0 / P1：**0**
- P2：**5 项**

| 盘 | 已用 | 空闲 | 空闲率 |
|---|---:|---:|---:|
| C: | 235.23 GB | 271.38 GB | 53.6% |
| D: | 299.04 GB | 400.96 GB | 57.3% |
| E: | 240.33 GB | 459.67 GB | 65.7% |

剩余 P2：

- OneDrive 云占位（逻辑 269.8 GB / 本地 10.9 GB）
- `D:\Downloads` 14.8 GB 需要分流
- 空目录 79,613 个
- 大文件 128 个 / 355.9 GB 需要定期复核
- `hiberfil.sys` 12.7 GB

已解决：

- `large-archives` 消失（WSL tar 已删除，媒体 zip 已解包）
- 媒体已归入 `E:\Media\Photos` / `Videos`
- 下载目录已合并为 `D:\Downloads`
- 工作区分散问题消失
- 无效的 `C:\Users\Jiuhe\Videos` 视频建议已被过滤

下一步只剩：下载分流、休眠文件、空目录/大文件复核、云占位策略。

## 14. 18:06 复核

- 健康分：**88/100（A）**
- 总已用：771.46 GB；总空闲：1,135.15 GB
- P0 / P1：0
- P2：4 项（云占位、空目录、大文件复核、休眠文件）

| 盘 | 已用 | 空闲 | 空闲率 |
|---|---:|---:|---:|
| C: | 235.31 GB | 271.30 GB | 53.6% |
| D: | 287.56 GB | 412.44 GB | 58.9% |
| E: | 248.59 GB | 451.41 GB | 64.5% |

大文件复核修正：

- 原统计：128 个 / 355.9 GB
- 其中 30 个是 OneDrive/iCloud 占位（43.9 GB 逻辑大小）
- **本地大文件：98 个 / 312.0 GB**
- 分类：Steam 游戏 188.5 GB、媒体视频 52.2 GB、Docker/WSL 29.4 GB、系统文件 23.2 GB、仓库 6.2 GB、归档/安装包 6.0 GB、其他 6.6 GB

详细方案见 [`large-files-review-2026-11-07.md`](large-files-review-2026-11-07.md)。

## 10. 执行记录（2026-11-07）

### 下载目录合并

目标：`D:\Downloads`

| 来源 | 结果 | 文件 | 大小 |
|---|---|---:|---:|
| `E:\BaiduNetdiskDownload` | 已完整移入 `D:\Downloads\BaiduNetdiskDownload` | 102 | 1.42 GB |
| `D:\迅雷下载` | 已移入 `D:\Downloads\迅雷下载`，4 个活动缓存被锁定 | 9,666 / 9,670 | 11.50 / 11.66 GB |

- `D:\Downloads` 当前约 **9,816 个文件 / 14.84 GB**。
- `D:\迅雷下载` 仅剩 **4 个**迅雷云盘缓存文件（`.xltd` / `.xltd.cfg`，约 0.16 GB），被 `thunder` / `DownloadSDKServer` 占用。
- 未删除任何文件；可以关闭迅雷后重跑：
  ```powershell
  pwsh -File scripts\consolidate-downloads.ps1 -Source 'D:\迅雷下载' -Execute
  ```
- Manifest：
  - `reports/organize/downloads-20261107-172350/manifest.csv`（首次运行原始记录）
  - `reports/organize/downloads-20261107-172350/manifest-reconciled.csv`（逐文件实际状态：9,768 moved / 4 pending-locked）
  - `reports/organize/downloads-20261107-172350/summary-reconciled.csv`
  - `reports/organize/downloads-20261107-172350/reconcile.md`
