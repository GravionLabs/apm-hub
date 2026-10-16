# The `merged` label

`Closes #n` fires only on the default branch, so PBIs and Tasks merged into `release/*` stay open until the release. The label `merged` marks them.

## Lifecycle

1. A PR merges into a `release/*` branch. The workflow step `GravionLabs/ci/versioning/mark-merged-issues@main` (`release-branch.yml` template) adds `merged` to every issue the PR closes or references, comments on it, and labels the parent PBI and Feature once their children are merged.
2. The issue stays open and keeps the label while the release branch is unreleased.
3. The release lands on `main`: `close-release-issues` (`gh-release`) closes the issue and removes `merged`.

Labels can be edited by hand, so skills treat `merged` as a fast path only (`next-selection.md` in `github-issue`).

## Rollout to existing repos

One PR per repo: copy `templates/release-branch.yml` to `.github/workflows/release-pr.yml` (merge the step into an existing file if there is one) and open the PR with `github-pull-request`. `cut` offers this when no workflow in `.github/workflows/` uses `mark-merged-issues`.

## Permissions

- The workflow needs `contents: read`, `issues: write`, `pull-requests: write` (`release-pr`; `mark-merged-issues` itself needs `pull-requests: read`).
- `secrets.GH_PAT || github.token`: a PAT is needed so PRs created by CI trigger the required checks; labelling works with `github.token`.
- The action is used `@main`, so fixes arrive centrally without touching the repos.

## Known limit

`release-pr` accepts only `release/<x.y>` and ignores `release/next` (GravionLabs/ci#55). The labelling step is a separate action and is not affected.
