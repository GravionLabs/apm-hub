---
name: github-issue
description: 'Read GitHub issue, branch, implement, verify, PR. Full lifecycle from issue to merged PR. Use for any GitHub issue work — covers start through finish.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase
compatibility: opencode, github-copilot
---

## Overview

This is the single skill for the full GitHub issue lifecycle. 
For complex issues, you can also use the split approach: run `github-issue-start` for implementation, then `github-issue-finish` for PR creation.

Read GitHub issue → branch → implement → verify → PR. Single flow.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- Run from repo root

## Steps

### Phase 1 — Read + Branch

1. Read issue: `gh issue view <nr> --json title,body,labels`
2. Derive branch type from labels (feature/bugfix/hotfix/chore)
3. Create branch: `git fetch origin main && git checkout -b <type>/<nr>-<slug> origin/main`

### Phase 2 — Implement

4. Explore codebase, affected areas
5. Break issue into implementation tasks
6. Write code + tests per project conventions
7. Atomic commits per conventional-commits reference

### Phase 3 — Verify + PR

8. Run full build + test suite. Fix failures.
9. Review diff: `git diff main...HEAD` — no debug code, TODOs, missing tests
10. Push: `git push -u origin HEAD`
11. Create PR:
    ```bash
    gh pr create --title "<type>: <desc> (#<nr>)" --body "$(cat)" <<-BODY
    ## Summary

    ## Changes

    ## Testing
    - [ ] Unit tests pass

    Closes #<nr>
    BODY
    ```
12. Confirm: `gh pr view --json number,url`

## Constraints

- Branch name includes issue number
- One logical change per commit
- PR title format: `<type>: <description> (#<issue-number>)`
- PR body contains `Closes #<issue-number>`
- All CI checks green before review

## Load conventional-commits reference

Load `references/conventional-commits.md` for commit format rules.
