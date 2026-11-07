# AGENTS.md

Instructions for AI agents working in this repository.

## Project

`pc-manager` is a PowerShell toolkit that inventories Windows disks and provides AI skills for cleanup, migration, photo organization, document organization, and deduplication.

## Rules

1. **Read-only by default.** `scan` and `report` must never modify user files.
2. **Destructive actions require `-Execute`.** Never add implicit deletion.
3. **Never delete user data.** Photos, chats, drafts, databases, downloads are moved or backed up, not deleted.
4. **Never delete system-critical paths.** `WinSxS`, `Windows\Installer`, `Package Cache`, pagefile, hiberfil.
5. **Dry-run first.** New cleanup/organize features must support a dry-run path.
6. **Manifest everything.** Moves and duplicate quarantine must write a CSV manifest.
7. **Admin boundary.** System paths require an elevated session; skip with a clear message otherwise.
8. **PowerShell pitfalls.**
   - Do not name helper functions `Rm`, `Del`, `Move`, `Copy` (alias collisions).
   - Use `-LiteralPath`, `-Recurse`, `-Force`, `-Confirm:$false`.
   - Avoid smart quotes in `.ps1` files.
   - Keep scripts ASCII where possible.
9. **OneDrive/cloud placeholders.** Do not treat logical size as local usage. Do not move placeholders.
10. **WinSxS hardlinks.** Do not compute size naively or delete directly.

## Validation

Run:

```powershell
pwsh -File tests\validate.ps1
```

Optional smoke test:

```powershell
pwsh -File tests\validate.ps1 -Smoke
```

## Style

- PowerShell 7+.
- Functions in `lib/*.ps1`, dot-sourced by `pc-manager.ps1`.
- Return structured objects (PSCustomObject) from library functions.
- Console output is for humans; JSON is for AI.
- Keep functions small and testable.
