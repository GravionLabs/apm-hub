---
name: skill-update
description: 'Apply improvements from a skill audit to an existing skill. Use after skill-audit or when asked to fix or tighten a specific skill.'
---

Apply audit findings in severity order and keep the change set focused on them.

## Prerequisites

- Skill path
- Findings in context; if none → run `skill-audit` on the path first
- Rules: `../skill-write/references/skill-writing-rules.md`

Paths to `scripts/`, `references/` and `assets/` are relative to this skill's directory.

## Instructions

1. List files in `{skill-dir}/` and read `{skill-dir}/SKILL.md`.
2. Fix findings 🔴 → 🟡 → 🟢. If a fix means rewriting or restructuring the body → follow `skill-write`.

   | Finding | Fix |
   |---|---|
   | Name mismatch | Update `name` or rename the directory. |
   | Description issue | Make it imperative, specific, ≤ 1,024 chars. |
   | Forbidden frontmatter key | Remove it; move annotations under `metadata:`. |
   | Body too long | Move reference material to `references/`, load it conditionally. |
   | Content belongs in assets | Move long templates to `assets/`. |
   | Content belongs in scripts | Extract a flag-based script with `--help`, stdout data, stderr diagnostics, non-zero exit on failure. |
   | Reference issue | Relative, conditional loads; chains one level deep. |
   | Decision flow issue | Rewrite as `If X → do Y; otherwise do Z`. |
   | Vague or duplicated content | Tighten or remove it; delegate to the owning skill. |
   | Verbose CLI output or JSON misuse | Trim to the minimum useful signal; JSON only when parsed downstream. |
   | Wrong shell fence | Replace with ` ```powershell `. |

3. Re-run `skill-audit` on the result.

## Gotchas

- Confirm before renaming or moving a skill.
- Do not widen the scope beyond the audit findings; ask before large restructures.

Report: summary, files changed, re-audit result.
