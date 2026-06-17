# Epic Implementation Workflow

Follow this workflow strictly when asked to implement an epic or a set of sub-tasks.

## 1. Release Branch Setup

Ensure your local `main` is clean, then create the long-lived epic release branch:

```bash
git checkout main && git pull --rebase
git checkout -b release/epic-<epic-number>
git push -u origin release/epic-<epic-number>
```

---

## 2. Implement Sub-tasks in Strict Sequence

You **must** implement sub-tasks in the exact sequence specified by the epic's checklist or description. For each sub-task in order:

### a. Read the Sub-task Issue

```bash
gh issue view <sub-task-number>
```

### b. Create the Sub-task Feature Branch

Branch off the **release branch**:

```bash
git checkout release/epic-<epic-number>
git pull
git checkout -b <type>/<sub-task-number>-<slug>
```

### c. Implement the Changes

- Follow the exact file changes described in the sub-task issue body.
- Never delete old files that are explicitly marked for a later sub-task.
- If a sub-task says "do not delete the old files yet", follow that exactly.

### d. Verify: Build, Lint, Test

Run build, lint, and tests per the detected package manager. Load `detect-techstack` skill to determine the correct commands.

Only proceed to the commit if all three exit successfully.

### e. Commit

```bash
git add <files>
git commit -m "<type>(<scope>): <description> (#<sub-task-number>)

<optional body explaining what changed and why>

Part of epic #<epic-number>"
```

Use the conventional-commit type from the sub-task title.

### f. Push & Create PR to the Release Branch

```bash
git push -u origin <type>/<sub-task-number>-<slug>
gh pr create \
  --title "<sub-task-title> (#<sub-task-number>)" \
  --base release/epic-<epic-number> \
  --head <type>/<sub-task-number>-<slug> \
  --body "Part of epic #<epic-number>."
```

### g. Request Copilot Review

```bash
gh pr edit <pr-number> --add-reviewer "github-copilot[bot]"
```

### h. Auto-merge & Close Sub-task

```bash
gh pr merge <pr-number> --auto --squash
```

Wait for the merge to complete, then close the sub-task issue:

```bash
gh issue close <sub-task-number> --reason completed
```

---

## 3. Final Epic Release PR

When all sub-tasks are implemented and merged into `release/epic-<epic-number>`:

### a. Create the PR against `main`

```bash
gh pr create \
  --title "[EPIC] <epic-title> (#<epic-number>)" \
  --base main \
  --head release/epic-<epic-number> \
  --label "<labels-from-issue>" \
  --body "## Summary

Closes #<epic-number>.

## Sub-tasks completed

- [x] #<sub-1>
- [x] #<sub-2>
..."
```

### b. Request Review

```bash
gh pr edit <release-pr-number> --add-reviewer "github-copilot[bot]"
```

**Do not enable auto-merge and do not close/merge this PR.** It must stay open for review.

---

## Notes

- Epics use `release/epic-<N>` as the long-lived base branch; sub-task feature branches merge into that release branch.
- The final release PR targets `main` and stays open for review.
- Sub-task issues are closed immediately after their PR merges into the release branch.
- The epic issue is closed automatically when the release PR merges into `main`.
