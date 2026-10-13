# Spec dimension

Compares the diff with the originating issue. Input is the issue section of the package file (title, body, Task sub-issue bodies).

## Resolving the issue (step 1)

First hit wins:

1. The issue number passed as argument.
2. The branch name `<type>/<nr>-<slug>` (`git branch --show-current`; PR: `headRefName`).
3. `Closes #n` in the commit messages of the range.

Append to the package file under `## Issue #<nr>`:

```powershell
gh issue view <nr> --json title,body >> <package>
gh api repos/{owner}/{repo}/issues/<nr>/sub_issues --jq '.[] | "### Task #\(.number) \(.title)\n\(.body)"' >> <package>
```

`<nr>` must be an integer. No issue found or `gh` fails → write no issue section; `spec` returns one advisory finding "no spec available" and never fails.

## Brief

Report only against criteria quoted from the issue or its Tasks:

- (a) criteria that are missing or only partly implemented
- (b) scope creep: behavior in the diff nobody asked for
- (c) criteria that look implemented but are wrong

Severity: unmet criterion HIGH, scope creep MEDIUM. `evidence` quotes the criterion line (scope creep: the diff line plus the closest criterion, or "none"). `file`/`line` point at the code, or the closest changed file when the criterion is missing entirely.

## Dedupe

`spec` and `conventions` findings are never merged with each other (different axes), even on the same file and evidence.
