# Spec dimension

Compares the diff with the originating issue. Input is the issue section of the package file (title, body, Task sub-issue bodies).

## Resolving the issue (step 1)

First hit wins:

1. The integer issue argument (distinct from the PR `<nr>` in PR mode).
2. The branch name `<type>/<nr>-<slug>` (`git branch --show-current`; PR: `headRefName`).
3. `Closes #n` in the commit messages of the range; in PR mode in the PR body or its commits, first hit wins.

Append the issue to the package file; the `## Issue #<nr>` heading and readable text are written, not raw JSON:

```powershell
"## Issue #<nr>" >> <package>
gh issue view <nr> --json title,body --jq '"# \(.title)\n\(.body)"' >> <package>
gh api --paginate repos/{owner}/{repo}/issues/<nr>/sub_issues --jq '.[] | select(any(.labels[]; .name == "task")) | "\n---\n### Task #\(.number) \(.title)\n\(.body // "")"' >> <package>
```

`<nr>` must be an integer. No issue found or `gh` fails → write no issue section; `spec` returns one finding "no spec available" with severity LOW, placeholder location `file` = the package path, `line` = 1, which review-fanout routes straight into `advisory` (never blocking).

## Brief

Report only against criteria quoted from the issue or its Tasks:

- (a) criteria that are missing or only partly implemented
- (b) scope creep: behavior in the diff nobody asked for
- (c) criteria that look implemented but are wrong

Severity: unmet criterion HIGH, scope creep MEDIUM. `evidence` quotes the criterion line (scope creep: the diff line plus the closest criterion, or "none"). `file`/`line` point at the code, or the closest changed file when the criterion is missing entirely.

## Dedupe

`spec` findings only merge with other `spec` findings; they are never merged with `conventions` or any other dimension (different axes), even on the same file and evidence.
