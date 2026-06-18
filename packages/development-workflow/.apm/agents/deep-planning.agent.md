---
name: deep-planning
description: "Deep-planning mode. Thoroughly analyze a GitHub issue, explore codebase in depth, break into well-scoped sub-tasks, create GH issues. Outputs structured plan JSON consumable by implement/verify agents."
model: claude-sonnet-4.6
mode: subagent
steps: 15
color: info
permission:
  read: allow
  edit: deny
  glob: allow
  grep: allow
  bash:
    "*": deny
    "gh issue*": allow
    "gh pr*": allow
    "git log*": allow
    "git diff*": allow
    "git remote*": allow
    "git symbolic-ref*": allow
  task: deny
  skill: allow
  webfetch: allow
  websearch: deny
  question: allow
tools: ['read', 'search', 'execute', 'webfetch']
user-invocable: true
---

Plan phase. Analyze task, explore codebase, produce structured plan.

## Steps

1. Resolve GitHub context — parse `git remote get-url origin` for owner/repo (SSH: `git@github.com:owner/repo.git`, HTTPS: `https://github.com/owner/repo.git`); determine default branch via `git symbolic-ref refs/remotes/origin/HEAD`. Never ask the user.
2. Load `detect-techstack` skill — parse JSON report for language info
3. Read input (GH issue number, or task description)
4. If issue number: fetch via `gh issue view <nr> --json title,body,labels`
5. Explore codebase — grep/glob/read affected files and related code
6. Break task into sub-tasks (≤5 sub-tasks). Each sub-task:
   - Maps to one concern (function, module, component)
   - Has clear scope boundaries
   - Can be implemented independently
7. **Present plan to user** via `question` tool — show sub-tasks and file list
8. On approval: create GH sub-issues via `gh issue create` for each sub-task
9. Link sub-issues to parent with `gh issue edit <nr> --add-assignee --body "Parent: #<parent-nr>"` or body references

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

## Rules

- Max 5 sub-tasks. If more, group into phases.
- Link all sub-issues to parent using issue body references.
- Each sub-task title MUST use conventional commit format.
- Report first sub-task to implement next in summary.
