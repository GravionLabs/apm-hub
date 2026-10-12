---
name: skill-audit
description: 'Audit one skill against the writing rules and report findings. Use to check a single skill.'
---

Audit one skill against the repo's skill-writing rules and report findings by severity.

## Prerequisites

- Skill path
- Read `../skill-write/references/skill-writing-rules.md` (the rules) and `references/audit-checklist.md` (the checks)

Paths to `scripts/`, `references/` and `assets/` are relative to this skill's directory.

## Instructions

1. Read `{skill-dir}/SKILL.md` and list every file under `{skill-dir}/`.
2. Run the checklist across frontmatter, body, `scripts/`, `references/` and `assets/`.
3. Record each finding as severity, category, finding, recommendation.
4. If findings exist → show them grouped 🔴 → 🟡 → 🟢 and offer to apply them via `skill-update`; otherwise report PASS.

## Gotchas

- A zero-finding report is valid; do not invent fixes.
- `bash`/`sh` fences and forbidden frontmatter keys are always 🔴 and must be fixed; everything else is the user's call.
- Do not run `skill-update` without the user's go.

Report: `Audit: <name> — PASS (<n> checks)` or `FINDINGS (<n> 🔴 · <m> 🟡 · <x> 🟢)`, followed by the findings list and `Re-audit: skill-audit <skill-path>`.
