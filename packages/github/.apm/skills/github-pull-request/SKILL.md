---
name: github-pull-request
description: 'Create a GitHub PR from the current branch and its linked issue with a conventional title and structured body via gh. Use for "create a PR" or to finish a committed branch.'
---

Create a PR from the current branch. No dialogue — tool calls only.

## Input

- `issue_number` (required)
- `branch` (default: `git branch --show-current`)
- `base_branch` (default: the integration branch per the `github-issue` skill's `references/release-branches.md`: a `release/*` branch, or `main` only when the head is `release/*` or the user asked for a hotfix; `<base>` below)
- `auto_merge` (default: false)
- `add_reviewer` (default: true)

## Steps

1. **Gather context** (parallel): `git branch --show-current`, `git log origin/<base>..HEAD --oneline`, `git diff --stat origin/<base>...HEAD`, `gh issue view <nr> --json title,body,labels`
2. **Title**: `<type>: <description> (#<issue_number>)` — type from the commits (`feat`, `fix`, `docs`, `refactor`, `perf`); mixed → dominant type or the issue's labels. Description: from the issue title, ≤ 60 chars, lowercase, imperative.
3. **Body**:
   ```markdown
   ## Summary
   <what changed and why>

   ## Changes
   <bullets from git log>

   ## Verification
   <the build/test/lint commands actually run and their result, one sentence>

   Closes #<issue_number>
   ```
4. **Create**: `gh pr create --title "<title>" --body "<body>" --base <base>`
5. **Reviewer** (if `add_reviewer`): `gh pr edit <pr> --add-reviewer @copilot` (gh ≥ 2.88)
6. **Auto-merge** (if `auto_merge` and `<base>` is not `main`): `gh pr merge <pr> --auto --squash`. A PR into `main` is merged by the owner with `--merge` (release) or `--squash` (hotfix), never automatically.
7. **Output**: PR number, URL, and confirmation that `Closes #<issue_number>` is in the body

## Rules

- Never create an empty PR (no commits beyond the base branch)
- `<base>` is `main` but the head is not `release/*` and no hotfix was requested → stop and report; the work belongs on a release branch
- Branch must be pushed: if `git log origin/<branch>..HEAD` is non-empty, run `git push -u origin HEAD` first
- Never claim verification that was not run; if nothing was run, say so in the body
