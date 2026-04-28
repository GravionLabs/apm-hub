# Skill Audit: development-angular-update

Audited: packages/development-angular/.apm/skills/development-angular-update
Date: 2026-04-26
Updated: 2026-04-26 (post-remediation)

## Summary

0 critical · 0 important · 0 suggestions

## Passed checks

- Location: correctly placed in `packages/development-angular/.apm/skills/development-angular-update/`
- `name`: present, matches directory name exactly (`development-angular-update`), valid kebab-case, 1–64 chars
- `description`: present and under 1,024 characters
- `description`: uses `>` folded scalar (multi-sentence)
- `description`: imperative phrasing ("Use this skill when…")
- `description`: three-part formula — what it does + when to use + key capabilities
- `description`: indirect trigger phrase included ("even if the user does not explicitly mention ng update or Angular versioning")
- `description`: scope is appropriately specific — not overly broad
- `allowed-tools`: full cross-platform set present (`execute read edit search codebase editFiles runCommands`)
- `allowed-tools`: `runCommands`/`execute` listed with inline shell commands present in body; all commands are safe Angular CLI operations
- Body length: well within the 500-line limit
- Token count: well within the 5,000-token guideline
- Step-by-step workflow is numbered (Steps 1–5)
- `## Gotchas` section present: one-major-at-a-time, test after each bump, separate material/ngrx update, standalone schematic three-pass, control-flow idempotency
- No generic or vague advice — commands are concrete and actionable
- No `references/` directory — no conditional load checks required
- No `scripts/` directory — script checks skipped
- No `assets/` directory — asset checks skipped
- No equal alternatives listed without a default
- Redundant opening prose line removed from body
