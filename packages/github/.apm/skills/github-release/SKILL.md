---
name: github-release
description: 'Cut the rolling release/next branch or finish it with the release PR and changelog. Use for "cut a release", "finish the release" or when no release branch exists.'
context: fork
---

Owns the lifecycle of the rolling `release/next` branch (explicit `release/<x.y>` only for parallel lines); the model and the base-branch resolver are in the
`github-issue` skill's `references/release-branches.md`. No dialogue — tool calls only. On Claude Code it runs in a forked context without the session history.

## Prerequisites

- `gh` CLI authenticated, run from the repo root, clean `git status`
- Mode: `cut [--feature <nr>]` or `finish [major] [release/next|release/<x.y>]`

## Instructions

### 1. cut

1. `git fetch origin --tags`. `<default>` = `git symbolic-ref refs/remotes/origin/HEAD --short` minus
   `origin/`, fallback `main`.
2. `release/next` absent on origin → `git checkout -b release/next origin/<default>`, `git push -u origin release/next`.
   Present on origin → compare `git rev-parse origin/release/next origin/<default>` and
   `git merge-base --is-ancestor origin/release/next origin/<default>`:
   - head equals `<default>` (fresh) or is not an ancestor (unreleased work): never reset, `cut` is a no-op.
     With `--feature <nr>` record the line (step 3); without it report the branch.
   - ancestor but not equal (released): reset by delete and recreate (no force push). Stop first if open PRs
     target it (`gh pr list --base release/next --state open`; deleting closes the CI release PR) or
     `git rev-list origin/release/next..release/next` (local, if the branch exists) is not empty. Then
     `git push origin --delete release/next` (the guardrail allows exactly this), then
     `git checkout -B release/next origin/<default>` (no local delete), `git push -u origin release/next`.
   No `+semver` commit: the version comes from the GitVersion branch config (`release-branches.md`).
2a. `grep -l mark-merged-issues .github/workflows/*.yml` finds nothing → tell the user the repo does not label
   merged issues and offer to copy `templates/release-branch.yml` to `.github/workflows/release-pr.yml`
   (never silently; one PR per repo, see `references/merged-label.md`).
3. If `--feature <nr>` → insert `Release branch: release/next` as the second line of that issue's
   body (`gh issue view <nr> --json body`, `gh issue edit <nr> --body-file -`); keep the `Parent …`
   line first. Child issues inherit it through the resolver.

### 2. finish

4. Branch: the argument, else the current branch if it is `release/*`, else the resolver result (step 4 in
   `release-branches.md`). It must match `^release/(next|[0-9]+\.[0-9]+)$`, else stop.
   `git checkout "$branch" --; git pull --ff-only`.
5. Refuse (stop and report) when `git merge-base --is-ancestor origin/<default> HEAD` fails (branch behind
   `<default>`: merge it in first) or `git merge-base --is-ancestor HEAD origin/<default>` succeeds (head equals
   `<default>` or already merged: nothing to release, no commits ahead; run `cut` if released).
6. Open work must be merged first: `gh pr list --base <branch> --state open` must be empty;
   otherwise stop and list the PRs.
7. Bump: `minor` by default, `major` only when the argument `major` is given (or the user answered major
   when run in the main context); never ask in a fork. On `release/next` minor adds nothing; major adds
   `git commit --allow-empty -m "chore: release major" -m "+semver: major"` + `git push`, only if
   `git log origin/<default>..HEAD -F --grep '+semver: major'` is empty. A `release/<x.y>` branch has no
   GitVersion Minor config: add `+semver: minor|major` the same way (message `chore: release minor|major`)
   when `origin/<default>..HEAD` has no `+semver:` commit.
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
- The `merged` label lifecycle and rollout: `references/merged-label.md`.
- A repo without `cliff.toml` gets no changelog from CI: follow `references/cliff-setup.md` once.
- Hotfixes bypass this skill (`fix/<nr>-<slug>` from `main`); afterwards merge `main` into
  `release/next` so the fix is not lost.
- `release/next` is never continued after its merge: the next `cut` resets it to `main`.
- The CI release PR title may show the branch name, not the computed version (`release-branches.md`).

Report: mode, branch, PR URL (finish) or the Feature issue updated (cut).
