---
name: gh-issue-work
description: 'Full end-to-end workflow for working on a GitHub issue: create branch, implement code with tests and docs, review, and create a pull request. Use this for simple issues that can be completed in one pass.'
---

# Work on Issue (Full Workflow)

Complete end-to-end workflow for a GitHub issue: prepare, implement, and create a PR.

> **Tip:** For complex issues, use the individual skills instead:
> 1. `/gh-issue-implement {issue-number}` — prepare branch, plan, and implement
> 2. `/gh-issue-finish {issue-number}` — review and create PR

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- Current directory is the repository root

## Phase 1 — Prepare

Follow all steps from `/gh-issue-implement` Phase 1:
1. Read the issue (`gh issue view {issue-number} --json title,body,labels`)
2. Determine branch type from labels
3. Create and check out the branch (`feature/{issue-number}-{title}`)
4. Output an implementation plan

## Phase 2 — Implement

Follow all steps from `/gh-issue-implement` Phase 2:
1. Analyze the codebase for relevant files and patterns
2. Implement all required changes
3. Write tests for every changed behavior
4. Update documentation if needed
5. Create atomic commits (`feat: ... (refs #{issue-number})`)
6. Push the branch

## Phase 3 — Review and PR

Follow all steps from `/gh-issue-finish`:
1. Run build and tests — fix any failures
2. Review all changes (diff, correctness, edge cases, security)
3. Create the pull request with `Closes #{issue-number}` in the body

## Output

End with:
```
✅ Pull request created: <PR URL>

Branch: {branch-name}
Closes: #{issue-number}
```
