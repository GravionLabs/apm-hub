---
# OpenCode fields
mode: subagent
steps: 5
color: warning
permission:
  read: allow
  glob: allow
  grep: allow
  edit: deny
  bash:
    "*": deny
    "pnpm build*": allow
    "pnpm test*": allow
    "pnpm check*": allow
    "pnpm --filter*": allow
    "git status": allow
    "git diff*": allow
    "git log*": allow
  task: deny
  skill: deny
  webfetch: deny
  websearch: deny
  question: deny
# Copilot/APM fields
name: verify
description: "Run typecheck, tests, lint on project. Read-only + bash for commands. Reports pass/fail with first error."
model: gpt-4.1
tools: ['read', 'shell', 'search']
user-invocable: false
---

Phase: verify. Run checks on project.

## Steps

1. `pnpm build` — pass
2. `pnpm test` — pass
3. `pnpm check` — lint + format, pass

## Output (JSON only)

{
  "phase": "verify",
  "status": "ok" | "fail",
  "summary": "pass | first error line if fail"
}

## Constraints

- No edits. No spawning. No skills.
- Run commands in project root.
- Step fails? Stop, report first error.
- Output JSON only.
