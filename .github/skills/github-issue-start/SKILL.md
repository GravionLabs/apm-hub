---
name: github-issue-start
description: 'Read a GitHub issue, create the appropriate branch, and implement it with code, tests, and docs. Use this to start work on a new issue.'
allowed-tools: execute shell runCommands read write edit editFiles search codebase mcp_github_get_issue mcp_github_create_branch mcp_github_list_branches
chronicle-hints: 'single-purpose, structured-output, phases'
---

Read a GitHub issue, create a branch, and fully implement it.

## Prerequisites
- `gh` CLI installed and authenticated (`gh auth status`) — used as fallback when GH MCP is unavailable
- Run from the repository root

## Steps

### Phase 1 — Prepare

✓ Checkpoint: Issue read and branch created

*Primary — GH MCP:*
1. Call `mcp_github_get_issue` with the issue number to read title, body, and labels
2. Determine branch type from labels: `feature/`, `bugfix/`, `hotfix/`, `chore/`
3. Call `mcp_github_create_branch` to create `<type>/<issue-number>-<slug>`, then `git checkout <branch>`

*Fallback — GH CLI (when MCP not available):*
1. `gh issue view {issue-number} --json title,body,labels,assignees`
2. Determine branch type from labels: `feature/`, `bugfix/`, `hotfix/`, `chore/`
3. `git checkout -b <type>/<issue-number>-<slug>`

### Phase 2 — Plan

✓ Checkpoint: Task breakdown complete; ready to implement

4. Explore the codebase to understand affected areas
5. Break the issue into implementation tasks; list them before starting

### Phase 3 — Implement

✓ Checkpoint: Code, tests, and docs complete; commits pushed

6. Write the code changes following project conventions
7. Write or update tests (unit + integration where applicable)
8. Update documentation if behaviour changes
9. Atomic commits: `git commit -m "<type>: <description> (#<issue-number>)"`

### Phase 4 — Verify

✓ Checkpoint: Build passed; ready for PR

10. Run build and tests to confirm everything passes
11. Push: `git push -u origin HEAD`

## Constraints
- One logical change per commit
- Tests must pass before pushing
- After pushing, run `github-issue-finish` to create the PR

## Gotchas
- Always use MCP (or GH CLI) to read the issue first — don't guess from the issue number
- Branch name must include the issue number for traceability
- Push to remote immediately so branch shows in `git branch -r`
- Don't create multiple branches or commits before testing

## Output Format

### ✅ Summary
Issue #`{number}` implemented on branch `{branch-name}` and pushed to remote.

### 📝 What Changed
- Branch: `{branch-name}` (created and pushed)
- Files modified: `{count}` (specific files listed with line counts)
- Tests: {status} (All passed / X failed)
- Commits: {count} ({messages listed})

### ✔️ Verify
```powershell
# Check branch exists on remote
git branch -r | Select-String "{branch-name}"

# Check commits are pushed
git log --oneline -5 {branch-name}

# Verify tests passed locally
npm run test
```

### 🚀 Next Steps
1. Review PR template in `templates/pr-body.md`
2. Run `github-issue-finish` to create the PR
3. Verify issue is auto-linked in PR body
4. Request review from team
