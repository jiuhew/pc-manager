# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-07

### Added

- `pc-manager scan`: full and fast inventory of all fixed Windows drives.
- Markdown and HTML reports with disk overview, top folders, file types, cloud placeholders, junk candidates, migration candidates, media inventory, orphans, and recommendations.
- `pc-manager clean`: safety-graded cleanup (`safe`, `elevated`, `confirm`, `review`) with dry-run by default.
- `pc-manager organize`: directory move + junction, and year/month photo organizer with manifest.
- `pc-manager dedupe`: size grouping + SHA-256, quarantine instead of deletion, CSV manifest.
- Six AI skills: `pc-inventory`, `disk-cleanup`, `photo-organizer`, `document-organizer`, `duplicate-finder`, `app-migration`.
- Cloud placeholder detection (`0x400000`, `0x1000`, `0x100000`), junction detection, and local-vs-logical size reporting.
- Documentation: report schema, naming conventions, safety rules, iteration log.
- GitHub Actions validation workflow.

### Changed

- README uses a centered title, description, badges, and table of contents.

### Fixed

- `-Input` parameter conflicted with PowerShell's automatic `$Input` variable; renamed to `-ScanPath`.
- `StringBuilder.Append` return values leaked into reports, producing `System.Object[]` and duplicated content.
- Protected paths could throw from `Test-Path`; all checks now use `-ErrorAction SilentlyContinue`.
- `-Drives C,D,E` was parsed as a single string; comma and space separated drives are supported.
- Migration candidates no longer suggest directories that are already junctions.
- Duplicate `%TEMP%` and `%LOCALAPPDATA%\Temp` entries are deduplicated.
- Photo organizer skips already-organized `YYYY` and `YYYY-MM_*` directories.

[Unreleased]: https://github.com/jiuhew/pc-manager/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jiuhew/pc-manager/releases/tag/v0.1.0
