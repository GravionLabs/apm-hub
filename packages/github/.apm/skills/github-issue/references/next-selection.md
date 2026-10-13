# Next-PBI selection

Used by the `orchestrator` modes `next <feature|epic>` and by its end line after a `full`, `implement` or `next` run. `gh` only: native sub-issues and blocked-by links, no file reads.

## Candidates

PBIs are the leaves. For a Feature list its children; for an Epic list the children of every Feature, in Feature order (recursive, one level per call). Keep open issues in display order; sub-issue order is the order the API returns.

```powershell
$repo = '{owner}/{repo}'
# Feature: its PBIs; Epic: first the Features, then each Feature's PBIs
gh api repos/$repo/issues/<nr>/sub_issues --jq '.[] | select(.state=="open") | {number, title, labels: [.labels[].name]}'
```

Do not descend into `task` children: Tasks belong to their PBI. Skip children labelled `feature` or `epic` once expanded.

## Drop the blocked

Drop a candidate with the label `needs-decision` (open grilling question, `issue-planning` `references/grilling.md`) or with an open blocker. The blocked-by response is a list of issue objects with `.state`:

```powershell
gh api repos/$repo/issues/<candidate>/dependencies/blocked_by --jq '[.[] | select(.state=="open") | .number]'
```

A non-empty list means blocked. Closed blockers do not count.

## Pick

The first remaining candidate in sub-issue order is the PBI. Announce it in one line before work starts: `Next PBI: #<nr> <title>`. Exactly one PBI per run.

No candidate: report per remaining open PBI what blocks it (open blocker numbers, `needs-decision`) and stop.

## End line after a PBI run

When the PBI's parent is a Feature (`Parent Feature: #<n>` first body line, or `gh api repos/$repo/issues/<pbi>/parent --jq .number`), run the same selection on that Feature, excluding the PBI just finished:

- Candidate found: `Next: #<nr> <title> — orchestrator next <feature> after /clear`
- None, open PBIs remain: list what blocks each (open blockers, `needs-decision`, unmerged PRs via `gh pr list --state open --search "<nr>" --json number,url`).
- No open PBIs left: `Feature #<feature> is done.`

Keep the existing last line `Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).` after it.
