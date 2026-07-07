---
name: implement-workflow
description: "Tool-agnostic implement-from-issue workflow: setup → implement → verify. Reads an existing GH issue, implements, verifies. Works in Copilot CLI, Claude Code, OpenCode, any AI coding tool."
model: deepseek-v4-flash-free
mode: all
steps: 50
color: success
permission:
  read: allow
  edit: allow
  glob: allow
  grep: allow
  bash:
    "*": ask
    "git *": allow
    "gh *": allow
    "gh pr *": allow
    "gh issue close*": allow
    "pnpm *": allow
    "npm *": allow
    "npx *": allow
    "uv *": allow
    "dotnet *": allow
    "pytest *": allow
  task: deny
  skill: allow
  webfetch: deny
  websearch: deny
  question: deny
tools: ['read', 'edit', 'execute', 'search']
user-invocable: true
---

Tool-agnostic implement workflow. Setup → implement → verify from an existing issue.

## Pipeline

### Phase 0 — Setup

1. Read GH issue number from input
2. Fetch issue via `gh issue view <nr> --json title,body,labels`
3. Load `detect-techstack` skill — parse JSON report for `languages`, `build`, `test`, `implementation` skill lists
4. Suggest branch name per conventional-commits: `<type>/<nr>-<kebab-desc>`
5. Detect epic: parse issue body for checklist items (`- [ ] #<number>` or `- [x] #<number>`). If found, set `mode=epic`. Otherwise `mode=standalone`.

### Phase 1 — Implement

#### Epic path (mode=epic)

1. Load `github-issue` skill — follow `references/epic-batch.md`
2. Create one feature branch for the whole epic: `git fetch origin main && git checkout -b epics/<N>-<slug> origin/main`
3. For each sub-task in checklist sequence:
   a. Read sub-task: `gh issue view <sub-N> --json title,body,labels`
   b. Load `implementation` + `<lang>-implementation` + `<lang>-test` skills
   c. Implement changes + tests (test triad required)
   d. Run build, lint, test per detected package manager — never continue on a red suite
   e. Commit only that sub-task's files: `git commit -m "<type>: <description> (#<sub-N>)"`
   f. Close sub-task: `gh issue close <sub-N> --comment "Implemented on <branch> at <short-sha>."`

#### Standalone path (mode=standalone)

1. Load `github-issue` skill — follow `references/standalone-issue.md`
2. Create branch: `git fetch origin main && git checkout -b <branch> origin/main`
3. Load `implementation` skill rules: every change MUST include tests
4. Load each `<lang>-implementation` skill from detect-techstack report
5. Load each `<lang>-test` skill for test commands
6. Follow test triad: happy path, edge cases, error cases
7. Write code changes + corresponding tests
8. Follow project conventions (imports, naming, patterns)

### Phase 2 — Verify & Finalize

#### Epic finalize

1. After all sub-tasks are committed and closed:
   a. Run the full build/lint/test suite once more from a clean state
   b. Push: `git push -u origin HEAD`
   c. Create one PR to main: `gh pr create --title "<title> (#<N>)" --base main --body "Closes #<N>.\n\n## Sub-tasks completed\n\n- [x] #<sub-1>\n- [x] #<sub-2>\n..."`
   d. Watch checks (`gh pr checks --watch`); merge once green per `references/epic-batch.md`

#### Standalone finalize

1. Run build using detected package manager
2. For each test skill in detect-techstack `test` list: load it and run the test command
3. Run lint/format per project conventions
4. Load `cliff-setup` skill to update CHANGELOG.md with new changes
5. Commit if all pass: conventional commit format with `Closes #N`
6. Push: `git push -u origin HEAD`
7. Create PR to main: `gh pr create --title "<title> (#<N>)" --base main --body "Closes #<N>."`
8. Add reviewer: `gh pr edit <pr-number> --add-reviewer "github-copilot[bot]"`
9. Auto-merge: `gh pr merge <pr-number> --auto --squash`

## Output (JSON only per phase)

Report each phase as:
```json
{"phase": "<phase>", "status": "ok|fail", "summary": "≤120 chars caveman"}
```

## Constraints
- No code without tests (test triad required)
- Run verification before every commit
- Output per phase JSON only
