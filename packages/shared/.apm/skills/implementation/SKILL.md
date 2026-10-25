---
name: implementation
description: 'Rules for code changes: every change ships with tests, dispatches to <lang>-implementation. Use for implement, write code, add feature, test requests.'
---

## Golden rule

Every implementation change MUST include tests. No test = no commit. Cover three categories: **happy path**, **edge cases** (empty, null, boundaries), **error cases** (invalid input, not found, conflicts, auth failures).

## Good tests

Test behavior through the public interface, never internals; expected values come from a literal, example or the spec, never recomputed like the code; one failing test → minimal code → next test (vertical slices); refactor after green, not inside the loop. Details: `references/test-quality.md`.

## Before commit

- [ ] Tests for every new or modified function
- [ ] Tests follow the good-tests rules (no internals coupling, no tautological assertions)
- [ ] Build passes when the stack compiles and compiled sources changed; targeted tests pass (test files of the changed paths and direct neighbours, `<lang>-test` "Targeted run"; unknown mapping: the fast/unit group, never the full suite); the full run is the PBI Final-Verify
- [ ] Every item of an Invariants section in the task or PBI body has a test that exercises it
- [ ] Changed files formatted: `scripts/Format-Changed.ps1` runs the Format command of the language skill on them (`references/format.md`)
- [ ] Never commit red
- [ ] No debug output left in code

## Language dispatch

Run `detect-techstack`, then load each `<lang>-implementation` and `<lang>-test` skill from the report. A listed skill that is not installed: say "install `<stack>@apm-hub` in this project's `apm.yml`" once and continue with these rules.
