---
name: skill-audit
description: >
  Audits an existing agent skill against agentskills.io best practices. Use this skill
  when asked to review, validate, check, or audit a skill — even if the user just says
  "look at this skill" or "is this skill correct". Outputs a prioritised findings list
  and writes audit-report.md to the skill directory for use in automated pipelines.
  Invoke as: apm-skill-audit
allowed-tools: execute read edit search codebase editFiles runCommands
---

## Overview

Systematically audit a skill directory and produce a structured findings report.

## Prerequisites

- The skill directory path (ask if not provided)

## Instructions

### Phase 1 — Load rules

Read both reference files before starting any checks:
1. Read `references/frontmatter-schema.md` — frontmatter field rules and length limits
2. Read `references/audit-checklist.md` — full checklist with severity levels

### Phase 2 — Read the skill

1. Identify the skill path (ask the user if not provided or not obvious from context)
2. Read `{skill-dir}/SKILL.md`
3. List all files in `{skill-dir}/` to know which companion directories exist

### Phase 3 — Run all checks

Work through `references/audit-checklist.md` in order:

1. **Frontmatter** — name, description, allowed-tools, compatibility
2. **Body** — length, content placement, structure, quality
3. **`scripts/`** — if the directory exists, check every script file
4. **`references/`** — conditional load instructions, path style, chain depth
5. **`assets/`** — referenced conditionally, appropriate content type
6. **Anti-patterns** — scan for the patterns in the anti-pattern table

For each issue found, record:
- Severity: 🔴 Critical / 🟡 Important / 🟢 Suggestion
- Category: `name` | `description` | `body` | `scripts` | `references` | `assets` | `anti-pattern`
- Finding: concise description of the problem
- Recommendation: what to change

### Phase 4 — Write `audit-report.md`

Write findings to `{skill-dir}/audit-report.md` using this template:

```markdown
# Skill Audit: {name}

Audited: {skill-dir}
Date: {ISO date}

## Summary

{N} critical · {N} important · {N} suggestions

## Findings

### 🔴 Critical

- **[category]** {finding}
  → {recommendation}

### 🟡 Important

- **[category]** {finding}
  → {recommendation}

### 🟢 Suggestions

- **[category]** {finding}
  → {recommendation}

## Passed checks

- {check 1 that passed}
- {check 2 that passed}
```

If there are no findings in a severity category, omit that section header.

Write the file even when there are zero findings — an empty audit report signals a clean audit.

### Phase 5 — Report to the user

Print a brief summary:
- Total findings by severity
- The 1–3 most important issues (if any)
- Confirm that `audit-report.md` was written

## Gotchas

- A skill with zero findings is a valid outcome — write the report with an empty findings section.
- When the skill has no `scripts/` directory, skip all script checks entirely.
- Check the **directory name**, not just the frontmatter `name` field — both must match.
- `audit-report.md` is written to the audited skill's directory, not the current working directory.

## Output format

```
Audit complete: {name}
  🔴 {N} critical
  🟡 {N} important
  🟢 {N} suggestions

Report written to: {skill-dir}/audit-report.md
```

> 💡 **Model hint:** This task benefits from a capable model (`claude-sonnet-4.6` or better). Use `/model` to switch.
