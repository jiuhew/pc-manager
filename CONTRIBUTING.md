# Contributing

Thanks for helping improve pc-manager.

## Requirements

- Windows 10/11
- PowerShell 7+
- Git

## Development

```powershell
git clone https://github.com/jiuhew/pc-manager.git
cd pc-manager
pwsh -File tests/validate.ps1
```

Optional smoke scan:

```powershell
pwsh -File tests/validate.ps1 -Smoke
```

## Project layout

| Path | Purpose |
|---|---|
| `pc-manager.ps1` | CLI entry |
| `lib/` | Core modules, dot-sourced by the CLI |
| `skills/` | AI skill library |
| `docs/` | Safety, schema, naming, iteration log |
| `tests/` | Validation and feature smoke tests |

## Safety rules

Read [docs/safety.md](docs/safety.md) before changing cleanup, organize, or dedupe code.

- `scan` and `report` must never modify user files.
- Destructive actions require `-Execute`.
- Never delete user data; move to quarantine or write a manifest.
- Never delete `WinSxS`, `Windows\Installer`, `Package Cache`, pagefile, or hiberfil.
- `elevated` items must be skipped when not running as Administrator.
- Do not treat cloud placeholder logical sizes as local usage.

## PowerShell style

- Targeted at PowerShell 7+.
- Use `-LiteralPath`, `-Recurse`, `-Force`, `-Confirm:$false`.
- Do not name helper functions `Rm`, `Del`, `Move`, `Copy` (alias collisions).
- Suppress .NET method return values with `[void]` when appending to a `StringBuilder`.
- Avoid smart quotes in `.ps1` files.
- Keep scripts ASCII where practical; Chinese belongs in docs/skills.

## Adding a skill

1. Create `skills/<skill-id>/SKILL.md`.
2. Add frontmatter:

```markdown
---
name: My Skill
description: When the model should use this skill.
---
```

3. Document the workflow, commands, and safety rules.
4. Run `pwsh -File scripts/install-skills.ps1 -Path <temp-dir>` to verify.
5. Add the skill to the table in `README.md`.

## Commit messages

Use a simple conventional prefix:

- `feat:` new capability
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `chore:` maintenance

## Pull requests

- Keep changes focused.
- Describe the safety impact.
- Include test commands and results.
- Link related issues.
