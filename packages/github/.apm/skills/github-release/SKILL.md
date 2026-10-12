---
name: github-release
description: 'Cut a release/<x.y> branch from main or finish it with the release PR and changelog. Use for "cut a release", "finish the release" or when no release branch exists.'
---

Owns the lifecycle of `release/<x.y>` branches; the model and the base-branch resolver are in the
`github-issue` skill's `references/release-branches.md`. No dialogue — tool calls only.

## Prerequisites

- `gh` CLI authenticated, run from the repo root, clean `git status`
- Mode: `cut [<x.y>] [--feature <nr>]` or `finish [release/<x.y>]`

## Instructions

### 1. cut

1. `git fetch origin --tags`. Mode `cut [minor|major|<x.y>] [--feature <nr>]`, default `minor`. Base =
   highest `v<X.Y.Z>` tag on origin (`git ls-remote --tags origin 'v*' | sed 's|.*refs/tags/v||' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1`, `0.0.0` when none).
   `minor` → `<X>.<Y+1>`, `major` → `<X+1>.0`; an explicit `<x.y>` must be greater than `<X>.<Y>`.
   `release/<x.y>` on origin or tag `v<x.y>.0` already exists → stop and report it.
2. `<default>` = `git symbolic-ref refs/remotes/origin/HEAD --short` minus `origin/`, fallback `main`.
   `git checkout -b release/<x.y> origin/<default>`, then the first commit
   `git commit --allow-empty -m "chore: start release <x.y>" -m "+semver: minor"` (`+semver: major` for a
   major bump), `git push -u origin release/<x.y>`. GitVersion ignores branch names: this keyword makes the
   merge into `<default>` tag `v<x.y>.0`; without it the merge only bumps the patch.
3. If `--feature <nr>` → insert `Release branch: release/<x.y>` as the second line of that issue's
   body (`gh issue view <nr> --json body`, `gh issue edit <nr> --body-file -`); keep the `Parent …`
   line first. Child issues inherit it through the resolver.

### 2. finish

4. Branch: the argument, else the current branch if it is `release/*`, else the highest
   `release/<x.y>` on origin (resolver step 4 in `release-branches.md`). `git checkout release/<x.y>; git pull --ff-only`.
5. Open work must be merged first: `gh pr list --base release/<x.y> --state open` must be empty;
   otherwise stop and list the PRs.
6. Open the PR with `github-pull-request` (`base_branch: main`, `auto_merge: false`, title
   `release: <x.y>`, body: the PRs merged into the release branch
   (`gh pr list --base release/<x.y> --state merged --json number,title`) plus `Closes #<nr>` for the
   Feature if recorded). Do not touch `CHANGELOG.md`: the release job on `main` regenerates it with
   git-cliff, tags, publishes the GitHub Release and closes every issue the release's PRs reference
   with `Closes #n` (GravionLabs/ci `gh-release`).
7. Report the PR URL; the owner merges it with a merge commit (`gh pr merge --merge`), never squash.

## Gotchas

- Never merge the release PR yourself; the push to `main` builds and publishes the platform matrix, regenerates the changelog and closes the delivered issues.
- A repo without `cliff.toml` gets no changelog from CI: follow `references/cliff-setup.md` once.
- Hotfixes bypass this skill (`fix/<nr>-<slug>` from `main`); afterwards merge `main` into the open
  release branch so the fix is not lost.
- A release branch is deleted after its PR merged; GitVersion keeps the version from the tag.

Report: mode, branch, PR URL (finish) or the Feature issue updated (cut).
