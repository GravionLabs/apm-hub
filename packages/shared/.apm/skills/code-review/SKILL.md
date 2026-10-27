---
name: code-review
description: 'Review a diff against acceptance criteria and language rules; blocking findings versus notes. Use for "review this code".'
---

Read-only: report findings, never edit.

## Steps

1. Load `detect-techstack` — parse the JSON report for the languages in scope
2. For each language, read the `## Review rules` section of its `<lang>-implementation` skill
3. Review the diff against the acceptance criteria (when given), those rules, correctness, security and test coverage
4. Sort each finding: **blocking** or **note**
5. Do not recommend patterns or abstractions that add complexity without a concrete need

## Blocking

Blocking = breaks an acceptance criterion, or is a correctness or security defect (bug, vulnerability, data loss, broken test). Everything else is a note. When unsure, it is a note.

## Security

Check every diff for injection, unvalidated input, secrets in code or logs, broken authorization, unsafe deserialization and path traversal. Confirmed defect → blocking; doubt → note.

## Output

Interactive: a readable report, `## Blocking` then `## Notes`, grouped by file, each blocking item as `file:line — title`, why, suggested fix. No praise, no summary of what is fine. With nothing blocking, say so in one line.

Started by a runner or with input of diff plus criteria: load `references/reviewer-contract.md`. It defines the input and prints the JSON result of `schema/review.schema.json`.
