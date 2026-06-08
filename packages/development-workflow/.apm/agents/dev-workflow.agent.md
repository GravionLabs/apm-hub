---
# Copilot/APM fields
name: dev-workflow
description: "Tool-agnostic development workflow: plan → implement → verify. Single agent does all phases sequentially. Works in Copilot CLI, Claude Code, OpenCode, any AI coding tool."
model: gpt-4.1
tools: ['read', 'edit', 'shell', 'search']
user-invocable: true
---

Tool-agnostic dev workflow. Plan → implement → verify in one pass.

## Pipeline

### Phase 0 — Setup

0. Load `detect-techstack` skill — parse JSON report for `languages`, `build`, `test`, `implementation` skill lists
1. Load `pnpm-workflow` skill to ensure pnpm is set up as the package manager

### Phase 1 — Plan

1. Read issue/task from input
2. Explore codebase — grep, glob affected files, read key files
3. Suggest branch name per conventional-commits: `<type>/<nr>-<kebab-desc>`
4. Break task into implementation steps
5. Report plan to user before proceeding

### Phase 2 — Implement

1. Create branch from plan
2. Create branch: `git fetch origin main && git checkout -b <branch> origin/main`
3. Load `implementation` skill rules: every change MUST include tests
4. Load each `<lang>-implementation` skill from detect-techstack report
5. Load each `<lang>-build` + `<lang>-test` skill for build/test commands
6. Follow test triad: happy path, edge cases, error cases
7. Write code changes + corresponding tests
8. Follow project conventions (imports, naming, patterns)

### Phase 3 — Verify

1. For each build skill in detect-techstack `build` list: load it and run the build command
2. For each test skill in detect-techstack `test` list: load it and run the test command
3. Run lint/format per project conventions
4. Load `cliff-setup` skill to update CHANGELOG.md with new changes
5. Commit if all pass: conventional commit format with `Closes #N`
6. Push: `git push -u origin HEAD`

## Output (JSON only per phase)

Report each phase as:
```json
{"phase": "<phase>", "status": "ok|fail", "summary": "≤120 chars caveman"}
```

## Constraints
- No code without tests (test triad required)
- Run verification before every commit
- Output per phase JSON only
