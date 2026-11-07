# pc-manager GUI

一个本地 Web 控制台：左侧功能侧栏 + 右侧内容，读取 `reports/scan-*.json`，在浏览器里查看磁盘分析结果，勾选清理项，先预览、再确认、最后执行。任务运行时顶部显示进度条，点击可查看详情和取消。

- **零依赖**：只用 Node.js 内置模块（`node:http`、`node:fs`、`node:child_process` 等），不需要 `npm install`。
- **Node 版本**：Node.js 22+；推荐 Node.js 26。当前机器已验证 Node.js 25.2。
- **默认地址**：`http://127.0.0.1:7788/`
- **只监听本机**：默认只绑定 `127.0.0.1`，并校验 Origin，避免被网页跨站调用。

## 启动

从项目根目录：

```powershell
# 方式一：直接运行
node gui/server.mjs --open

# 方式二：PowerShell 启动器（默认打开浏览器）
pwsh -File scripts\start-gui.ps1

# 需要清理系统缓存时，以管理员身份启动
pwsh -File scripts\start-gui.ps1 -Admin
```

也可以指定端口：

```powershell
node gui/server.mjs --port 7800 --open
```

## 能做什么

| 页面 | 内容 |
|---|---|
| 概览 | 健康分、CPU/内存/显卡/主板/物理磁盘、存储分配、Top 占用和审计发现 |
| 清理 | 垃圾候选列表，按安全等级/分类筛选，搜索，批量选择，预览后执行 |
| 磁盘 | 每个磁盘的容量、Top 目录、文件类型、大文件、云占位、空目录/Junction 统计 |
| 应用 | 软件概况：可更新数量、建议卸载数量、使用记录；自动调用 winget 检查更新，按 Prefetch/UserAssist 估算上次使用时间；支持筛选和图标化卸载 |
| AI 建议 | 根据扫描结果生成可编辑、可复制的任务指令；复制给 AI 助手执行 |

> 迁移和诊断信息已合并到“概览”和“AI 建议”：迁移进入 AI 建议，孤立项/大文件/空目录进入概览的审计发现。

还可以直接在 GUI 里发起新扫描：列出本机所有固定磁盘，默认全选，可单独取消；支持快速模式、并行、排除目录。扫描进度显示在顶部任务条，点击任务条查看日志、逐项进度和取消按钮。

### AI 建议怎么工作

`AI 建议` 是本地分析引擎，不上传扫描数据。它把复杂操作转成可编辑、可复制的任务指令，并固定按三类分组：

1. **媒体文件建议**：视频/照片按年月归档、媒体目录合并、媒体压缩包核对。
2. **工程文件建议**：大目录迁移、项目工作区/仓库整理、构建产物和依赖处理。
3. **缓存管理文件建议**：安全缓存清理、旧安装包/回收站、临时文件和系统残留。

例如：

- **视频/照片按年月归档**：识别扫描里的媒体目录，自动选择另一块空闲磁盘作为目标，生成 `YYYY\YYYY-MM` 归档指令。
- **安全缓存清理**：只选 `safe` 等级的缓存/临时文件；`confirm` 等级单独给出高风险建议。
- **大目录迁移**：从 `Migration` 候选生成移动 + junction 指令。
- **空间策略**：读取 `Audit.Findings`，把健康分、路径卫生、下载分散、工作区分散、大压缩包、云占位等问题转成可复制建议。

每条建议包含：任务目标、源/目标路径、执行步骤、安全限制、审计证据、项目根目录和可用入口。你可以直接修改文本框里的内容，然后点“复制”粘贴给 AI 助手执行。AI 页不再直接执行任何移动/清理操作；执行仍由 AI 助手在你确认后完成。

每张卡片还可以“忽略”，忽略状态按扫描结果保存在浏览器 localStorage 中，可通过页头的“恢复忽略”找回。页头的“复制分析提示词”会复制一段完整的 agent 分析任务，而不是重新运行本地规划器。

## 安全模型

1. **扫描 / 预览只读**：`measure` 动作只重新测量大小，不删除任何文件。
2. **执行必须显式确认**：前端必须勾选确认框；服务端要求 `confirm: true`；如果包含 `confirm` 等级项目，还要求 `acknowledgeRisky: true`。
3. **服务端二次校验**：
   - 只接受当前 scan JSON 的 `Junk` 列表里存在的路径，不能通过 API 删除任意路径。
   - 拒绝 `WinSxS`、`Windows\Installer`、`Package Cache`、pagefile/hiberfil 等受保护路径。
   - 拒绝直接清理磁盘根目录、`Windows`、`Program Files`、用户目录等危险根。
   - `review` 等级项目直接拒绝。
4. **管理员边界**：`elevated` 项目在非管理员会话中会被跳过，并在结果里说明。
5. **Manifest**：每次真正执行都会写入 `reports/clean/<timestamp>/manifest.csv`，包含路径、分类、大小、状态、错误原因。GUI 提供“打开报告文件夹”按钮。
6. **可取消**：扫描/清理任务在运行中可以取消。

> 注意：GUI 能删除文件，不要把它暴露到不可信网络。需要远程访问时必须自己加认证和 TLS。

## API 摘要

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 版本、是否管理员、系统盘 |
| GET | `/api/drives` | 本机固定磁盘及容量 |
| GET | `/api/scans` | 扫描结果列表（按修改时间倒序） |
| GET | `/api/scans/:id` | 精简后的扫描 JSON（去掉超大的 EmptyDirs/ReparsePoints） |
| GET | `/api/ai/plans/:id` | 根据扫描结果生成 AI 建议计划 |
| POST | `/api/scan` | 启动扫描任务（支持多盘） |
| POST | `/api/clean/preview` | 重新测量所选项目（只读） |
| POST | `/api/clean/execute` | 执行清理（必须确认） |
| GET | `/api/apps/insights/:id` | winget 更新检查、上次使用时间估算、卸载建议 |
| POST | `/api/apps/uninstall` | 调用应用卸载程序（必须确认） |
| POST | `/api/ai/preview` | 运行 AI 计划预览（只读） |
| POST | `/api/ai/execute` | 执行 AI 计划（必须确认） |
| GET | `/api/jobs/:id` | 任务状态与结果 |
| GET | `/api/jobs/:id/events` | SSE 实时日志/进度 |
| POST | `/api/jobs/:id/cancel` | 取消任务 |
| POST | `/api/relaunch` | 请求以管理员模式重启 GUI（UAC） |
| POST | `/api/open` | 在资源管理器中打开报告目录 |

## 目录结构

```
gui/
  server.mjs          HTTP 服务、API、任务调度
  bridge.ps1          调用 PowerShell 清理函数，输出 NDJSON 进度
  lib/
    config.mjs        路径和默认值
    scans.mjs         扫描文件读取、精简、缓存
    safety.mjs        路径保护、扫描项白名单校验
    jobs.mjs          任务与 SSE 订阅
    ps.mjs            pwsh 子进程、逐行输出、管理员检测
  public/
    index.html
    app.js            无框架前端
    styles.css
  test/               Node 内置 test runner 测试
```

## 测试

```powershell
# Node 单元/接口测试
cd gui
npm test
# 或
node --test "test/*.test.mjs"

# PowerShell 清理函数冒烟测试（只操作 tests/tmp）
pwsh -File tests\smoke-clean-selection.ps1

# 项目原有校验
pwsh -File tests\validate.ps1
```

## 故障排查

- **打不开页面**：确认端口没被占用；服务会自动从 7788 往后找空闲端口，启动日志里会打印实际地址。
- **`pwsh` 找不到**：GUI 默认调用 `pwsh`。可通过环境变量 `PC_MANAGER_PWSH` 指定完整路径。
- **系统缓存一直跳过**：当前进程不是管理员。用 `scripts\start-gui.ps1 -Admin` 重新启动。
- **扫描结果不更新**：清理后原始 scan JSON 不会变化；重新扫描即可。GUI 不会篡改历史报告。
- **OneDrive 路径**：扫描和清理都会跳过云占位，不会把逻辑大小当成本地占用。
