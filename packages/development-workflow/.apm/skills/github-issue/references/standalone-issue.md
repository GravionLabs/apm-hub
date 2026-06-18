# Standalone Issue Implementation Workflow

Follow this workflow strictly when asked to implement a standalone issue (an issue without any parent epic or checklist of sub-tasks).

## 1. Git Setup

Ensure `main` is clean, then branch directly off `main`:

```bash
git checkout main && git pull --rebase
git checkout -b <type>/<issue-number>-<slug>
```

Derive `<slug>` from the issue title: lowercase, spaces replaced with `-`, remove parenthetical scope, max ~40 chars.

Use the conventional-commit type from the issue title as prefix:
- `feat(...)` → `feat/<number>-<slug>`
- `refactor(...)` → `refactor/<number>-<slug>`
- `fix(...)` → `fix/<number>-<slug>`
- `chore(...)` → `chore/<number>-<slug>`

## 2. Implement the Changes

- Follow the exact file changes described in the issue body.
- Keep commits focused: one commit per issue.

## 3. Verify: Build, Lint, Test

Run build, lint, and tests per the detected package manager. Load `detect-techstack` skill to determine the correct commands.

Only proceed to the commit if all three exit successfully.

## 4. Commit & Push

```bash
git add <files>
git commit -m "<type>(<scope>): <description> (#<issue-number>)"
git push -u origin <type>/<issue-number>-<slug>
```

## 5. Create PR against `main`

```bash
gh pr create \
  --title "<issue-title> (#<issue-number>)" \
  --base main \
  --head <type>/<issue-number>-<slug> \
  --label "<labels-from-issue>" \
  --body "Closes #<issue-number>."
```

## 6. Request Copilot Review

```bash
gh pr edit <pr-number> --add-reviewer "github-copilot[bot]"
```

## 7. Auto-merge

```bash
gh pr merge <pr-number> --auto --squash
```

Auto-merge will trigger once all required status checks pass (CI build, tests, lint) and Copilot review is approved.

## 8. Monitor Until Done

```bash
gh pr checks <pr-number> --watch
```

When the merge completes, confirm:

```bash
gh pr view <pr-number> --json state,mergedAt
```

---

## Notes

- **Do not auto-merge** if the user says "just create the PR" or "don't merge" — skip step 7.
- If the build or tests fail, fix the issue before committing. Do not commit a broken state.
