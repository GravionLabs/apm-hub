---
name: issue-planning
description: >
  Analyze a GitHub issue or task description, explore the codebase, break the
  work into well-scoped sub-tasks, and create GitHub sub-issues. Supports
  quick, standard, and deep planning depth. Outputs a structured plan JSON
  consumable by implement/verify workflows. Use when asked to "plan issue #N",
  "break this down", or before implementing a large task.
---

Plan phase. Analyze task, explore codebase, produce a structured plan and GH sub-issues.

## Depth

Pick from the request ("quick plan", "deep planning") or default to **standard**.

| Depth    | Exploration                              | Max sub-tasks |
|----------|-------------------------------------------|---------------|
| quick    | Limit to ~5 key files                     | 3             |
| standard | Grep/glob/read affected and related code  | 5             |
| deep     | Standard + trace call sites, tests, docs of every affected area | 5 |

## Steps

1. Resolve GitHub context — parse `git remote get-url origin` for owner/repo (SSH: `git@github.com:owner/repo.git`, HTTPS: `https://github.com/owner/repo.git`); determine default branch via `git symbolic-ref refs/remotes/origin/HEAD`. Never ask the user.
2. Load `detect-techstack` skill — parse JSON report for language info
3. Read input (GH issue number, or task description)
4. If issue number: fetch via `gh issue view <nr> --json title,body,labels`
5. Explore codebase per the chosen depth
6. Break task into sub-tasks (respect the depth's max). Each sub-task:
   - Maps to one concern (function, module, component)
   - Has clear scope boundaries
   - Can be implemented independently
7. **Present plan to user** — show sub-tasks and file list, wait for approval
8. On approval: create GH sub-issues via `gh issue create` for each sub-task. Make the **first body line** the human-readable parent reference matching the parent's type — `Parent Epic: #<nr>`, `Parent Feature: #<nr>`, or `Parent PBI: #<nr>`
9. Link each new issue to its parent as a **native GitHub sub-issue**. The body line is documentation; this is the actual link:
   ```bash
   parent_id=$(gh issue view <parent-nr> --json id --jq .id)
   child_id=$(gh issue view <child-nr> --json id --jq .id)
   gh api graphql -f query='
     mutation($parentId: ID!, $childId: ID!) {
       addSubIssue(input: { issueId: $parentId, subIssueId: $childId }) { issue { number } }
     }' -f parentId="$parent_id" -f childId="$child_id"
   ```
10. Verify before reporting success: `gh api repos/{owner}/{repo}/issues/<parent-nr>/sub_issues --jq '.[].number'`
    must list every number in `issues`. A created-but-unlinked issue looks completely normal in
    `gh issue list`, so this check is the only thing that catches it.

## Output (JSON only)

```json
{
  "phase": "plan",
  "status": "ok",
  "parent_issue": <number>,
  "issues": [42, 43, 44],
  "tasks": [
    {
      "issue": 42,
      "title": "feat: add auth middleware",
      "summary": "≤120 chars",
      "files": ["src/auth/middleware.ts"],
      "skills": ["ts-implementation"]
    }
  ],
  "summary": "≤120 chars caveman summary"
}
```

This schema is the contract consumed by the `orch-pipeline` and `github-issue` skills.

## Rules

- If the work needs more sub-tasks than the depth allows, group into phases.
- Link all sub-issues to their parent as native GitHub sub-issues, and verify the links landed. Never use a markdown checklist for this — it is a second source of truth that silently drifts.
- Each sub-task title MUST use conventional commit format.
- Sub-task bodies must be implementable without re-exploring the codebase: name the exact files and symbols to touch, where the tests go, and what is explicitly out of scope. These issues are often handed to a cheaper model than the one planning.
- Report the first sub-task to implement next in `summary`.
