---
name: skill-update
description: >
  Applies improvements from a skill audit. Use this skill when audit findings or
  an `audit-report.md` are ready to be applied to an existing skill.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
---

## Overview

Apply audit findings in severity order and keep the change set focused.

## Prerequisites

- Skill path
- `audit-report.md` or explicit findings

## Instructions

1. Read the findings and list files in `{skill-dir}/`.
2. Fix issues in severity order.
3. Use this mapping:
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
4. Validate the result.
5. Remove or archive `audit-report.md` once all findings are resolved.

## Gotchas

- Confirm before any location move.
- Do not widen the scope beyond the audit findings.
- Ask before large restructures.
