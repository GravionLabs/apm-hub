---
name: verify-project
description: >
  Run build, tests, and lint on the project and report pass/fail with the
  first error. Loads detect-techstack and <lang>-test skills for the correct
  commands per detected package manager. Use to verify a change, check the
  build, or as the verify phase of an implement workflow.
---

Phase: verify. Run checks on project.

## Steps

1. Load `detect-techstack` skill — parse JSON report for `build` and `test` skill lists
2. Run build using detected package manager
3. For each test skill in `$stack.test`, load it and run the test command
4. Run lint/format per project conventions

## Output (JSON only)

```json
{
  "phase": "verify",
  "status": "ok" | "fail",
  "summary": "pass | first error line if fail"
}
```

## Constraints

- Read-only verification: no edits, no fixes — report only.
- Run commands in project root.
- Step fails? Stop, report first error.
- Output JSON only.
