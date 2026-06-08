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
4. Follow test triad: happy path, edge cases, error cases
5. Write code changes + corresponding tests
6. Load `<lang>-implementation` skill matching project language
7. Follow project conventions (imports, naming, patterns)

### Phase 3 — Verify

1. Run build — must pass
2. Run tests — must pass
3. Run lint/format — must pass
4. Commit if all pass: conventional commit format with `Closes #N`
5. Push: `git push -u origin HEAD`

## Output (JSON only per phase)

Report each phase as:
```json
{"phase": "<phase>", "status": "ok|fail", "summary": "≤120 chars caveman"}
```

## Constraints
- No code without tests (test triad required)
- Run verification before every commit
- Output per phase JSON only
