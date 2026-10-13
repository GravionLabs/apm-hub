# Publish a plan

Run by the primary agent (it can ask and write) after the user approved `plan.md` and every `questions[]` entry is answered or dropped. The planning step never runs this. Level `task`: nothing to publish.

Resolve `{owner}/{repo}`. Create items in dependency order (an item after everything in its `blocked_by`), so each blocker has an issue number first.

## 1. Create

For each item: write `body` to a file and run

```powershell
gh issue create --title "<title>" --body-file <file> --label <epic|feature|pbi|bug>
```

The first body line is the parent reference (`Parent Epic: #N` or `Parent Feature: #N`). Take the number from the last URL segment and store it in `items[].issue`.

## 2. Native sub-issue links

Link each new issue to `parent_issue` with the `addSubIssue` mutation over node IDs, exactly as in `packages/github/.apm/skills/github-issue/references/sub-issues.md`. The body line is documentation; the native link is the mechanism.

## 3. Native blocked-by links

Per item and each entry in `blocked_by` (plan id mapped to its `issue`, or the existing number):

```powershell
$blockerId = gh api repos/{owner}/{repo}/issues/<blocker-nr> --jq .id
gh api -X POST repos/{owner}/{repo}/issues/<item-nr>/dependencies/blocked_by -F issue_id=$blockerId
```

`issue_id` is the numeric REST id, not the issue number and not the GraphQL node id.

## 4. Verify

Both checks must pass before reporting success. A created but unlinked issue looks normal in `gh issue list`.

```powershell
gh api repos/{owner}/{repo}/issues/<parent-nr>/sub_issues --jq '[.[].number]'
gh api repos/{owner}/{repo}/issues/<item-nr>/dependencies/blocked_by --jq '[.[].number]'
```

The first must list every created number; the second must list every expected blocker of that item. Fix missing links and re-check; report any that still fail.
