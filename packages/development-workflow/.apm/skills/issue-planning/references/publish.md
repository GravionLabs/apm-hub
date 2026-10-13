# Publish a plan

Run by the primary agent (it can ask and write) after the user approved `plan.md` and every `questions[]` entry is answered, dropped or deferred (`deferred: true`). The planning step never runs this. Level `task`: nothing to publish.

Resolve `{owner}/{repo}`. The run is idempotent: skip items whose `issue` is already non-null, and repeat only what is missing. Create items in dependency order (an item after everything in its `blocked_by`), so each blocker has an issue number first.

## 1. Create

If any question has `deferred: true`, first ensure the label exists (idempotent):

```powershell
gh label create needs-decision --force --description "Blocked on an owner decision"
```

For each item: write `body` to a file and run

```powershell
gh issue create --title "<title>" --body-file <file> --label <label>
```

Label by item level: `feature` for `Feature:` items, `pbi` for `feat:` / `chore:` items, `pbi` plus `bug` for `fix:` items. The first body line is the parent reference (`Parent Epic: #N` or `Parent Feature: #N`). For an item listed in `blocks` of a deferred question, append the label `needs-decision` and add an "Owner decision required" block to the end of its body: the question, its options and the `recommended` one. Take the number from the last URL segment, store it in `items[].issue` and write `plan.json` back to disk after every create, so the number mapping survives a crash.

## 2. Native sub-issue links

Link each new issue to `parent_issue` with the `addSubIssue` mutation over node IDs, as described in the `github-issue` skill (`references/sub-issues.md`). Re-adding an existing link is safe. The body line is documentation; the native link is the mechanism.

## 3. Native blocked-by links

Per item and each entry in `blocked_by` (plan id mapped to its `issue`, or the existing number):

```powershell
$blockerId = gh api repos/{owner}/{repo}/issues/<blocker-nr> --jq .id
gh api -X POST repos/{owner}/{repo}/issues/<item-nr>/dependencies/blocked_by -F issue_id=$blockerId
```

Integer `blocked_by` entries (existing issues) are linked the same way, even when the item is new. Repeating a link that exists is safe. `issue_id` is the numeric REST id, not the issue number and not the GraphQL node id.

## 4. Verify

Both checks must pass before reporting success. A created but unlinked issue looks normal in `gh issue list`.

```powershell
gh api repos/{owner}/{repo}/issues/<parent-nr>/sub_issues --jq '[.[].number]'
gh api repos/{owner}/{repo}/issues/<item-nr>/dependencies/blocked_by --jq '[.[].number]'
```

The first must list every created number; the second must list every expected blocker of that item. Fix missing links and re-check; report any that still fail.

Set `status` to `published` when both checks pass, else `partial` with the failing step in `summary`, and write the file back.
