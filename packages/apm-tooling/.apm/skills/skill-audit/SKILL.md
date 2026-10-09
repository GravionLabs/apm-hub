---
name: skill-audit
description: >
  Use this skill to audit, validate, or review a skill and emit a compact JSON
  report, even if the user only says to check it or verify it.
metadata:
  chronicle-hints: 'single-purpose, structured-output, phases'
---

## Overview

Audit a skill, show the user a summary report, and automatically apply fixes via skill-update (with user confirmation for important findings).
Avoid verbose reasoning.

## Prerequisites

- Skill path
- Read `references/frontmatter-schema.md`
- Read `references/audit-checklist.md`
- If the skill includes CLI examples, scripts, or output-format guidance, read
  `references/tool-efficiency-guidance.md`
- If you are preparing the final audit response, read
  `assets/audit-output-template.md`

## Instructions

### Phase 1 — Load & Analyze

✓ Checkpoint: Skill loaded and content structure understood

1. Read `{skill-dir}/SKILL.md` and list files in `{skill-dir}/`.
2. **Check for CLI content:** If the skill contains code blocks, shell command
   examples, scripts in `scripts/`, or output-format guidance → **immediately
   read `references/tool-efficiency-guidance.md`** before proceeding.
3. **Shell enforcement:** Check all code blocks and shell examples. Flag any use
   of ` ```bash `, ` ```sh `, or other shells. **All shell code must use
   ` ```powershell `** — report this as 🔴 critical if any non-PowerShell
   shells are found.

### Phase 2 — Audit & Report

✓ Checkpoint: All checks complete; findings ready

4. Run the checklist across frontmatter, body, references and assets.
5. Apply tool-efficiency guidance to all CLI examples and command output in the
   skill (if step 2 applied).
6. Record each finding as severity, category, finding, and recommendation.
7. **Display audit report to user:**
   - Show summary (passed checks + any findings)
   - Format findings by severity (🔴 critical → 🟡 important → 🟢 suggestions)

### Phase 3 — Remediate (if needed)

✓ Checkpoint: User decision made; fixes applied or cancelled

8. **Decision flow:** If findings exist (any severity) → ask user:
   "Apply these fixes with skill-update?" (choices: Yes / Review findings
   first / Cancel).
   - If user confirms → invoke skill-update with the skill path
   - Otherwise if user chooses "Review" → show full findings list and
     ask again
   - Otherwise → stop without remediation
9. Otherwise → report as ✅ PASS and done.

## Gotchas

- A zero-finding report is valid — don't force fixes if nothing's broken.
- The directory name must match `name` in frontmatter.
- Frontmatter `model` (like `allowed-tools` and `compatibility`) is a forbidden top-level key — report it as 🔴.
- Do not proceed with skill-update if user cancels.
- Critical findings (shell enforcement) should always be fixed — don't skip them.

## Output Format

If you are ready to present the audit result, read
`assets/audit-output-template.md` and fill in the placeholders.
