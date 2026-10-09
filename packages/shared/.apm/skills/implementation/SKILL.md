---
name: implementation
description: >
  Language-agnostic implementation rules. Every code change MUST include tests.
  Triggers on "implement", "write code", "add feature", "create function",
  "test", "test function". Automatically loads <lang>-implementation sub-skill.
---

## Golden rule

Every implementation change MUST include tests. No test = no commit. Cover three categories: **happy path**, **edge cases** (empty, null, boundaries), **error cases** (invalid input, not found, conflicts, auth failures).

## Before commit

- [ ] Tests for every new or modified function
- [ ] Typecheck/build passes; tests pass (happy + edge + error)
- [ ] No debug output left in code

## Language dispatch

Run `detect-techstack`, then load each `<lang>-implementation` and `<lang>-test` skill from the report.
