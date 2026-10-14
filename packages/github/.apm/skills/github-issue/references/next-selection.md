# Next-PBI selection

Used by the `orchestrator` modes `next <feature|epic>` and by its end line after a `full`, `implement` or `next` run. `gh` only: native sub-issues, blocked-by links and open PRs, no file reads. The snippets are templates: set `$repo` (`owner/repo`), `$nr` (the issue being expanded) and `$candidate` (the PBI being checked).

## Candidates

PBIs are the leaves. For a Feature list its children. For an Epic list the Features first, then expand each Feature in sub-issue order (recursive, one level per call). The filters below apply to Features too: skip every PBI under a Feature that is blocked or labelled `needs-decision`. Keep open issues; sub-issue order is the order the API returns.

```powershell
gh api --paginate repos/$repo/issues/$nr/sub_issues --jq '.[] | select(.state=="open") | {number, title, labels: [.labels[].name]}'
```

Do not descend into `task` children: Tasks belong to their PBI. Skip children labelled `feature` or `epic` once expanded.

## Drop the blocked

Drop a candidate (PBI or Feature) with the label `needs-decision` (open grilling question, `issue-planning` `references/grilling.md`) or with an open blocker. The blocked-by response is a list of issue objects with `.state`:

```powershell
gh api --paginate repos/$repo/issues/$candidate/dependencies/blocked_by --jq '.[] | select(.state=="open") | .number'
```

Any output means blocked. Closed blockers do not count.

## Drop the in flight

A PBI with an open PR is already being worked on: drop it, and report it as waiting for merge. A PR belongs to the PBI when its head branch contains `/<nr>-` or its body has `Closes|Fixes|Resolves #<nr>`:

```powershell
gh pr list --state open --limit 100 --json number,headRefName,body | jq --arg nr $candidate '[.[] | select((.headRefName|test("/"+$nr+"-")) or (.body|test("(?i)(closes|fixes|resolves) #"+$nr+"\\b"))) | .number]'
```

A non-empty list means in flight.

## Pick

The first remaining candidate in sub-issue order is the PBI. Announce it in one line before work starts: `Next PBI: #<nr> <title>`. Exactly one PBI per run.

No candidate: report per remaining open PBI what holds it (open blocker numbers, `needs-decision`, `waiting for merge: PR #<n>`) and stop.

## End line after a PBI run

When the PBI's parent is a Feature (`Parent Feature: #<n>` first body line, or `gh api repos/$repo/issues/$nr/parent --jq .number`), run the same selection on that Feature, excluding the PBI just finished (its PR is open by now):

- Candidate found: `Next: #<nr> <title> — orchestrator next <feature> after /clear`
- None, open PBIs remain: list what blocks each (open blockers, `needs-decision`, `waiting for merge: PR #<n>`).
- No open PBIs left: `Feature #<feature> is done.`

Keep the existing last line `Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).` after it.
