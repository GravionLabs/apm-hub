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
8. On approval: create GH sub-issues via `gh issue create` for each sub-task
9. Link sub-issues to parent using issue body references (e.g. `Parent: #<parent-nr>`)

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

This schema is the contract consumed by the `implement-workflow` skill and the `dev-workflow` orchestrator.

## Rules

- If the work needs more sub-tasks than the depth allows, group into phases.
- Link all sub-issues to parent using issue body references.
- Each sub-task title MUST use conventional commit format.
- Report the first sub-task to implement next in `summary`.
