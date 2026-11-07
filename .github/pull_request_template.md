## Summary

What does this PR change and why?

## Changes

-
-

## Safety checklist

- [ ] `scan` and `report` remain read-only
- [ ] Destructive actions still require `-Execute`
- [ ] No user data is deleted; moves/quarantine write a manifest
- [ ] System-critical paths are untouched (`WinSxS`, `Windows\Installer`, `Package Cache`, pagefile, hiberfil)
- [ ] Admin-only items are skipped when not elevated
- [ ] Cloud placeholders and junctions are handled correctly

## Testing

- [ ] `pwsh -File tests/validate.ps1`
- [ ] `pwsh -File tests/validate.ps1 -Smoke` (optional)
- [ ] Manual dry-run of the affected command

## Notes

Anything reviewers should know.
