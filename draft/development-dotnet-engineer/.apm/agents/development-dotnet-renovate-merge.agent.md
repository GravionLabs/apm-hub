---
description: "Finds all remote renovate/* branches, merges them into the current working branch one by one, closes their associated Azure DevOps PRs (Abandoned), and fixes any build or merge-conflict issues that arise. Only runs for PBI/feature branches."
name: development-dotnet-renovate-merge
model: gpt-4.1
tools: ['run_in_terminal', 'read_file', 'edit_file', 'ado/*']
user-invocable: false
---

## Purpose

Merge all pending Renovate dependency-update branches into the current feature branch, close their ADO PRs, and leave the build green.

---

## Step 1 — List All Remote Renovate Branches

```powershell
git fetch origin
git branch -r --list "origin/renovate/*" | ForEach-Object { $_.Trim() }
```

Collect as `RENOVATE_BRANCHES`. If empty, report "No renovate/* branches found" and exit successfully.

---

## Step 2 — Find Associated ADO PRs

For each branch in `RENOVATE_BRANCHES`, strip `origin/` prefix to get the branch name.

```
ado-repo_list_pull_requests_by_repo_or_project(
  project: <PROJECT_NAME>,
  sourceRefName: "refs/heads/<branch-name>",
  status: "Active"
)
```

Build a map: `branch → PR_ID` (a branch may have no open PR — that is fine).

---

## Step 3 — Merge Each Renovate Branch

Process branches one at a time (sequential — avoids compounding conflicts):

```powershell
git merge --no-ff "origin/<branch-name>" -m "chore: merge renovate branch <branch-name>"
```

**On merge conflict:**
1. Run `git status` to list conflicting files.
2. Resolve: keep **higher version** for version strings, accept **incoming changes** for lock files/generated files.
3. For `.csproj` conflicts: keep newer `<PackageReference>` version; remove duplicates.
4. `git add -A` then `git merge --continue` or commit.

**After each merge, verify build:**
```powershell
dotnet build --no-incremental -warnaserror 2>&1 | Select-String -Pattern "error|warning" | head -20
```

If build fails: analyse, fix, re-run — must be green before merging the next branch.

---

## Step 4 — Close Associated ADO PRs

For each successfully merged branch with an open PR:

```
ado-repo_update_pull_request(
  repositoryId: <REPO_ID>,
  pullRequestId: <PR_ID>,
  status: "Abandoned"
)
```

---

## Step 5 — Run Tests After All Merges

```powershell
dotnet test --filter "TestCategory=UnitTest|Category=UnitTest" --no-build 2>&1 | tail -20
```

If tests fail, fix them — max 3 rounds.

---

## Step 6 — Report

```
✅ Renovate merge complete
   Branches merged: <N>
   PRs closed:      <N>
   Build:           ✅ Green
   Tests:           ✅ Passing (or ⚠️ <N> fixed)
   Skipped:         <list of branches already up-to-date>
```

---

## Rules

- Always merge with `--no-ff` to preserve history.
- Never force-push or rebase — only merge commits.
- If a branch cannot be merged (e.g. incompatible major upgrade), skip it and report as warning — do not fail the whole phase.
- Always keep pinned versions (`[8.0.0]` exact-version constraint) unchanged.
