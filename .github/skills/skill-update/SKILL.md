---
name: skill-update
description: >
  Applies improvements from a skill audit. Invoked automatically by skill-audit
  after user confirmation, or can be called standalone when audit findings are
  ready to be applied to an existing skill.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
---

## Overview

Apply audit findings in severity order and keep the change set focused. 

When invoked from skill-audit, findings are passed in context and audit-report.json is available as reference. When called standalone, read audit-report.json from the skill directory.

## Prerequisites

- Skill path (required)
- Findings in context from skill-audit **OR** `audit-report.json` file in skill directory

## Instructions

1. **Get findings:**
   - If invoked from skill-audit: Use findings from context (skip JSON parsing)
   - If called standalone: Read `{skill-dir}/audit-report.json` 
2. List files in `{skill-dir}/` and read `{skill-dir}/SKILL.md`.
3. Fix issues in severity order (critical → important → suggestions). Use skill `skill-write` when rewriting or restructuring `SKILL.md` content.
4. Use this mapping:
   | Finding | Fix |
   |---|---|
   | Name mismatch | Update `name` or rename the directory. |
   | Description issue | Make it imperative, specific, and ≤1,024 chars. |
   | Body too long | Move reference material to `references/` and load it conditionally. |
   | Content belongs in assets | Move long templates to `assets/`. |
   | Content belongs in scripts | Extract a flag-based script with `--help`, stdout data, stderr diagnostics, and non-zero failure codes. |
   | Reference issue | Use relative, conditional loads and keep chains one level deep. |
   | Decision flow issue | Rewrite as `If X → do Y; otherwise do Z`. |
   | Vague or duplicated content | Tighten or remove it. |
   | Verbose CLI output or JSON misuse | Apply the output-efficiency rules from `skill-write` and trim examples to the minimum useful signal. |
5. Validate the result.
6. Archive `audit-report.json` with a resolution note: `// audit-report archived — all findings applied on <date>` at the top.

## Gotchas

- Confirm before any location move.
- Do not widen the scope beyond the audit findings.
- Ask before large restructures.
- When findings come from context (skill-audit invocation), treat them as the source of truth; when reading JSON, validate it matches the current skill state.
