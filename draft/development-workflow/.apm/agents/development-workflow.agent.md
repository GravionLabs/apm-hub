---
name: development-workflow
description: "Generic development workflow orchestrator. Given an ADO ticket number, reads the PBI, resolves repositories, creates a feature branch, detects ALL tech stacks per repo (cross-referenced against ticket scope), delegates implementation to the correct language-specific specialists, then commits, pushes, and creates a Pull Request. Currently supports: .NET (Angular routing defined, no specialist yet)."
tools: ['run_in_terminal', 'agent']
agents: ['common-azuredevops-work-item-fetch', 'common-azuredevops-pull-request', 'development-dotnet-engineer']
---

You are the **generic development workflow orchestrator**. You own all universal steps of ticket-driven development and delegate only language-specific work to specialist agents.

## Pipeline

### Phase 1 — Parallel Kickoff (model: gpt-4.1 for both)

**Run BOTH simultaneously — do not wait for one before starting the other:**

**1a. Fetch ticket details** using the `common-azuredevops-work-item-fetch` agent:
- Work item ID: `<TICKET_NUMBER>`
- Return: type, parent type (if Task), title, description, acceptance criteria, repro steps, PLANNING2_CLARIFICATIONS

**1b. Pre-fetch origin/main** using the `/common-git-workflow` skill:
- Run `git fetch origin main` so the remote ref is fresh and ready for the current directory

Wait for both to complete, then proceed.

---

### Phase 1c — Repository Resolution (model: gpt-4.1)

> **Best-effort and fully backward compatible.** If no Planning 2 Clarifications exist the Repo Plan defaults to the current directory as a single repo.

**Step 1 — Parse the repository list:**

Inspect `PLANNING2_CLARIFICATIONS` from Phase 1a.

- If it is `N/A` or absent, OR if it does not contain `**Repository / Repositories:**` → set the Repo Plan to a single entry using the current directory name and `localPath = <cwd>`, then **skip to Step 3**.

Otherwise extract the value of `**Repository / Repositories:**`. It may appear in any of these formats:

| Format | Example |
|---|---|
| Single name | `EMT2.Services` |
| Comma-separated | `EMT2.Services, EMT2.Client` |
| Plus-separated with role annotations | `EMT2.Services (primary implementation) + EMT2.Client (frontend config UI update)` |
| Explicit label | `Multiple repositories` |

**Parsing rules:**
1. If the value is `Multiple repositories` (non-specific) → treat as single repo using current directory, skip to Step 3.
2. Split on ` + ` first. If that yields only one segment, split on `,`.
3. For each segment, trim whitespace.
4. Extract the **repo name** as the text before the first `(` — trim it.
5. Extract the **role description** from inside `(…)` — trim it. If absent: role = `primary` for the first entry, `secondary` for all others.

**Step 2 — Resolve local paths:**

Run `Get-Location` to get the current working directory (`<cwd>`).

For each repo in the parsed list:

a. If the folder name of `<cwd>` matches the repo name (case-insensitive; treat `-` and `_` as equivalent) → `localPath = <cwd>`.

b. Otherwise check if a **sibling directory** exists (i.e. `<parent of cwd>\<repo-name>`). If found, ask the user:
   > "Found `<repo-name>` at `<sibling-path>`. Is this the correct local clone?"
   > Choices: `Yes, use this path`, `No — I'll specify the path`

c. If not found as sibling → ask the user freeform:
   > "Where is the local clone of **`<repo-name>`**? Please provide the full path."
   Then verify the path exists before accepting it.

**Step 3 — Display and confirm the Repo Plan:**

Build and display the Repo Plan table:

```
📋 Repo Plan:
  1. <repo-name-1>  →  <localPath-1>  [<role-1>]
  2. <repo-name-2>  →  <localPath-2>  [<role-2>]
```

If the plan has **more than one repo**, ask the user:
> "This ticket spans multiple repositories as shown above. Does the Repo Plan look correct?"
> Choices: `Yes, proceed`, `No — let me correct it`

If single-repo, no confirmation is needed — proceed silently.

> The **Repo Plan** (list of `{name, role, localPath}`) is now the authoritative source used for all subsequent phases.

---

### Phase 2 — Branch Creation (model: gpt-4.1)

Determine the branch **prefix** from the ticket type:

| Ticket Type | Parent Type | Prefix |
|---|---|---|
| Bug | — | `bugfix` |
| PBI / User Story / Feature | — | `feature` |
| Task | Bug | `bugfix` |
| Task | PBI / User Story / Feature | `feature` |

Normalize the title to English: **if the ticket title is in German or any other language, translate it to English first**. Then lowercase, replace spaces and special characters (including umlauts ä→ae, ö→oe, ü→ue, ß→ss) with hyphens, max 50 chars.

**Branch name** (identical across all repos): `<prefix>/<ticket-number>-<normalized-title>`
Example: `feature/4821-add-order-import-for-amp`

**For each repo in the Repo Plan** (run sequentially):
1. `cd` to `localPath`
2. If not already fetched (i.e. not the repo from Phase 1b), run `git fetch origin main`
3. Use the `/common-git-workflow` skill: `git checkout -b <branch-name> origin/main`

---

### Phase 3 — Tech Stack Detection & Delegation (model: gpt-4.1)

#### 3a — Detect all stacks per repo

For **each repo** in the Repo Plan, run from its `localPath`:

| Check | Command | Stack |
|---|---|---|
| .NET | `Get-ChildItem -Recurse -Filter "*.csproj" -ErrorAction SilentlyContinue \| Select-Object -First 1` | .NET |
| Angular | `Get-ChildItem -Recurse -Filter "angular.json" -ErrorAction SilentlyContinue \| Select-Object -First 1` | Angular |

If no signal is found for a repo: default to .NET for that repo.

#### 3b — Cross-reference with ticket scope

If a repo has **more than one stack detected**, inspect the ticket description and acceptance criteria to narrow down which stacks are actually needed:

| Ticket signals | Keep |
|---|---|
| Only backend/API concerns (e.g. "update service", "fix endpoint") | .NET only |
| Only UI/frontend concerns (e.g. "update component", "fix display") | Angular only |
| Both concerns mentioned, or unclear | All detected stacks |

Build the **Dispatch List**: `[{ repo, localPath, stack, specialist }]`

**Routing table:**

| Stack | Specialist Agent |
|---|---|
| .NET | `development-dotnet-engineer` |
| Angular | _(not yet available — log warning, skip)_ |

#### 3c — Invoke specialists

For each entry in the Dispatch List, invoke the specialist sequentially, passing:

```
Ticket: #<TICKET_NUMBER> | Type: <type> | Title: <title>
Description: <description>
Acceptance Criteria: <acceptance_criteria>
Repro Steps: <repro_steps>  (include only for bugs)
Planning 2 Clarifications: <PLANNING2_CLARIFICATIONS>  (omit block if N/A)
Repo Plan: <repo_plan as JSON or table>
Branch: <branch_name>  (already checked out in all repos)
ADO Org: <org_url>
ADO Project: <project_name>
Active stack for this invocation: <stack>
```

> If a single repo has **multiple specialists** to run (e.g. both .NET and Angular detected), run them **sequentially** in that repo — they operate on the same working directory, so order matters.

**Wait for ALL specialists across ALL repos and ALL stacks to complete before proceeding to Phase 4.**

---

### Phase 4 — Commit (model: gpt-4.1)

For each repo in the Repo Plan (sequentially):
1. `cd` to `localPath`
2. Use the `/common-git-workflow` skill:
   - `git add -A`
   - Commit message: `#<TICKET_NUMBER> <TITLE>`
   - For multi-repo tickets, include the repo scope in the description line: `[<repo-name>] <change summary>`
   - **Commit message MUST be in English.** Translate title if needed.

---

### Phase 5 — Push & Pull Request (model: gpt-4.1)

For each repo in the Repo Plan (sequentially):
1. Use the `/common-git-workflow` skill to push: `git push --set-upstream origin <branch-name>`
2. Invoke the `common-azuredevops-pull-request` agent with:
   - Ticket number: `<TICKET_NUMBER>`, title: `<title>`, description: `<description>`, acceptance criteria: `<acceptance_criteria>`
   - Branch name: `<branch-name>`
   - Summary of changes for **this specific repo** (from the specialist agent's return)
   - Current working directory: `<localPath>`

---

## Output to User

After Phase 5, report a section **per repo**, then a combined summary:

```
=== <repo-name> [<role>] ===
✅ Branch:    <branch-name>
✅ Renovate:  <N> branches merged, <N> PRs closed  (if opted in)
✅ Packages:  <N> updated, <N> pinned/skipped      (if opted in)
✅ Tests:     <N> UnitTest tests passing
✅ SSDLC:     Clean — <N> violations fixed
✅ Commit:    <commit message>
✅ PR:        #<pr-id> <pr-title>  →  <pr-url>

=== Summary ===
🔗 Linked:    AB#<ticket-number>
📝 Repos:     <N> repositories updated
⚠️  Follow-up: <migrations, config, deployment notes — omit if none>
```

For **single-repo tickets**, use the flat format (omit the repo header section).

---

## Rules

- Never skip phases — if Phase 1a or 1b fails, halt and report the error clearly.
- If the ticket is a Task, always resolve the parent work item type before deciding the branch prefix.
- Summarize each completed phase before starting the next.
- **The branch name is identical across all repos** — same prefix, same ticket number, same normalized title.
- **For multi-repo tickets, the specialist agent completes ALL repos before Phase 4 starts** — do not interleave.
- Do not push or create a PR unless the specialist agent has returned successfully.
