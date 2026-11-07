# Report schema

`pc-manager scan` writes `reports/scan-<timestamp>.json`.

## Top level

| Field | Type | Meaning |
|---|---|---|
| `SchemaVersion` | int | Schema version (currently 1) |
| `GeneratedAt` | string | ISO-like local timestamp |
| `Computer` | string | Computer name |
| `User` | string | Current user |
| `OS` | string | OS version string |
| `FastMode` | bool | Whether `-Fast` was used |
| `ScanSeconds` | number | Total scan time |
| `Drives` | array | Per-drive inventory |
| `InstalledApps` | array | Top installed apps by estimated size |
| `Orphans` | object | Orphaned uninstall entries, broken startup entries, orphaned Store data |
| `Junk` | array | Cleanup candidates with safety levels |
| `Migration` | array | Migration candidates |
| `Media` | object | Photo/video/audio summary |
| `Recommendations` | array of strings | Generated suggestions |

## Drive

| Field | Type | Meaning |
|---|---|---|
| `Id` | string | `C:`, `D:`, ... |
| `Root` | string | `C:\` |
| `TotalGB` / `FreeGB` / `UsedGB` | number | Capacity |
| `TotalFiles` | int | Number of files |
| `TotalSizeGB` | number | Sum of file sizes |
| `DirCount` | int | Number of directories |
| `TopFolders` | array | `{Name, SizeGB, Files}` |
| `Extensions` | array | `{Ext, Count, SizeGB, Kind}` |
| `LargeFiles` | array | `{Path, SizeMB, Modified}` |
| `EmptyDirs` | array of strings | Empty directories |
| `ReparsePoints` | array of strings | Junctions/symlinks |
| `Cloud` | array | `{Path, LogicalGB, LocalGB, Files, LocalFiles}` |
| `ScanSeconds` | number | Time for this drive |

## Junk candidate

| Field | Meaning |
|---|---|
| `Name` | Display name |
| `Path` | Absolute path |
| `SizeMB` / `SizeGB` | Measured size |
| `Category` | `cache`, `updater`, `system`, `recycle`, `installer`, `orphan` |
| `Safety` | `safe`, `elevated`, `confirm`, `review` |
| `Mode` | `path`, `contents`, `recycle`, `review` |
| `Reason` | Human-readable explanation |

## Migration candidate

| Field | Meaning |
|---|---|
| `Name` | Display name |
| `Path` | Current path |
| `SizeGB` | Size |
| `SuggestedTarget` | Suggested destination |
| `Reason` | Why / how |

## Media

| Field | Meaning |
|---|---|
| `PhotoGB` / `PhotoCount` | Photos |
| `VideoGB` / `VideoCount` | Videos |
| `AudioGB` / `AudioCount` | Audio |
| `MediaFolders` | `{Drive, Folder, SizeGB, Files}` |

## Orphans

| Field | Meaning |
|---|---|
| `UninstallEntries` | DisplayName, version, install location, uninstall string |
| `RunKeys` | Key, name, command |
| `AppxData` | Package, SizeMB |

## Notes

- Sizes are computed by a stack walk that skips junctions and, for local usage, cloud placeholders.
- `WinSxS` sizes are not reported separately; do not use them as real disk usage.
- `Junk` sizes may change between scan and clean; re-measure before destructive actions when precision matters.
