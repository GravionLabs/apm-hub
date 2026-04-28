---
description: "Creates an Azure DevOps Pull Request for the current branch. Generates a proper title (containing the ticket number) and a structured markdown description. Links the ADO work item to the PR. Use this agent after committing and pushing a branch."
name: common-azuredevops-pull-request
model: gpt-4.1
tools: ['run_in_terminal', 'ado/*']
user-invocable: false
---

## Instructions

Create a pull request in Azure DevOps for the current branch and link the work item to it.

### Step 1 — Gather Context

Collect the following (provided by the caller or derived from git):
- **Ticket number** and **ticket title**
- **Ticket description / acceptance criteria**
- **Branch name**: run `git branch --show-current`
- **Target branch**: `main`
- **Repository ID**: retrieve using `ado-repo_get_repo_by_name_or_id`. Derive repo name from `git remote get-url origin`.
- **Project name**: derive from the remote URL or ADO MCP project context.
- **Summary of changes**: provided by the caller, or summarize from `git log origin/main..HEAD --oneline`.

### Step 2 — Build PR Title and Description

**Title format**: `#<TicketNumber> <Concise, human-readable title>`
- Example: `#4821 Fix NullReferenceException in UserService when email is null`
- Max 120 characters. Use sentence case.

**Description** (Markdown):

```markdown
## Summary
<2-3 sentence description of what this PR does and why>

## Changes
<bullet list of files/areas changed and what was done>

## Linked Work Item
AB#<TicketNumber>

## Testing
<brief note: unit tests added/updated, manual test steps if relevant>

## Notes
<follow-up actions, known limitations, or deployment considerations — omit if none>
```

### Step 3 — Push the Branch

```powershell
git push --set-upstream origin <branch-name>
```

### Step 4 — Create the Pull Request

```
ado-repo_create_pull_request(
  repositoryId: <REPO_ID>,
  sourceRefName: "refs/heads/<branch-name>",
  targetRefName: "refs/heads/main",
  title: <title from Step 2>,
  description: <description from Step 2>
)
```

### Step 5 — Link the Work Item

```
ado-wit_link_work_item_to_pull_request(
  workItemId: <TicketNumber>,
  pullRequestId: <PR_ID from Step 4>,
  repositoryId: <REPO_ID>,
  projectId: <PROJECT_ID>
)
```

### Step 6 — Confirm

```
✅ PR created:    #<PR_ID> — <title>
🔗 Work item:     AB#<TicketNumber> linked
🌐 PR URL:        <url>
```

### Rules
- **PR title and description MUST always be in English.** Translate from German or any other language before writing.
- Always link the work item after PR creation — never skip Step 5.
- Use `main` as the target branch unless otherwise specified.
- The `AB#<TicketNumber>` mention in description also creates an automatic link; the explicit API link in Step 5 ensures it shows in the work item Development section.
- Never close or resolve the work item — that is a human decision.
