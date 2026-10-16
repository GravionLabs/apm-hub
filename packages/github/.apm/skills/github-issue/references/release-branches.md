# Release Branches

`main` is released code: a push to `main` builds the platform matrices and publishes. To keep those
builds rare, day-to-day work never targets `main` directly.

| Branch | Cut from | Merged into | Strategy | CI |
| --- | --- | --- | --- | --- |
| `release/next` (rolling; `release/<x.y>` only for parallel lines) | `main` | `main`, once per release, by the `github-release` skill | merge commit (`gh pr merge --merge`), never squash: git-cliff needs the individual conventional commits | Linux checks on the PR, platform builds after the merge |
| `<type>/<nr>-<slug>` | the integration branch | the integration branch | squash | none: `verify-project` and `review-fanout` before the PR are the gate |
| `fix/<nr>-<slug>` hotfix | `main` | `main` | squash | Linux checks on the PR |

The release PR to `main` is created and refreshed by the `release-pr` workflow on every push to the
release branch (GravionLabs/ci `versioning/release-pr`); the owner only merges it.

One rolling branch, `release/next`, serves every release. `github-release cut` creates it from `main`, or
deletes and recreates it from `main` when it is released, i.e. its head is an ancestor of `main` and not equal to it (no force push; the git guardrail allows the remote delete of exactly `release/next`). A head equal to `main` is fresh and usable: `cut` is a no-op. While it holds unreleased work (not an ancestor of `main`), `cut` never resets it. `cut --feature` always only records `Release branch: release/next` when the branch is fresh or unreleased. After its
merge the branch is reset by the next `cut`, never continued, so it can never be released under a stale name.

- **Bump rule:** minor by default, no commit needed. `finish` defaults to minor; `finish major` adds an empty
  `+semver: major` commit once (not again on a repeated finish). Patch releases are hotfixes.
- **Version source:** the GitVersion branch config in `GitVersion.yml`
  (`branches: release: { regex: ^release/next$, increment: Minor }`, `mode: ContinuousDeployment`), not the
  branch name or an empty commit at `cut`.
- **Hotfix path:** `fix/<nr>-<slug>` from `main`, squash into `main`, then merge `main` into `release/next`.
- **Parallel lines:** the exception; cut an explicit `release/<x.y>` by hand and record it in the issue's
  `Release branch:` line. GitVersion's Minor increment applies only to `release/next`, so `finish` on a
  `release/<x.y>` adds `+semver: minor|major` itself when `origin/<default>..HEAD` has none.
- **`finish` guards:** refuses when `release/next` is behind `main`, when its head is an ancestor of
  `main` (equal to it too: a fresh branch has nothing to release), or when open PRs target it.
- **Known limitation:** GravionLabs/ci `versioning/release-pr` may title the release PR with the branch name
  (`release/next`) rather than the computed version; the tag and GitHub Release carry the real version.

## Resolve the integration branch `<base>`

Every skill that creates a branch or a PR resolves `<base>` once, in this order, and stops at the
first hit:

1. An explicit `base_branch` input.
2. A `Release branch: release/next` (or `release/<x.y>`) line in the issue body, else in the body of its parent (follow
   `Parent Feature: #N` / `Parent Epic: #N` lines, one level at a time).
3. The current branch, if it is `release/*`.
4. `release/next` on origin if it exists, else the highest `release/<x.y>` (other `release/*` names are legacy, ignore them):
   `h=$(git ls-remote --heads origin 'release/*' | sed 's|.*refs/heads/||'); printf '%s\n' "$h" | grep -x 'release/next' || printf '%s\n' "$h" | grep -E '^release/[0-9]+\.[0-9]+$' | sort -V | tail -1`
   A `release/next` whose head is an ancestor of `main` but not equal to it (released, not yet reset:
   `git merge-base --is-ancestor origin/release/next origin/main` succeeds and the two SHAs differ) must not
   receive new work: run `github-release cut` first. A head equal to `main` is fresh and usable.
5. None exists → cut one with `github-release cut` (it records the line from step 2 in the Feature
   issue) and use it. Target `main` only when the user explicitly asks for a hotfix.

A PR whose base would be `main` while the head is not `release/*` is a mistake unless the user asked
for a hotfix: stop and report instead of creating it.

`<default>` (the repo default branch, `git symbolic-ref refs/remotes/origin/HEAD --short` minus
`origin/`, fallback `main`) is only used by `github-release` itself.

Issues merged into a release branch carry the label `merged` until the release closes them (`github-release` `references/merged-label.md`).
