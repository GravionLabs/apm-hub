---
name: github-release
description: 'Cut the rolling release/next branch or finish it with the release PR and changelog. Use for "cut a release", "finish the release" or when no release branch exists.'
context: fork
---

Owns the lifecycle of the rolling `release/next` branch (explicit `release/<x.y>` only for parallel lines); the model and the base-branch resolver are in the
`github-issue` skill's `references/release-branches.md`. No dialogue except the one bump question in `finish` — tool calls otherwise. On Claude Code it runs in a forked context without the session history.

## Prerequisites

- `gh` CLI authenticated, run from the repo root, clean `git status`
- Mode: `cut [--feature <nr>]` or `finish [release/<x.y>]`

## Instructions

### 1. cut

1. `git fetch origin --tags`. `<default>` = `git symbolic-ref refs/remotes/origin/HEAD --short` minus
   `origin/`, fallback `main`.
2. `release/next` absent on origin → `git checkout -b release/next origin/<default>`, `git push -u origin release/next`.
   Present → reset it to `<default>` by delete and recreate (no force push: the guardrail denies it):
   stop if open PRs target it (`gh pr list --base release/next --state open`), then
   `git push origin --delete release/next`, `git branch -D release/next` (if local), and create it as above.
   No `+semver` commit: the version comes from the GitVersion branch config (`release-branches.md`).
3. If `--feature <nr>` → insert `Release branch: release/next` as the second line of that issue's
   body (`gh issue view <nr> --json body`, `gh issue edit <nr> --body-file -`); keep the `Parent …`
   line first. Child issues inherit it through the resolver.

### 2. finish

4. Branch: the argument, else the current branch if it is `release/*`, else the resolver result (step 4 in
   `release-branches.md`). `git checkout <branch>; git pull --ff-only`.
5. Refuse (stop and report) when `git merge-base --is-ancestor origin/<default> HEAD` fails (branch behind
   `<default>`: merge it in first) or `git merge-base --is-ancestor HEAD origin/<default>` succeeds (head already
   merged: nothing to release, run `cut`).
6. Open work must be merged first: `gh pr list --base <branch> --state open` must be empty;
   otherwise stop and list the PRs.
7. Ask once: bump `minor` (default) or `major`. Minor adds nothing. Major →
   `git commit --allow-empty -m "chore: release major" -m "+semver: major"`, `git push`.
8. The release PR is created and kept current by CI (`release-pr.yml`, GravionLabs/ci
   `versioning/release-pr`): `gh pr list --base <default> --head <branch> --state open --json number,url`.
   None found (no workflow in this repo, or it has not run) → open it with `github-pull-request`
   (`base_branch: <default>`, `auto_merge: false`, title `release: <branch>`, body: the PRs merged into the
   release branch plus `Closes #<nr>` for the Feature if recorded). Do not touch `CHANGELOG.md`: the
   release job on `main` regenerates it with git-cliff, tags, publishes the GitHub Release and closes
   every issue the release's PRs reference with `Closes #n` (GravionLabs/ci `gh-release`).
9. Report the PR URL and `gh pr merge <nr> --merge`; the owner merges with a merge commit, never squash.

## Gotchas

- Never merge the release PR yourself; the push to `main` builds and publishes the platform matrix, regenerates the changelog and closes the delivered issues.
- A repo without `cliff.toml` gets no changelog from CI: follow `references/cliff-setup.md` once.
- Hotfixes bypass this skill (`fix/<nr>-<slug>` from `main`); afterwards merge `main` into
  `release/next` so the fix is not lost.
- `release/next` is never continued after its merge: the next `cut` resets it to `main`.
- The CI release PR title may show the branch name, not the computed version (`release-branches.md`).

Report: mode, branch, PR URL (finish) or the Feature issue updated (cut).
