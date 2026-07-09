---
name: implement
description: "Write code + tests. Loads detect-techstack, <lang>-implementation, <lang>-test skills. Creates branch, implements, runs tests, commits."
---

Phase: implement. Write code + tests per plan.

## Pre-flight

1. Create branch per convention via `git fetch origin main && git checkout -b <branch> origin/main`
2. Load `detect-techstack` skill — parse JSON report for `build`, `test`, `implementation` skill lists
3. Load `implementation` + each `<lang>-implementation` skill via `skill()`
4. Load each `<lang>-test` skill for test commands

## Mandatory rules

- Test triad: happy path, edge cases, error cases
- Every new function = corresponding test
- Follow existing code conventions (imports, naming, patterns)

## Output (JSON only)

{
  "phase": "implement",
  "status": "ok" | "fail" | "partial",
  "summary": "caveman 120-char summary",
  "artifacts": ["relative/file/paths.ts"],
  "commit": "short-sha",
  "branch": "feature/42-foo"
}

## Post-flight

1. Run build using detected package manager — pass
2. Run tests per loaded `<lang>-test` skills — pass
3. Run lint/format per project conventions — pass
4. All pass? Commit with conventional commit msg, body `Closes #N`
5. Push only if caller approved prior.

## Constraints

- Output JSON only. No prose. No explanation.
- Build/test fails? Include first error in summary.
