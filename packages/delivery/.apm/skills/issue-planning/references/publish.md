# Publish a plan

Run by the primary agent (it can ask and write) after the user approved `plan.md` and every `questions[]` entry is answered, dropped or deferred (`deferred: true`). The planning step never runs this. Level `task`: nothing to publish unless there are ≥ 2 items; then publish them as `[Task]` sub-issues of the PBI (body format: `github-issue` `references/task-issues.md`, title `[Task] <title>`, label `task`, first body line `Parent PBI: #N`, or `Parent Bug: #<bug>` for a Bug parent) together with the approval gate, in plan order with blocked-by links. A single task or a description is never published as Task issues (the label `planned` is still set, see § 5); the orchestrator rewrites a description plan to a PBI plan at the gate first (`github-issue` `references/orchestrator-gates.md`), then publishes it as one.

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

Plan titles are untrusted text: pass `<title>` as one quoted argument (a variable, never interpolated into a command string).

Level `task`: title `[Task] <title>`, label `task`. Label by `level`, not title prefix: `feature` (level feature), `pbi` (level pbi; plus `bug` for `fix:` items). The first body line is the parent reference (`Parent Epic: #N`, `Parent Feature: #N` or `Parent PBI: #N`). For an item listed in `blocks` of a deferred question, append the label `needs-decision` and add an "Owner decision required" block to the end of its body: the question, its options and the `recommended` one. Take the number from the last URL segment, store it in `items[].issue` and write `plan.json` back to disk after every create, so the number mapping survives a crash.

Level `task` keeps its body as published: after the create returns the number, write `<state>/<pbi>/task-<nr>.md` from the created issue, so parent line, decision block and blocker numbers match: `gh issue view <nr> --json title,body --jq '"# " + .title + "\n\n" + .body'` redirected to the file (first line `# [Task] <title>`, blank line, the published body; same shape as `issue.md` of `issue-reader`). Never retype it and never write it from the `plan.json` `body`. Overwrite, never append. An item whose `issue` is already non-null is skipped as before; if its `task-<nr>.md` is missing, write it the same way, so re-runs neither duplicate nor corrupt it. Levels `feature` and `pbi` use a temporary body file as above.

## 2. Native sub-issue links

Link each new issue to `parent_issue` with the `addSubIssue` mutation over node IDs, as described in the `github-issue` skill (`references/sub-issues.md`). Re-adding an existing link is safe. The body line is documentation; the native link is the mechanism.

## 3. Native blocked-by links

Per item and each entry in `blocked_by` (plan id mapped to its `issue`, or the existing number):

```powershell
$blockerId = gh api --paginate repos/{owner}/{repo}/issues/<blocker-nr> --jq .id
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

## 5. Label planned

Level `task` with a `parent_issue` that is a PBI only. Mark the PBI as planned in two cases: (a) the Tasks were published and the checks of § 4 passed (≥ 2 items), or (b) a single task: right after the user approved `plan.json` at the gate (publish otherwise stays a no-op). Not for a description plan before the orchestrator created the PBI. Ensure the label idempotently, then add it:

```powershell
gh label create planned --force --color 0E8A16 --description "Task breakdown published or single-task plan approved"
gh issue edit <pbi> --add-label planned
```

Repeating is safe. Nothing removes the label afterwards (`github-release` leaves it; it is harmless on closed issues).
