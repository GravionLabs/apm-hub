---
name: github-pull-request
description: 'Create a GitHub PR from the current branch and linked issue via gh. Use for "create a PR" or to finish a branch.'
context: fork
---

Create a PR from the current branch. No dialogue — tool calls only. On Claude Code the skill runs in a forked context without the session history, so everything comes from the arguments, `git` and `gh`.

## Input

- `issue_number` (default: the number in the branch name `<type>/<nr>-<slug>`; stop when neither exists)
- `branch` (default: `git branch --show-current`)
- `base_branch` (default: the integration branch per the `github-issue` skill's `references/release-branches.md`: `release/next`, or `main` only when the head is `release/*` or the user asked for a hotfix; `<base>` below)
- `not_delivered` (default: empty): Task numbers `#<task>` or acceptance-criterion text this PR leaves open
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
   `not_delivered` non-empty: add `## Not delivered` (one bullet per item, its follow-up `#<n>` when known) before the footer and end with `Refs #<issue_number>` instead of `Closes`, so the release leaves the issue open.
4. **Create**: `gh pr create --title "<title>" --body "<body>" --base <base>`
5. **Reviewer** (if `add_reviewer`): `gh pr edit <pr> --add-reviewer @copilot` (gh ≥ 2.88)
6. **Auto-merge** (if `auto_merge` and `<base>` is not `main`): `gh pr merge <pr> --auto --squash`. A PR into `main` is merged by the owner with `--merge` (release) or `--squash` (hotfix), never automatically.
7. **Output**: PR number, URL, and which footer the body carries (`Closes` or `Refs #<issue_number>`)

## Rules

- Never create an empty PR (no commits beyond the base branch)
- `<base>` is `main` but the head is not `release/*` and no hotfix was requested → stop and report; the work belongs on `release/next`
- Branch must be pushed: if `git log origin/<branch>..HEAD` is non-empty, run `git push -u origin HEAD` first
- Never write `Closes` for an issue with an undelivered acceptance criterion or open Task; that is `Refs` plus `## Not delivered`
- Never claim verification that was not run; if nothing was run, say so in the body
