# Release Branches

`main` is released code: a push to `main` builds the platform matrices and publishes. To keep those
builds rare, day-to-day work never targets `main` directly.

| Branch | Cut from | Merged into | Strategy | CI |
| --- | --- | --- | --- | --- |
| `release/<x.y>` | `main` | `main`, once per release, by the `github-release` skill | merge commit (`gh pr merge --merge`), never squash: git-cliff needs the individual conventional commits | Linux checks on the PR, platform builds after the merge |
| `<type>/<nr>-<slug>` | the integration branch | the integration branch | squash | none: `verify-project` and `review-fanout` before the PR are the gate |
| `fix/<nr>-<slug>` hotfix | `main` | `main` | squash | Linux checks on the PR |

One release branch per Feature (or milestone). Its name is the version it releases: GitVersion reads
`release/1.4` as `1.4.0`, so after the merge `main` is `1.4.0`.

## Resolve the integration branch `<base>`

Every skill that creates a branch or a PR resolves `<base>` once, in this order, and stops at the
first hit:

1. An explicit `base_branch` input.
2. A `Release branch: release/<x.y>` line in the issue body, else in the body of its parent (follow
   `Parent Feature: #N` / `Parent Epic: #N` lines, one level at a time).
3. The current branch, if it is `release/*`.
4. The highest `release/<x.y>` on origin (other `release/*` names are legacy branches, ignore them):
   `git ls-remote --heads origin 'release/*' | sed 's|.*refs/heads/||' | grep -E '^release/[0-9]+\.[0-9]+$' | sort -V | tail -1`
5. None exists → cut one with `github-release cut` (it records the line from step 2 in the Feature
   issue) and use it. Target `main` only when the user explicitly asks for a hotfix.

A PR whose base would be `main` while the head is not `release/*` is a mistake unless the user asked
for a hotfix: stop and report instead of creating it.

`<default>` (the repo default branch, `git symbolic-ref refs/remotes/origin/HEAD --short` minus
`origin/`, fallback `main`) is only used by `github-release` itself.
