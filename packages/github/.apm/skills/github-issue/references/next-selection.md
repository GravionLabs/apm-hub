# Next-PBI selection

Used by the `orchestrator` modes `next <feature|epic>` and `loop <feature|epic>` (`loop-mode.md`) and by its end line after a `full`, `implement` or `next` run. `gh` and `git log` on the fetched integration branch: native sub-issues, blocked-by links, open and merged PRs, no file reads. The snippets are templates: set `$repo` (`owner/repo`), `$nr` (the issue being expanded) and `$candidate` (the PBI being checked).

## Candidates

PBIs are the leaves. For a Feature list its children. For an Epic list the Features first, then expand each Feature in sub-issue order (recursive, one level per call). The filters below apply to Features too: skip every PBI under a Feature that is blocked or labelled `needs-decision`. Keep open issues; sub-issue order is the order the API returns. Drop merged PBIs (`## Merged (closes at release)`). Under an Epic a merged Feature (rule below) counts as done and is skipped like a closed one.

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

## Merged (closes at release)

A PBI counts as merged when (a) a PR merged into the integration branch targets it or (b) a commit on the remote integration branch references it. PBIs stay open after the merge because CI closes them only when the release lands on `main`: never close them by hand, never re-propose them. A Feature counts as merged when it has at least one open PBI and every open PBI is merged (a Feature whose PBIs are all closed is done, not merged). Under an Epic, report merged Features like PBIs: `merged, closes at release: Feature #<n>`. Check merged first, before the blocked and in flight drops, so a merged PBI is reported as `merged, closes at release` even with an open blocker or PR.

`$candidate` must match `^[0-9]+$` for both checks; `<integration-branch>` comes from `release-branches.md`. (a) is the open-PR check with `--state merged --base <integration-branch>`, searched by number only (search terms are ANDed) and decided by the jq filter; a non-empty list means merged (`--limit 100` caps recall; (b) is the second net):

```powershell
gh pr list --state merged --base <integration-branch> --limit 100 --search "$candidate" --json number,headRefName,body | jq --arg nr $candidate '[.[] | select((.headRefName|test("/"+$nr+"-")) or (.body|test("(?i)(closes|fixes|resolves) #"+$nr+"\\b"))) | .number]'
```

(b) Run `git fetch origin <integration-branch>` once, before the first check. Any output of the following means merged (the trailing group keeps `#24` from matching `#249`):

```powershell
git log -E -i --grep "(close[sd]?|fix(e[sd])?|resolve[sd]?):? #$candidate([^0-9]|$)" origin/<integration-branch> --format=%h -1
```

## Pick

The first remaining candidate in sub-issue order is the PBI. Announce it in one line before work starts: `Next PBI: #<nr> <title>`. Exactly one PBI per run; `loop` repeats the selection per `loop-mode.md`.

No candidate: report per remaining open PBI what holds it (open blocker numbers, `needs-decision`, `waiting for merge: PR #<n>`, `merged, closes at release`) and stop.

## End line after a PBI run

When the PBI's parent is a Feature (`Parent Feature: #<n>` first body line, or `gh api repos/$repo/issues/$nr/parent --jq .number`), run the same selection on that Feature, excluding the PBI just finished (its PR is open by now):

- Candidate found: `Next: #<nr> <title> — orchestrator next <feature> after /clear`
- None, open PBIs remain: list what blocks each (open blockers, `needs-decision`, `waiting for merge: PR #<n>`). List merged PBIs separately: `merged, closes at release: #<a>, #<b>`.
- No open PBI left: `Feature #<feature> is done.` Every open PBI merged: `Feature #<feature> is done — merged, closes at release: #<a>, #<b>`.

Keep the existing last line `Ledger complete. Start the next issue in a new session (/clear or a new orchestrator run).` after it.
