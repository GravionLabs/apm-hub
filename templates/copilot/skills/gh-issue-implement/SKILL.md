---
name: gh-issue-implement
description: 'Read a GitHub issue, create the appropriate branch, and implement it with code, tests, and docs. Use this to start work on a new issue.'
allowed-tools: codebase editFiles runCommands
model: claude-sonnet-4.6
model: claude-sonnet-4.6
---

Read a GitHub issue, create a branch, and fully implement it.

## Prerequisites
- `gh` CLI installed and authenticated (`gh auth status`)
- Run from the repository root

## Steps

### Phase 1 — Prepare
Use the script (recommended) or run manually:
```powershell
pwsh scripts/Start-Issue.ps1 -IssueNumber {issue-number}
```
The script fetches the issue, derives the branch name from labels, creates and checks out the branch.

**Manual alternative:**
1. `gh issue view {issue-number} --json title,body,labels,assignees`
2. Determine branch type from labels: `feature/`, `fix/`, `chore/`, `docs/`
3. `git checkout -b <type>/<issue-number>-<slug>`

### Phase 2 — Plan
4. Explore the codebase to understand affected areas
5. Break the issue into implementation tasks; list them before starting

### Phase 3 — Implement
6. Write the code changes following project conventions
7. Write or update tests (unit + integration where applicable)
8. Update documentation if behaviour changes
9. Atomic commits: `git commit -m "<type>: <description> (#<issue-number>)"`

### Phase 4 — Verify
10. Run build and tests to confirm everything passes
11. Push: `git push -u origin HEAD`

## Constraints
- One logical change per commit
- Tests must pass before pushing
- After pushing, run `gh-issue-finish` to create the PR

## Scripts
- **`scripts/Start-Issue.ps1`** — fetch issue, derive branch name, create and checkout branch
  ```powershell
  pwsh scripts/Start-Issue.ps1 -IssueNumber 42
  pwsh scripts/Start-Issue.ps1 -IssueNumber 42 -Owner myorg -Repo myrepo
  ```

## Templates
- **`templates/pr-body.md`** — PR body template used by `gh-issue-finish`
