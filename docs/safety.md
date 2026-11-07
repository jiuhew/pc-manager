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

## GUI cleanup

The optional web GUI (`gui/`) keeps the same boundaries:

1. The server accepts only paths that exist in the selected scan's `Junk` list; arbitrary paths are rejected.
2. `review` items are rejected; `elevated` items are skipped when the process is not elevated.
3. Protected paths and dangerous roots (drive root, `Windows`, `Program Files`, `ProgramData`, user profile roots) are refused in both Node and PowerShell.
4. Execution requires `confirm: true`, plus `acknowledgeRisky: true` when any selected item is `confirm` level.
5. Preview is read-only and re-measures current sizes.
6. Every real execution writes `reports/clean/<timestamp>/manifest.csv`.
7. The server binds to `127.0.0.1` by default and rejects cross-origin mutating requests.
8. AI plans are validated against the scan: cleanup paths must exist in `Junk`, media sources must be scanned media folders, and migration sources must be scanned migration candidates. Destinations are checked against protected paths and source containment.
9. App uninstall does not delete installation folders directly. It re-reads the uninstall entry from the registry (matching the scan by name/version/command) and runs the app's own uninstaller. The user must confirm first.
