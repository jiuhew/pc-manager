# 媒体文件整理计划（2026-11-07）

> 执行状态（2026-11-07）：已完成。最终 `E:\Media\Photos` 为 6,346 个 / 92.03 GB，`E:\Media\Videos` 为 540 个 / 123.30 GB，0 失败；`新疆.zip` 已解包进 `2025-06_新疆`。详见文末“执行结果”。

## 1. 目标

把现有媒体文件统一到：

```text
E:\Media\Videos\YYYY\YYYY-MM
E:\Media\Photos\YYYY\YYYY-MM
```

原则：

- 照片进 `Photos`，视频进 `Videos`
- 按拍摄时间/修改时间归入 `YYYY\YYYY-MM`
- 保留原文件名；重名自动加 `_1`、`_2`
- 每个移动任务写 CSV manifest
- 不删除任何个人文件
- 非媒体文件留在 `E:\Photos`，另行处理

## 2. 预览结果

| 来源 | 类型 | 文件数 | 大小 | 目标 |
|---|---|---:|---:|---|
| `E:\Photos` | 照片 | 5,117 | 67.18 GB | `E:\Media\Photos\YYYY\YYYY-MM` |
| `E:\Photos` | 视频 | 303 | 57.61 GB | `E:\Media\Videos\YYYY\YYYY-MM` |
| `C:\Users\Jiuhe\Videos` | 视频 | 3 | 0.04 GB | `E:\Media\Videos\YYYY\YYYY-MM` |
| **合计** | | **5,423** | **124.83 GB** | |

- `E:\Media` 当前不存在
- `E:\Media\Photos` / `E:\Media\Videos` 当前不存在
- 目标子目录不存在，不会覆盖已有文件
- `E:\Photos → E:\Media` 是同盘移动，E: 总用量不变
- `C:\Users\Jiuhe\Videos → E:` 是跨盘移动，仅 3 个文件

## 3. 目标结构示例

### 精确年月（默认）

```text
E:\Media\Photos\2026\2026-10\DJI_20261010074311_0001_D.JPG
E:\Media\Videos\2026\2026-10\DJI_20261010074612_0007_D.MP4
E:\Media\Videos\2025\2025-12\...
```

### 保留事件名（可选）

```text
E:\Media\Photos\2026\2026-09_莫干山\...
E:\Media\Videos\2026\2026-09_DJI航拍\...
```

精确年月会扁平化原事件文件夹名（如 `2024-11_NVIDIA_personal`）；manifest 会保留原 Source 路径，仍可追溯。

## 4. 分阶段计划

### Phase 1：移动现有照片/视频

1. 预检
   - 确认 `E:\Media` 不存在或为空
   - 确认 `E:\Photos` 没有云占位/junction 需要跳过
   - 确认 E: 空闲足够（当前 464.97 GB）
2. 移动照片
   - 5,117 个 / 67.18 GB
   - 源：`E:\Photos`
   - 目标：`E:\Media\Photos`
3. 移动 E:\Photos 视频
   - 303 个 / 57.61 GB
   - 目标：`E:\Media\Videos`
4. 移动 C:\Users\Jiuhe\Videos
   - 3 个 / 0.04 GB
   - 目标：`E:\Media\Videos`
5. 校验
   - 三个 manifest 的 `Moved` 与源文件数一致
   - `Failed = 0`
   - 目标目录文件数/大小与预览一致
   - 源目录中不再有照片/视频（非媒体除外）
6. 清理
   - 只删除空目录；不删除任何文件
   - 非媒体文件保持在 `E:\Photos`

### Phase 2：处理唯一照片归档 `新疆.zip`（单独确认）

- 文件：`E:\Photos\归档\新疆.zip`
- 内容：1,463 张 JPG，约 90.51 GB，时间集中在 **2025-06-25**
- 抽查前 8 个文件名，在 `E:\Photos` 中未找到同名文件 → 很可能是唯一副本
- 建议：
  1. 解包到 `E:\Media\Photos\2025\2025-06_单人-卢亦凡\`
  2. 核对 1,463 个文件和总大小
  3. 确认完整后：
     - 删除 zip（净空间不变，数据进入媒体库），或
     - 移到 `E:\Archive\Photos\` 作为冷备（继续占 90.5 GB）
- 不要在未校验前删除 zip。

### Phase 3：非媒体文件与空目录

Phase 1 后 `E:\Photos` 预计剩余约 90.87 GB：

- `新疆.zip` 约 90.5 GB
- PSD/PPTX/ZIP/MD 等约 0.4 GB
- `README_照片目录规范.md`

建议：

- 项目类文件（PSD/PPTX）移到对应项目目录或 `E:\Media\Photos\_projects`
- 冷归档移到 `E:\Archive`
- 空目录先导出清单，再确认删除
- 不把非媒体文件混进 Photos/Videos 的月份目录

## 5. 执行命令（未执行）

```powershell
$script:PcRoot = (Get-Location).Path
. .\lib\Core.ps1
. .\lib\Clean.ps1
. .\lib\Organize.ps1

# 照片
Invoke-OrganizeMedia -Source 'E:\Photos' -Destination 'E:\Media\Photos' -Kind photo `
  -Execute -ManifestRoot 'reports\organize\media-photos-20261107'

# E:\Photos 视频
Invoke-OrganizeMedia -Source 'E:\Photos' -Destination 'E:\Media\Videos' -Kind video `
  -Execute -ManifestRoot 'reports\organize\media-videos-20261107'

# C:\Users\Jiuhe\Videos
Invoke-OrganizeMedia -Source 'C:\Users\Jiuhe\Videos' -Destination 'E:\Media\Videos' -Kind video `
  -Execute -ManifestRoot 'reports\organize\users-videos-20261107'
```

执行前建议先做一次 dry-run（去掉 `-Execute`），确认目标路径和样例。

## 6. Manifest 与回滚

每个任务写：

- `manifest.csv`：`Source, Destination, SizeMB, Status, Error, Time`
- 失败项保持源文件不变
- 回滚依赖 manifest 的 Source/Destination 映射；同盘移动可按行反向移动

## 7. 风险与注意事项

- **事件名丢失**：精确 `YYYY\YYYY-MM` 会扁平化事件文件夹；需要保留时用 `YYYY\YYYY-MM_事件`
- **EXIF 缺失**：照片优先用 EXIF；没有时用修改时间，可能把“复制日期”当拍摄日期
- **云占位**：OneDrive/iCloud 占位文件不参与移动
- **junction**：不跟随、不重复移动
- **重名**：自动加序号，不覆盖
- **磁盘空间**：E: 同盘移动不增加占用；解包 zip 需要约 90.5 GB 临时空间
- **不删除**：本计划不删除照片、视频、压缩包；只移动并写 manifest

## 8. 待确认

1. ~~采用精确 `YYYY\YYYY-MM`，还是保留事件名？~~ 已按精确 `YYYY\YYYY-MM` 执行。
2. ~~是否执行 Phase 1？~~ 已完成，0 失败。
3. `新疆.zip` 是否作为 Phase 2 单独处理？仍待决定。
4. `E:\Photos` 剩余非媒体文件是否移到 Archive/项目目录？仍待决定。

## 9. 执行结果（2026-11-07）

| 任务 | 结果 | 失败 |
|---|---|---:|
| `E:\Photos` 照片 → `E:\Media\Photos` | 5,117 个 / 67.18 GB | 0 |
| `E:\Photos` 视频 → `E:\Media\Videos` | 303 个 / 57.61 GB | 0 |
| `C:\Users\Jiuhe\Videos` → `E:\Media\Videos` | 3 个 / 0.04 GB | 0 |

后续又完成了 `新疆.zip`（1,463 张）解包到 `E:\Media\Photos\2025\2025-06_新疆`，并继续合并了其他媒体。

**最终状态（17:48 扫描）：**

```text
E:\Media\Photos\YYYY\YYYY-MM\...
E:\Media\Videos\YYYY\YYYY-MM\...
```

- `E:\Media\Photos`：**6,346 个文件 / 92.03 GB**（其中图片 5,878 个）
- `E:\Media\Videos`：**540 个文件 / 123.30 GB**（全部为视频）
- `E:\Media` 合计：**6,886 个文件 / 215.33 GB**
- `E:\Photos`：剩余 **7 个文件 / 0.37 GB**，为非媒体文件
- `D:\Media`：空的中间目录已删除
- `新疆.zip`：已解包到 `E:\Media\Photos\2025\2025-06_新疆`，归档包不再存在
- `C:\Users\Jiuhe\Videos`：剩余 333 个小文件（非视频，约 0.06 GB），未动

Manifest：

- `reports\organize\media-20261107-phase1\photos-from-d\manifest.csv`（5,117 moved / 0 failed）
- `reports\organize\media-20261107-phase1\videos\manifest.csv`（303 moved / 0 failed）
- `reports\organize\media-20261107-phase1\users-videos\manifest.csv`（3 moved / 0 failed）
- `reports\organize\20261107-171708\manifest.csv`（之前 E:\Photos → D:\Media\Photos 的原始记录）

> 说明：照片曾先被一次执行移动到 `D:\Media\Photos`；本次已校正到 `E:\Media\Photos`，原 D 盘目录已清空并移除。没有照片/视频丢失。
