---
name: github-release
description: 'Cut a release/<x.y> branch from main or finish it with the release PR and changelog. Use for "cut a release", "finish the release" or when no release branch exists.'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

Owns the lifecycle of `release/<x.y>` branches; the model and the base-branch resolver are in the
`github-issue` skill's `references/release-branches.md`. No dialogue — tool calls only.

## Prerequisites

- `gh` CLI authenticated, run from the repo root, clean `git status`
- Mode: `cut [<x.y>] [--feature <nr>]` or `finish [release/<x.y>]`

## Instructions

### 1. cut

1. `git fetch origin --tags`. Version: the argument if given; otherwise the next minor after the
   highest `v<x.y.z>` tag (`git tag --list 'v*' | sort -V | tail -1`), `0.1` when there is no tag.
   If `release/<x.y>` already exists on origin → stop and report it.
2. `<default>` = `git symbolic-ref refs/remotes/origin/HEAD --short` minus `origin/`, fallback `main`.
   `git checkout -b release/<x.y> origin/<default>; git push -u origin release/<x.y>`
3. If `--feature <nr>` → insert `Release branch: release/<x.y>` as the second line of that issue's
   body (`gh issue view <nr> --json body`, `gh issue edit <nr> --body-file -`); keep the `Parent …`
   line first. Child issues inherit it through the resolver.

### 2. finish

4. Branch: the argument, else the current branch if it is `release/*`, else the highest
   `release/<x.y>` on origin (resolver step 4 in `release-branches.md`). `git checkout release/<x.y>; git pull --ff-only`.
5. Open work must be merged first: `gh pr list --base release/<x.y> --state open` must be empty;
   otherwise stop and list the PRs.
6. Changelog: `git-cliff -c cliff.toml -o CHANGELOG.md --unreleased -t v<x.y>.0` (no tags yet:
   drop `--unreleased`). If `cliff.toml` is missing or `git-cliff` is not installed → follow
   `references/cliff-setup.md` first (template in `templates/cliff.toml`). Commit
   `docs: update CHANGELOG.md for v<x.y>.0` on the release branch and push.
7. Open the PR with `github-pull-request` (`base_branch: main`, `auto_merge: false`, title
   `release: <x.y>`, body: the changelog section plus `Closes #<nr>` for the Feature if recorded).
   Report the PR URL; the owner merges it with a merge commit (`gh pr merge --merge`), never squash.

## Gotchas

- Never merge the release PR yourself; the push to `main` builds and publishes the platform matrix.
- Hotfixes bypass this skill (`fix/<nr>-<slug>` from `main`); afterwards merge `main` into the open
  release branch so the fix is not lost.
- A release branch is deleted after its PR merged; GitVersion keeps the version from the tag.

Report: mode, branch, PR URL (finish) or the Feature issue updated (cut).
