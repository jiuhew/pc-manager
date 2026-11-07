---
name: Photo Organizer
description: 当用户要整理照片/视频、按年份/事件分类、统一文件夹命名、处理照片重复或归档压缩包时使用。
---

# Photo Organizer

## 目录规范

```
<照片根目录>\
├── 2024\
│   ├── 2024-11_日本旅行\
│   ├── 2024-12_圣诞派对\
│   └── ...
├── 2025\
├── 2026\
├── 归档\       压缩包、长期不用的资料
├── 素材\       PSD、海报、模板
└── 精修\       导出成片
```

## 命名规则

1. 统一 `YYYY-MM_事件或地点`，例如 `2026-09_科莫多`、`2025-01_日本旅行`。
2. 同一层级只用一种语言；空格换成 `_` 或 `-`。
3. 每个事件内部可按 `RAW\`、`JPG\`、`VIDEO\`、`精修\`、`素材\` 再分。
4. 保留相机原始文件名（`IMG_xxxx.CR3`、`DJI_xxxx.MP4`），不要逐张改名。
5. 压缩包移到 `归档\`；解压校验后再删除 zip。
6. 同名不同扩展名的文件（CR3 + JPG + LRF）作为一组一起移动。

## 拍摄时间

默认读取 JPEG/TIFF 的 EXIF `DateTimeOriginal`（0x9003），比文件修改时间更准确。
HEIC/CR3/RAW 需要系统里有 `exiftool`（安装后自动使用）；没有时回退到文件时间。可用 `-NoExif` 关闭。

## 工作流

1. 先扫描媒体：

```powershell
pwsh -File pc-manager.ps1 scan -Drives E
```

2. 生成整理计划（dry-run，只打印不移动）：

```powershell
pwsh -File pc-manager.ps1 organize -Source E:\Photos
```

3. 检查映射后执行：

```powershell
pwsh -File pc-manager.ps1 organize -Source E:\Photos -Execute
```

4. 执行后会生成：
   - `organize-manifest.csv`：源路径 -> 目标路径
   - `README_FOLDER_CONVENTION.md`：目录规范

## 规则

- 永远先 dry-run，再执行。
- 只移动，不删除；重复项移到隔离区。
- 不要移动云占位文件（OneDrive/iCloud）。
- 处理 `杂`、`未分类` 这类目录时，按文件年月拆分，但保留同名文件组。
- 深层 Google Takeout 目录可拍平，但要保留原始子目录作为相册子集。
