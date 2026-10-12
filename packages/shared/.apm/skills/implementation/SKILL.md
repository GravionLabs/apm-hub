---
name: implementation
description: 'Rules for code changes: every change ships with tests, dispatches to <lang>-implementation. Use for implement, write code, add feature, test requests.'
---

## Golden rule

Every implementation change MUST include tests. No test = no commit. Cover three categories: **happy path**, **edge cases** (empty, null, boundaries), **error cases** (invalid input, not found, conflicts, auth failures).

## Before commit

- [ ] Tests for every new or modified function
- [ ] Typecheck/build passes; tests pass (happy + edge + error)
- [ ] No debug output left in code

## Language dispatch

Run `detect-techstack`, then load each `<lang>-implementation` and `<lang>-test` skill from the report. A listed skill that is not installed: say "install `<stack>@apm-hub` in this project's `apm.yml`" once and continue with these rules.
