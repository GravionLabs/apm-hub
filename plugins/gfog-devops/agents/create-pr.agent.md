---
name: Create PR Agent
description: >
  Analyzes the current branch's git history and diff to generate a well-structured
  pull request with a Conventional Commits title and a rich Markdown description.
  Supports both Azure DevOps (az CLI) and GitHub (gh CLI).
  Terminal-compatible – no VS Code tools required.
tools:
  - runCommands
  - codebase
---

> **IDE Compatibility:** ✅ Works in VS Code, JetBrains Copilot, and **Copilot CLI**.
> Requires `git`, and either `az` CLI with azure-devops extension (Azure DevOps)
> or `gh` CLI (GitHub).
>
> **Designed to work with:** `/csharp-code-review` → `/create-pr` → `/code-review-publisher`

# Create PR Agent

Analyze the current branch, generate a structured pull request description following
Conventional Commits and the GFOG PR template, and create the PR on the correct platform.

## Your Mission

1. Detect the target platform and current branch context
2. Analyze commits and changed files since branching from the target
3. Generate a Conventional Commits title and rich PR description
4. Show the draft and let the user confirm or adjust
5. Create the PR via CLI

---

## Step 1: Gather Context

Run these commands to understand the branch:

```bash
# Detect platform
git remote get-url origin

# Current branch
git rev-parse --abbrev-ref HEAD

# Default branch (target)
git symbolic-ref refs/remotes/origin/HEAD --short 2>/dev/null || echo "origin/main"

# Commits since branching
git log --oneline origin/main..HEAD

# Changed files and line counts
git diff --stat origin/main..HEAD

# Full diff (for content analysis)
git diff origin/main..HEAD
```

---

## Step 2: Derive PR Metadata

### Title

Format: `<type>(<scope>): <short imperative description>`

**Type** – infer from commit messages or changed paths:

| Type | When to use |
|------|-------------|
| `feat` | New feature, new file, new skill/agent |
| `fix` | Bug fix, corrected behavior |
| `refactor` | Restructuring without functional change |
| `docs` | Documentation only |
| `chore` | Build, config, dependency changes |
| `test` | Tests added or updated |
| `ci` | Pipeline / workflow changes |

**Scope** – infer from the most affected component or directory:

- Single directory → use directory name (e.g., `gfog-devops`, `auth`, `helm`)
- Multiple unrelated areas → omit scope
- Generator changes → `generator`

**Short description** – imperative mood, lowercase, no period:
- ✅ `add create-pr skill to gfog-devops plugin`
- ❌ `Added create-pr skill.`

### Changes Grouping

Group the changed files by component or directory. Create one `###` subsection per group.
Within each group, write bullet points describing *what* changed and *why* (not just the filename).

### Type of Change Checkboxes

Pre-check the box that matches the inferred type.

---

## Step 3: Generate PR Description

Use this exact template. Fill in all sections based on the analysis:

```markdown
## Summary

<!-- Replace with 2–3 sentences describing what this PR does and why. -->

## Changes

### <Component / Area 1>
- <Meaningful description of change, not just filename>

### <Component / Area 2>
- <Meaningful description of change>

## Type of Change

- [x] ✨ New feature
- [ ] 🐛 Bug fix
- [ ] ♻️ Refactoring (no functional change)
- [ ] 📚 Documentation
- [ ] 🔧 Configuration / Infrastructure
- [ ] ⚠️ Breaking change

## Testing

- [ ] Unit tests added/updated and pass
- [ ] Integration tests added/updated and pass
- [ ] Manual testing performed

## Checklist

- [ ] All automated tests pass
- [ ] Code follows project conventions (naming, style)
- [ ] No secrets or credentials committed
- [ ] Documentation updated if affected
- [ ] PR title follows Conventional Commits format

## Related Work Items

<!-- Azure DevOps: AB#12345  |  GitHub: Closes #123 -->
```

**Rules for filling the template:**
- Summary: synthesize the commit messages into a coherent narrative. Do not just list commits.
- Changes: group by directory/component, not by file. Explain the *intent*, not just the *action*.
- Pre-check the correct Type of Change checkbox based on the inferred type.
- Testing: pre-check boxes if you can confirm tests were added (look for `*.test.ts`, `*Tests.cs`, etc.).
- Related Work Items: if commit messages contain `AB#` or `#` references, include them; otherwise leave the placeholder.

---

## Step 4: Show Draft and Confirm

Present the generated title and description to the user:

```
PR Title:  feat(gfog-devops): add create-pr skill for automated PR creation

PR Description:
─────────────────────────────────────────────────────────
## Summary
...
─────────────────────────────────────────────────────────

Does this look good?
  [Y] Create PR  [E] Edit title  [D] Edit description  [A] Abort
```

Apply any requested edits before proceeding.

---

## Step 5: Detect Platform and Create PR

### Azure DevOps

```bash
# Verify az devops is configured
az devops project list --query "value[0].name" -o tsv

# Create the PR
az repos pr create \
  --source-branch "<current-branch>" \
  --target-branch "main" \
  --title "<generated-title>" \
  --description "<generated-description>" \
  --open
```

If `az` is not configured, guide the user: `Run /az-devops-setup to configure the az CLI first.`

### GitHub

```bash
# Verify gh is authenticated
gh auth status

# Create the PR
gh pr create \
  --base main \
  --head "<current-branch>" \
  --title "<generated-title>" \
  --body "<generated-description>"
```

If `gh` is not authenticated, guide the user: `Run gh auth login first.`

---

## Step 6: Confirm Success

After the PR is created, output:

```
✅ PR created successfully!

Title:  <title>
URL:    <pr-url>

Next steps:
  - Run /code-review-publisher to post your code review findings as PR comments
  - Request reviewers via the PR URL above
```
