# Safety

## Safety levels

| Level | Meaning | Action |
|---|---|---|
| `safe` | Regenerable cache/update package | Can clean without admin |
| `elevated` | System cache/log/service path | Requires Administrator |
| `confirm` | Recycle bin, old installer, orphan data | Ask the user first |
| `review` | Registry entry or ambiguous leftover | Report only; do not auto-delete |

## Never delete directly

- `C:\Windows\WinSxS` — use DISM.
- `C:\Windows\Installer` — use PatchCleaner.
- `C:\ProgramData\Package Cache` — repair cache.
- `pagefile.sys`, `hiberfil.sys`, `swapfile.sys` — use system settings.
- `C:\Recovery`, `C:\System Volume Information`, `C:\Config.Msi`.
- User documents, photos, chats, drafts, databases, downloads.
- Installation directories of running programs.

## Before destructive actions

1. Run `scan` and review the report.
2. Run `clean` / `dedupe` / `organize` without `-Execute` (dry-run).
3. Confirm totals and paths with the user.
4. For moves, write a manifest.
5. For deletions, prefer quarantine/backup when feasible.
6. Record before/after free space.

## Admin boundary

- `C:\` root files, `Program Files`, `ProgramData`, services, HKLM.
- `$WinREAgent`, `SoftwareDistribution`, `Windows\Logs`.
- `C:\inetpub` only if IIS is not installed and the folder is empty.

If not elevated, skip `elevated` items with a clear message.

## Cloud placeholders

- OneDrive/iCloud placeholder files can have huge logical sizes but near-zero local usage.
- Do not move or delete them as "large files".
- Use the `Cloud` section of the report to show logical vs local.

## Duplicates

- Group by size, then SHA-256.
- Same name is not proof of duplication (camera filenames wrap).
- RAW/JPG are different formats, not duplicates.
- Move duplicates to quarantine; never delete in place.
