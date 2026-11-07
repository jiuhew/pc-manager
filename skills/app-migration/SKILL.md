---
name: App Migration
description: 当用户要把软件、开发环境、游戏或数据从 C 盘迁移到其他盘时使用。
---

# App Migration

## 通用目录迁移

```powershell
# 1. 关闭占用进程
# 2. 预览
pwsh -File pc-manager.ps1 organize -Source "C:\path\app" -Destination "D:\path\app"

# 3. 执行（移动 + 原路径 junction）
pwsh -File pc-manager.ps1 organize -Source "C:\path\app" -Destination "D:\path\app" -Execute
```

## 常见场景

| 项目 | 方法 |
|---|---|
| Anaconda / Miniconda | 移动整个安装目录 + junction，保留 PATH |
| Docker Desktop | 移动 `%LOCALAPPDATA%\Docker\wsl` + junction，或在设置里改 Disk image location |
| WSL 发行版 | `wsl --export` → `--unregister` → `--import` 到 D → `/etc/wsl.conf` 恢复 `[user] default` |
| GitHub 仓库 | 直接移动，git 可移植 |
| CUDA / Windows SDK / VS | 重装到 D 更稳 |
| Store 应用 | 设置 → 应用 → 移动；新应用位置在“新内容的保存位置” |
| 游戏 | 通过 Steam/Epic 的库管理移动 |

## 不要做

- 不要修改 `ProgramFilesDir` 注册表（微软不支持，会破坏更新）。
- 不要删除原目录后再复制，先移动并验证。
- 不要对正在运行的程序目录做迁移。
- 不要忘记给原路径建 junction，否则硬编码路径会失效。

## 验证

```powershell
conda --version
git -C D:\GitHub\repo status
docker info
wsl -d Ubuntu-24.04 -- whoami
```
