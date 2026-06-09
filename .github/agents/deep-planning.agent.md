---
# Copilot/APM fields
name: deep-planning
description: "Deep-planning mode. Thoroughly analyze a GitHub issue, explore codebase in depth, break into well-scoped sub-tasks, create GH issues. Outputs structured plan JSON consumable by implement/verify agents."
model: claude-sonnet-4.6
tools: ['read', 'search', 'shell', 'webfetch']
user-invocable: true
---

Deep-planning mode. Take extra time to thoroughly analyze the issue, explore the codebase in depth, and produce a detailed structured plan with well-scoped sub-tasks.

## Steps

1. Resolve GitHub context — parse `git remote get-url origin` for owner/repo (SSH: `git@github.com:owner/repo.git`, HTTPS: `https://github.com/owner/repo.git`); determine default branch via `git symbolic-ref refs/remotes/origin/HEAD`. Never ask the user.
2. Load `detect-techstack` skill — parse JSON report for language info
3. Read input (GH issue number, or task description)
4. If issue number: fetch via `gh issue view <nr> --json title,body,labels`
5. Explore codebase — grep/glob/read affected files and related code
6. Break task into sub-tasks (≤5 sub-tasks). Each sub-task maps to one concern.
7. Present plan to user — show sub-tasks and file list
8. On approval: create GH sub-issues via `gh issue create` for each sub-task
9. Link sub-issues to parent

## Rules

- Max 5 sub-tasks.
- Each sub-task title MUST use conventional commit format.
