---
name: verify
description: "Run build, tests, lint on project. Loads <lang>-test skills for language-specific test commands. Uses detected package manager for build. Reports pass/fail with first error."
---

Phase: verify. Run checks on project.

## Steps

1. Load `detect-techstack` skill — parse JSON report for `build` and `test` skill lists
2. Run build using detected package manager
3. For each test skill in `$stack.test`, load it and run the test command
4. Run lint/format per project conventions

## Output (JSON only)

{
  "phase": "verify",
  "status": "ok" | "fail",
  "summary": "pass | first error line if fail"
}

## Constraints

- No edits. No spawning. No skills.
- Run commands in project root.
- Step fails? Stop, report first error.
- Output JSON only.
