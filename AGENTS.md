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
11. **GUI boundary.** The optional `gui/` layer must keep scan and preview read-only. Execute requires explicit confirmation, must resolve client paths against the selected scan's `Junk` list, and must write a manifest. AI plans must be validated against scan allowlists (media folders, migration candidates) before execution. App uninstall must re-read the registry entry instead of trusting a command from the scan JSON.
12. **Storage strategy.** `docs/storage-strategy.md` is the source of truth for capacity budgets, directory conventions, repo space rules, and P0/P1/P2 thresholds. Use `pc-manager audit` / `Invoke-StorageAudit`; never turn a finding into a destructive action without preview and user confirmation.

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
