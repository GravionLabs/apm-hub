---
name: verify-project
description: 'Run build, tests and lint and report pass/fail with the first error, using detect-techstack and <lang>-test for the commands. Use to verify a change or as the verify phase.'
---

Phase: verify. Run checks on project.

## Steps

1. Load `detect-techstack`; use `packageManager` for the build command and `test` for the test skills
2. Run the build with the detected package manager
3. For each skill in `test`, load it and run its test command
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
