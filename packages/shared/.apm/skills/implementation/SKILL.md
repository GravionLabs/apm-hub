---
name: implementation
description: >
  Language-agnostic implementation rules. Every code change MUST include tests.
  Triggers on "implement", "write code", "add feature", "create function",
  "test", "test function". Automatically loads <lang>-implementation sub-skill.
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
model: gpt-4.1
---

## Golden Rule

Every implementation change MUST include test functions. No test = no commit.

## Test Triad

Every feature covers three categories:
1. **Happy path** — primary use case works
2. **Edge cases** — empty input, null values, boundaries, overflow
3. **Error cases** — invalid input, not found, duplicate conflicts, auth failures

## Test Structure

```ts
describe("unit or feature name", () => {
  it("handles happy path", () => { ... });
  it("handles edge case", () => { ... });
  it("handles error case", () => { ... });
});
```

## Pre-Commit Check

Before commit:
- [ ] Tests for every new/modified function
- [ ] Typecheck passes
- [ ] Tests pass (happy + edge + error)
- [ ] No debug/console.log in code

## Language Dispatch

Run `detect-techstack` first to determine project languages. Then load each `<lang>-implementation` skill from the report (e.g. `ts-implementation`, `py-implementation`). Each contains framework-specific rules.

Also load each `<lang>-build` and `<lang>-test` skill for language-specific build/test commands.
