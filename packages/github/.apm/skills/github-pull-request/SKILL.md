---
name: github-pull-request
description: >
  Create a GitHub PR from the current branch and its linked issue: gather
  commit/diff context, generate a conventional title and structured body,
  create via gh CLI, optionally request review and auto-merge. Use when asked
  to "create a PR", "open a pull request", or to finish a branch whose issue
  work is already committed.
---

Create a PR from the current branch. No dialogue — tool calls only.

## Input

- `issue_number` (required)
- `branch` (default: `git branch --show-current`)
- `base_branch` (default: `main`)
- `auto_merge` (default: false)
- `add_reviewer` (default: true)

## Steps

1. **Gather context** (parallel): `git branch --show-current`, `git log origin/main..HEAD --oneline`, `git diff --stat origin/main...HEAD`, `gh issue view <nr> --json title,body,labels`
2. **Title**: `<type>: <description> (#<issue_number>)` — type from the commits (`feat`, `fix`, `docs`, `refactor`, `perf`); mixed → dominant type or the issue's labels. Description: from the issue title, ≤ 60 chars, lowercase, imperative.
3. **Body**:
   ```markdown
   ## Summary
   <what changed and why>

   ## Changes
   <bullets from git log>

   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass (if applicable)

   Closes #<issue_number>
   ```
4. **Create**: `gh pr create --title "<title>" --body "<body>" --base <base_branch>`
5. **Reviewer** (if `add_reviewer`): `gh pr edit <pr> --add-reviewer "github-copilot[bot]"`
6. **Auto-merge** (if `auto_merge`): `gh pr merge <pr> --auto --squash`
7. **Output**: PR number, URL, and confirmation that `Closes #<issue_number>` is in the body

## Rules

- Never create an empty PR (no commits beyond the base branch)
- Branch must be pushed: if `git log origin/<branch>..HEAD` is non-empty, run `git push -u origin HEAD` first
