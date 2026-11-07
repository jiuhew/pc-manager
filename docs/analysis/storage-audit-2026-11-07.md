# Storage audit

- Generated: 2026-11-07T18:10:54
- Computer: SISYPHUS
- Health score: **88/100** (grade A)

## Capacity
| Drive | Role | Total GB | Used GB | Free GB | Free % | Status |
|---|---|---|---|---|---|---|
| C: | OS + applications + caches | 506.61 | 235.31 | 271.3 | 53.6% | ok |
| E: | Media + archive | 700 | 248.59 | 451.41 | 64.5% | ok |
| D: | Active work + games + projects | 700 | 287.56 | 412.44 | 58.9% | ok |

Total: 771.5 GB used of 1,906.6 GB (40.5%).

## Workload
- Cleanable: 0.7 GB (safe 0.7, confirm 0.0, elevated 0.0)
- Media: 399.2 GB (photo 168.6, video 230.6)
- Apps (estimated): 44.4 GB
- Downloads (top-level): 0.9 GB
- Cloud: logical 269.9 GB / local 11.0 GB

## Findings
### P2
| Category | Finding | Evidence | Action |
|---|---|---|---|
| cloud | Cloud placeholder folder has a large logical/local gap | 80736 logical files, 19904 local files | Keep placeholders in place; use the cloud client to manage offline availability. |
| path | Many empty directories | 78451 empty directories | Review empty directories before removing; keep ones required by tools. |
| review | Large files deserve a periodic review | 98 large files totaling 312.0 GB | Review the largest files; archive to cold storage or delete only after confirming ownership. |
| system | Hibernation file is large | hiberfil.sys = 12.7 GB | If hibernation is unused, run powercfg /h off as administrator; otherwise keep it. |

## Tier plan
| Drive | Role | Budget |
|---|---|---|
| C: | OS + applications + caches | OS/apps <= 35%; user data <= 25%; free >= 15% |
| E: | Media + archive | archive/media <= 70%; backups <= 20%; free >= 10% |
| D: | Active work + games + projects | active projects <= 25%; media <= 45%; free >= 10% |

## Top consumers
| Path | Size GB | Files |
|---|---|---|
| C:\Users | 320.67 | 491428 |
| E:\Media | 223.57 | 16433 |
| D:\Program Files (x86) | 217.69 | 53869 |
| C:\Windows | 58.18 | 261059 |
| C:\Program Files | 43.15 | 102404 |
| D:\anaconda3 | 22.11 | 531076 |
| C:\Program Files (x86) | 20.83 | 60282 |
| E:\Personal | 16.96 | 780 |
| D:\Docker | 16.86 | 2 |
| C:\hiberfil.sys | 12.74 | 1 |
| D:\wsl | 10.7 | 1 |
| C:\pagefile.sys | 10.5 | 1 |
| C:\ProgramData | 8.59 | 19960 |
| E:\Box | 6.59 | 3072 |
| D:\AppData | 6.53 | 32618 |
| D:\Archive | 3.34 | 144 |
| D:\迅雷下载 | 0.86 | 42 |
| E:\Projects | 0.76 | 249 |
| D:\Program Files | 0.74 | 1128 |
| E:\Photos | 0.37 | 7 |

## Recommended actions
- Keep placeholders in place; use the cloud client to manage offline availability.
- Review empty directories before removing; keep ones required by tools.
- Review the largest files; archive to cold storage or delete only after confirming ownership.
- If hibernation is unused, run powercfg /h off as administrator; otherwise keep it.
