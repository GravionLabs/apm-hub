---
name: verify-project
description: 'Run build, tests and lint; report pass/fail with the first error. Use to verify a change or as the verify phase.'
context: fork
agent: reviewer
---

Phase: verify. Run checks on project. On Claude Code this skill runs in a forked `reviewer` context (read-only plus test commands): build and test output stays there, the caller receives only the JSON below.

## Steps

1. Load `detect-techstack`; use `packageManager` for the build command and `test` for the test skills
2. Run the build with the detected package manager
3. For each skill in `test`, load it and run its test command; skill not installed → use the package manager's `test` script and put "install `<stack>@apm-hub`" in `summary`
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
