---
name: agent-audit
description: >
  Audits, validates, or reviews a custom agent file (.agent.md) and emits a
  compact JSON report. Use this skill when checking an agent for correctness,
  even if the user only says to verify or review it.
allowed-tools: read search codebase write edit editFiles execute shell runCommands
model: claude-sonnet-4.6
chronicle-hints: 'single-purpose, structured-output, phases'
---

## Overview

Audit an agent file, show the user a summary report, and automatically apply fixes via `agent-update` (with user confirmation for important findings).

## Prerequisites

- Agent path (`.agent.md` file or containing directory)
- Read `references/frontmatter-schema.md`
- Read `references/audit-checklist.md`
- If the agent uses `model:` or a body-level "Model hint" → read `references/model-selection.md`
- If you are preparing the final audit response → read `assets/audit-output-template.md`

## Instructions

### Phase 1 — Load & Analyze

✓ Checkpoint: Agent file loaded and structure understood

1. Read the `.agent.md` file and list any sibling `references/` and `assets/` items.
2. **Check for model guidance:** If the agent has `model:` or body "Model hint" → **read `references/model-selection.md`** and treat `model` as a repo-local convention.
3. **Shell enforcement:** Check all code blocks. Flag any ` ```bash ` or ` ```sh `. All shell must use ` ```powershell ` — report 🔴 critical if any non-PowerShell shells are found.

### Phase 2 — Audit & Report

✓ Checkpoint: All checks complete; audit-report.json written

4. Run the checklist from `references/audit-checklist.md` across frontmatter, body, tools, and cross-platform compatibility.
5. Record each finding: severity, category, finding, recommendation.
6. **Write `{agent-dir}/audit-report.json`** as an archive (not for inter-tool communication).
7. **Display audit report to user:**
   - Summary (passed checks + any findings)
   - Findings by severity: 🔴 critical → 🟡 important → 🟢 suggestions

### Phase 3 — Remediate (if needed)

✓ Checkpoint: User decision made; fixes applied or cancelled

8. **Decision flow:** If findings exist (any severity) → ask user:
   "Apply these fixes with agent-update?" (choices: Yes / Review findings first / Cancel)
   - If confirmed → invoke `agent-update` with the agent path
   - If "Review" → show detailed `audit-report.json` and ask again
   - If cancelled → stop without remediation
9. Otherwise → report ✅ PASS and done.

## Gotchas

- A zero-finding report is valid — don't force fixes if nothing's broken.
- Filename must match `name` in frontmatter exactly.
- `model` is repo-local advisory; audit it as a convention, not a required field.
- Write `audit-report.json` in the agent directory as an archive, not for inter-tool communication.
- Do not proceed with `agent-update` if user cancels.
- Critical findings (shell enforcement) should always be fixed.

## Output Format

If you are ready to present the audit result, read `assets/audit-output-template.md` and fill in the placeholders.
