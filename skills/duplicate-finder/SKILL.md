---
name: Duplicate Finder
description: 当用户要查找重复照片、视频或文件，或释放重复占用空间时使用。
---

# Duplicate Finder

## 方法

1. 只处理 >= 1 MB 的文件。
2. 先按大小分组，减少哈希量。
3. 同大小文件计算 SHA-256。
4. 同哈希视为重复；默认保留修改时间最新的一个。
5. 重复项**移动到隔离区**，不直接删除。

## 命令

预览：

```powershell
pwsh -File pc-manager.ps1 dedupe -Source E:\Photos
```

执行（移动到隔离区）：

```powershell
pwsh -File pc-manager.ps1 dedupe -Source E:\Photos -Execute
```

只报告、不移动：

```powershell
pwsh -File pc-manager.ps1 dedupe -Source E:\Photos -KeepDuplicates
```

## 隔离区

- 优先 `D:\Backup\duplicates\<timestamp>\`
- 没有 D 盘时使用 `%USERPROFILE%\pc-manager-quarantine\<timestamp>\`
- 会生成 `manifest.csv`，记录原路径和新路径

## 注意

- 同名不同内容的文件不是重复（相机编号复用很常见）。
- 照片 RAW 和 JPG 不是重复，它们是同一张的不同格式。
- 不要对系统目录、游戏目录、`node_modules` 做去重。
- 移动前确认目标盘空间足够。
