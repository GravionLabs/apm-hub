---
name: skill-audit
description: >
  Audits an existing agent skill. Use this skill when asked to review, validate,
  check, or audit a skill, even if the user only says to look at it or verify it.
allowed-tools: read search codebase write edit editFiles
---

## Overview

Audit a skill and write a prioritized findings report.

## Prerequisites

- Skill path
- Read `references/frontmatter-schema.md`
- Read `references/audit-checklist.md`

## Instructions

1. Read `{skill-dir}/SKILL.md` and list files in `{skill-dir}/`.
2. Run the checklist across frontmatter, body, scripts, references, assets, and anti-patterns.
3. Record each finding as severity, category, finding, and recommendation.
4. Write `{skill-dir}/audit-report.md` using this shape:

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

- {check 1}
- {check 2}
```

## Gotchas

- A zero-finding report is valid.
- Skip script checks entirely when no `scripts/` directory exists.
- The directory name must match `name`.
- Write `audit-report.md` in the skill directory, not the current working directory.
