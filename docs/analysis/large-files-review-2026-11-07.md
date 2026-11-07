# 大文件复核计划（2026-11-07）

- 扫描：`reports/scan-20261107-180655.json`
- 审计发现：Large files deserve a periodic review
- 原始统计：128 个 >=500 MB 文件，合计 355.9 GB
- **修正**：其中 30 个是 OneDrive/iCloud 云占位文件（43.9 GB 逻辑大小），不应计入本地大文件。排除后：
  - **98 个本地大文件**
  - **312.0 GB**

> 本次只做复核和方案，不移动、不删除任何文件。

## 1. 分类汇总

| 类别 | 文件数 | 大小 | 说明 |
|---|---:|---:|---|
| 游戏（Steam） | 28 | 188.5 GB | 黑神话：悟空、双人成行等 `.pak` |
| 媒体视频 | 44 | 52.2 GB | `E:\Media\Videos` 下的无人机/相机视频 |
| 虚拟机/容器 | 5 | 29.4 GB | Docker vhdx、WSL ext4.vhdx |
| 系统文件 | 2 | 23.2 GB | `hiberfil.sys` 12.7 GB、`pagefile.sys` 10.5 GB |
| 其他 | 10 | 6.6 GB | 未分类大文件 |
| 代码仓库 | 2 | 6.2 GB | 其中 git pack 约 4.8 GB |
| 归档/安装包 | 7 | 6.0 GB | ISO/ZIP/7z/EXE |
| **合计** | **98** | **312.0 GB** | |

## 2. Top 本地大文件

| 大小 | 类别 | 路径 |
|---:|---|---|
| 35.18 GB | 游戏 | `D:\Program Files (x86)\Steam\steamapps\common\BlackMythWukong\...\pakchunk14-Windows.pak` |
| 25.19 GB | 游戏 | `...\BlackMythWukong\...\pakchunk15-Windows.pak` |
| 19.47 GB | 游戏 | `...\BlackMythWukong\...\pakchunk16-Windows.pak` |
| 16.73 GB | VM | `D:\Docker\wsl\disk\docker_data.vhdx` |
| 15.46 GB | 游戏 | `...\BlackMythWukong\...\pakchunk0-Windows.pak` |
| 12.82 GB | 游戏 | `D:\Program Files (x86)\Steam\steamapps\common\ItTakesTwo\...\pakchunk0-WindowsNoEditor.pak` |
| 12.74 GB | 系统 | `C:\hiberfil.sys` |
| 11.07 GB | 游戏 | `...\ItTakesTwo\...\pakchunk1-WindowsNoEditor.pak` |
| 10.70 GB | VM | `D:\wsl\Ubuntu-24.04\ext4.vhdx` |
| 10.50 GB | 系统 | `C:\pagefile.sys` |
| 10.14 GB | 媒体 | `E:\Media\Videos\2026\2026-09\DJI_20260909143031_0132_D.MP4` |
| 9.16 GB | 游戏 | `...\BlackMythWukong\...\pakchunk26-Windows_P.pak` |
| 8.51 GB | 游戏 | `...\BlackMythWukong\...\pakchunk8-Windows.pak` |
| 5.91 GB | 游戏 | `...\ItTakesTwo\...\pakchunk2-WindowsNoEditor.pak` |
| 4.81 GB | 仓库 | `E:\Personal\Reading\huazhang-cs-books\.git\objects\pack\...pack` |

## 3. 分类处理方案

### 3.1 游戏（188.5 GB）

- 路径：`D:\Program Files (x86)\Steam\steamapps\common\...`
- 这些是游戏安装文件，**不能直接删除单个 `.pak`**，否则游戏损坏。
- 处理方式：
  - 还在玩：保留，不做操作。
  - 不玩了：通过 Steam 卸载；或使用 Steam 的“移动安装文件夹”迁移到其他库。
  - 不建议手工移动/删除游戏目录。
- 预计可释放：取决于你要卸载哪些游戏，最大约 188.5 GB。

### 3.2 媒体视频（52.2 GB）

- 路径：`E:\Media\Videos\...`
- 属于个人媒体数据，**不删除**。
- 处理方式：
  - 当前活跃/近期素材：保留。
  - 超过 1 年未访问：移动到 `E:\Archive\Media\<year>\`（新方案，需确认）。
  - 移动前写 manifest，保留原文件名，重名加序号。
- 预计迁移：最多约 52.2 GB（只是移动，不释放 E: 空间）。

### 3.3 虚拟机/容器（29.4 GB）

- `D:\Docker\wsl\disk\docker_data.vhdx` 16.73 GB
- `D:\wsl\Ubuntu-24.04\ext4.vhdx` 10.70 GB
- 这些是 Docker/WSL 的磁盘镜像，**不能删除**，否则容器/发行版丢失。
- 处理方式：
  - WSL：`wsl --manage Ubuntu-24.04 --set-sparse true`（如支持）或 `Optimize-VHD` 压缩。
  - Docker：Docker Desktop 的磁盘镜像压缩/清理未使用镜像。
  - 预计可回收：取决于未使用空间，通常几 GB，需实测。

### 3.4 系统文件（23.2 GB）

- `C:\hiberfil.sys` 12.74 GB
- `C:\pagefile.sys` 10.50 GB
- **不要直接删除**。
- 如果不用休眠/快速启动：
  ```powershell
  powercfg /h off
  ```
  可释放约 12.7 GB。
- pagefile 由系统管理，不建议手动删除或关闭。

### 3.5 代码仓库（6.2 GB）

- `E:\Personal\Reading\huazhang-cs-books\.git\objects\pack\...pack` 约 4.81 GB
- 处理方式：
  - 检查大文件是否应走 Git LFS 或外部存储。
  - 不活跃仓库可打包为 bundle 后归档到 `E:\Archive\repos`。
  - 不要直接删除 `.git` 目录。

### 3.6 归档/安装包（6.0 GB）

- ISO/ZIP/7z/EXE 等。
- 处理方式：
  - 确认是否还需要安装/回滚。
  - 不需要的移到 `E:\Archive\Installers` 或删除（需逐项确认）。
  - 不建议批量删除。

## 4. 建议执行顺序

1. **先决定游戏保留清单**：卸载不玩的 Steam 游戏（最大收益 188.5 GB）。
2. **媒体归档**：确认哪些年份不再活跃，再预览移动到 `E:\Archive\Media`。
3. **压缩 WSL/Docker 镜像**：不删除，先压缩。
4. **关闭休眠**（如果不用）：`powercfg /h off`。
5. **仓库瘦身**：检查 4.8 GB git pack，考虑 LFS/归档。
6. **安装包/ISO**：逐项确认后归档或删除。

## 5. 需要你确认

1. 哪些 Steam 游戏可以卸载？
2. `E:\Media\Videos` 哪些年份可以归档？
3. 是否关闭休眠？
4. 是否处理 `huazhang-cs-books` 的 git pack？
5. 6 GB 归档/安装包是否要逐项复核？

确认前不会移动或删除任何大文件。
