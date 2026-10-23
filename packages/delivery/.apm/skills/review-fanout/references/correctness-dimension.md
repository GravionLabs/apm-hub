# Correctness dimension: invariants

Planning (`issue-planning`, `references/invariants.md`) lists invariants as an `## Invariants` section inside the body of a PBI, a Task or a `plan.json` item. Review checks the diff against the same list.

## Package (step 1)

The issue section of the package already holds the PBI body and the Task sub-issue bodies (`references/spec-dimension.md`). When `<state>/<issue>/plan.json` exists, also append the `## Invariants` section of each item whose body has one and which has no matching Task issue (`items[].issue` null, or its number is not among the Task sub-issues):

```powershell
"## Invariants (plan)" >> <package>
# per such item: "### <item id> <title>" followed by its `## Invariants` section text
```

`plan.json` missing or unreadable, or no item qualifies: write no `## Invariants (plan)` heading.

## Brief

Check each invariant in the issue section (`## Invariants` of the PBI and its Tasks) and in `## Invariants (plan)` against the diff. A violated invariant is HIGH. `evidence` quotes the invariant and the diff line that violates it; `file`/`line` point at that diff line.

No `## Invariants` anywhere in the package: the brief and the findings are unchanged (bugs, edge cases, error handling, races).

## Verify

A violated invariant is an ordinary HIGH: step 4 tries to disprove it; `refuted` turns it into an advisory, `confirmed` and `unverifiable` stay blocking.
