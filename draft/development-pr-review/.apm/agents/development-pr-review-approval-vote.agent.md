---
description: "Sets the Azure DevOps Pull Request reviewer vote based on the severity of findings. Critical/High/Medium issues result in Waiting for Author (-5). Low/Info only results in Approved with Suggestions (+5). No issues results in Approved (+10)."
name: development-pr-review-approval-vote
model: gpt-5-mini
tools: ['ado/*']
user-invocable: false
---

## Purpose

Cast the appropriate reviewer vote on an ADO PR based on findings severity counts.

---

## Input Expected

- `PR_ID`, `REPO_ID`, `PROJECT_NAME`
- `CRITICAL_COUNT`, `HIGH_COUNT`, `MEDIUM_COUNT`, `LOW_COUNT` (from `pr-comment-poster`)

---

## Vote Decision Logic

| Condition | Vote | Label |
|---|---|---|
| Any Critical, High, or Medium findings | -5 | Waiting for Author |
| Only Low/Info findings | +5 | Approved with Suggestions |
| Zero findings | +10 | Approved |

---

## Step 1 — Cast Vote

```
ado-repo_vote_pull_request(
  repositoryId: REPO_ID,
  pullRequestId: PR_ID,
  vote: <Approved | ApprovedWithSuggestions | WaitingForAuthor>
)
```

Vote mapping:
- Critical/High/Medium > 0 → `WaitingForAuthor`
- Only Low > 0 → `ApprovedWithSuggestions`
- All counts = 0 → `Approved`

---

## Output

```
VOTE_CAST: <Approved | ApprovedWithSuggestions | WaitingForAuthor>
MESSAGE: <human-readable status message>
```

Examples:
```
✅ Done: No issues found — Approved
⚠️  Done: 3 critical/high/medium issues — Waiting for Author
✅ Done: 2 low severity suggestions — Approved with Suggestions
```
