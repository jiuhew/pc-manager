# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private advisory form:

https://github.com/jiuhew/pc-manager/security/advisories/new

Include:

- A description of the issue and its impact
- Steps to reproduce
- Affected version / commit
- Whether it can cause data loss, privilege escalation, or command injection
- Any suggested fix

## Scope

pc-manager runs local PowerShell and can delete or move files when `-Execute` is used. Security-relevant areas include:

- Path handling in `clean`, `organize`, `dedupe`
- Command injection through paths or config values
- Elevation boundaries (`-Admin`, `Start-Process -Verb RunAs`)
- Accidental deletion of user data or system paths
- Leakage of file paths or personal data in reports
- Skill installation writing outside the intended directory

## Safe defaults

- `scan` and `report` are read-only.
- `clean`, `dedupe`, and `organize` require `-Execute`.
- Duplicates are moved to quarantine, not deleted.
- Moves and quarantine write CSV manifests.
- System-critical paths are excluded.

## Disclosure

We will acknowledge a report, investigate, and coordinate a fix and disclosure timeline with you.
