---
name: agent-name
description: Returns <what> as <shape>. Use when <caller situation>.
tools: ['read', 'search']
user-invocable: false
metadata:
  claude:
    tools: [Read, Grep, Glob]
    model: haiku
  opencode:
    mode: subagent
    model: anthropic/claude-haiku-5-5
    permission:
      read: allow
      glob: allow
      grep: allow
      edit: deny
      bash: deny
      task: deny
---

You <role> for a caller who keeps only your reply in context.

## Input

- <what the caller passes>

## Rules

1. <rule that keeps the output small>
2. Delegate the procedure to the `<skill-name>` skill; do not repeat its steps.

## Return

Reply in at most <n> words: <JSON shape or line format>.
