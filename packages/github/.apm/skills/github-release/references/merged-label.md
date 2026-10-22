# The `merged` label

`Closes #n` fires only on the default branch, so PBIs and Tasks merged into `release/*` stay open until the release. The label `merged` marks them.

## Lifecycle

1. A PR merges into a `release/*` branch. The workflow step `GravionLabs/ci/versioning/mark-merged-issues@main` (`release-branch.yml` template) adds `merged` to every issue the PR closes or references, comments on it, and labels the parent PBI and Feature once their children are merged. The next step `Set project status In release` sets the project Status `In release` on the same issues: those the merged PR closes (`closingIssuesReferences`) plus those named with a keyword (`Refs #n`, `Closes #n`, `Fixes #n`) in the PR body or its commits, so Refs-only issues and PRs into `release/next` are covered. Only merged PRs whose base is the pushed branch count.
2. The issue stays open and keeps the label while the release branch is unreleased.
3. The release lands on `main`: `close-release-issues` (`gh-release`) closes the issue and removes `merged`.

The project status `In release` is set by that CI step; `github-project sync` stays the repair path. The label stays the source of truth.

Labels can be edited by hand, so skills treat `merged` as a fast path only (`next-selection.md` in `github-issue`).

## Rollout to existing repos

One PR per repo: copy `templates/release-branch.yml` to `.github/workflows/release-pr.yml` (merge the step into an existing file if there is one) and open the PR with `github-pull-request`. `cut` offers this when no workflow in `.github/workflows/` uses `mark-merged-issues`.

## Permissions

- The workflow needs `contents: read`, `issues: write`, `pull-requests: write` (`release-pr`; `mark-merged-issues` itself needs `pull-requests: read`).
- `secrets.GH_PAT || github.token`: a PAT is needed so PRs created by CI trigger the required checks; labelling works with `github.token`.
- Project status: the `Set project status In release` step needs a token with scope `project` (classic PAT `project`, or fine-grained with Projects read/write) in secret `PROJECT_TOKEN`, else `GH_PAT`. The fallback PAT only needs the project scope (`project`); no extra repository scope is required for this step. Without it the job sets only the label and emits a warning. Issues without a project entry or already `Done`/`In release` are skipped; failures per issue are warnings and never fail the job.
- The action is used `@main`, so fixes arrive centrally without touching the repos.

## Known limit

`release-pr` accepts only `release/<x.y>` and ignores `release/next` (GravionLabs/ci#55). The labelling step is a separate action and is not affected. Check the issue for the current state. The status step is inline in the template and independent of `release-pr`.
