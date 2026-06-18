---
# OpenCode fields
mode: subagent
# Copilot/APM fields
name: implement-workflow
description: "Tool-agnostic implement-from-issue workflow: setup → implement → verify. Reads an existing GH issue, implements, verifies. Works in Copilot CLI, Claude Code, OpenCode, any AI coding tool."
model: deepseek-v4-flash-free
---

Tool-agnostic implement workflow. Setup → implement → verify from an existing issue.

## Pipeline

### Phase 0 — Setup

1. Read GH issue number from input
2. Fetch issue via `gh issue view <nr> --json title,body,labels`
3. Load `detect-techstack` skill — parse JSON report for `languages`, `build`, `test`, `implementation` skill lists
4. Suggest branch name per conventional-commits: `<type>/<nr>-<kebab-desc>`

### Phase 1 — Implement

1. Create branch: `git fetch origin main && git checkout -b <branch> origin/main`
2. Load `implementation` skill rules: every change MUST include tests
3. Load each `<lang>-implementation` skill from detect-techstack report
4. Load each `<lang>-test` skill for test commands
5. Follow test triad: happy path, edge cases, error cases
6. Write code changes + corresponding tests
7. Follow project conventions (imports, naming, patterns)

### Phase 2 — Verify

1. Run build using detected package manager
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