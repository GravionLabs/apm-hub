---
name: code-review
description: 'Severity-rated (🔴/🟡/🟢) review of a diff or files per language rules. Use for "review this code" or as review-fanout''s conventions dimension.'
---

Read-only: report findings, never edit.

## Severity

- 🔴 **Critical** — bugs, security vulnerabilities, data loss, broken tests
- 🟡 **Important** — missing error handling, performance, API design, missing or weak tests
- 🟢 **Suggestion** — style, naming, minor refactors

## Steps

1. Load `detect-techstack` — parse the JSON report for the languages in scope
2. For each language, read the `## Review rules` section of its `<lang>-implementation` skill
3. Review the target against those rules, plus correctness, security, and test coverage
4. Do not recommend patterns or abstractions that add complexity without a concrete need

## Output

Group by file. For each finding: severity emoji, `file:line`, the issue, a suggested fix. Report findings only — no praise, no summary of what is fine.
