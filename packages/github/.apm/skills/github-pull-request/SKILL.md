---
name: github-pull-request
description: >
  Create a GitHub PR from the current branch and its linked issue: gather
  commit/diff context, generate a conventional title and structured body,
  create via gh CLI, optionally request review and auto-merge. Use when asked
  to "create a PR", "open a pull request", or to finish a branch whose issue
  work is already committed.
---

# GitHub Pull Request Creator

Create a PR from the current branch. No dialogue — tool calls only.

## Input
- `issue_number` (required): GitHub issue number
- `branch` (optional): derive from `git branch --show-current` if not provided
- `base_branch` (optional, default: `main`): target branch for the PR
- `auto_merge` (optional, boolean, default: false): enable auto-merge after creation
- `add_reviewer` (optional, boolean, default: true): request Copilot review after creation

## Steps

### 1. Gather context

Run parallel:
- `git branch --show-current` — current branch
- `git log origin/main..HEAD --oneline` — commits
- `git diff --stat origin/main...HEAD` — changed files

Read issue title + body via `gh issue view <nr> --json title,body,labels`.

### 2. Determine PR title

Format: `<type>: <description> (#<issue_number>)`

Derive type from commits: `feat:` → feat, `fix:` → fix, `docs:` → docs, `refactor:` → refactor, `perf:` → perf. Mixed → dominant type or issue labels.

Description: concise summary from issue title (≤60 chars, lowercase, imperative).

### 3. Generate PR body

Template:
```markdown
## Summary
<!-- what changed and why -->

## Changes
<!-- bullet list from git log -->

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

Closes #<issue_number>
```

### 4. Create PR

```bash
gh pr create --title "<title>" --body "<body>" --base <base_branch>
```

### 5. Add Reviewer

If `add_reviewer` is true:

```bash
gh pr edit <pr-number> --add-reviewer "github-copilot[bot]"
```

### 6. Auto-merge

If `auto_merge` is true:

```bash
gh pr merge <pr-number> --auto --squash
```

### 7. Output

Return: PR number, PR URL, confirm `Closes #<issue_number>` in body.

## Rules
- Never create empty PR (no commits beyond base branch)
- Verify branch pushed: `git log origin/<branch>..HEAD` empty
- If not pushed: `git push -u origin HEAD` first
