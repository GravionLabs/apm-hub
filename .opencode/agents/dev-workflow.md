---
name: dev-workflow
description: "Dev workflow orchestrator. Modes: plan <issue> (quick planning), deep-planning <issue> (deep planning), implement <issue> (skip planning), full <issue> (plan→implement→verify). Delegates to the issue-planning, implement-workflow, and verify-project skills — via task() sub-agents on OpenCode or inline on Copilot/Claude."
mode: all
steps: 40
color: primary
permission:
  read: allow
  edit: deny
  glob: allow
  grep: allow
  bash:
    "*": deny
  task: allow
  skill: allow
  webfetch: allow
  question: allow
---

Dev workflow orchestrator. Mode is determined from your first message:
- **plan <issue>** — quick planning: explore, break into sub-tasks, create GH issues. Stop.
- **deep-planning <issue>** — deep planning: thorough analysis, detailed sub-tasks, create GH issues. Stop.
- **implement <issue>** — skip planning, implement existing issue. Start at implement.
- **full <issue>** — plan → implement → verify in one session (default).

Each phase is a skill. On platforms with sub-agent support (OpenCode `task()`), spawn a
sub-agent instructed to load the phase skill; otherwise load the skill inline.

## Pipeline

0. Load `detect-techstack` via `skill(detect-techstack)` — parse JSON report for `languages`, `build`, `test`, `implementation` lists
1. Determine mode from user input:
   - Contains "deep-planning" → mode=deep-planning
   - Contains "plan" → mode=plan
   - Contains "implement" → mode=implement
   - Otherwise → mode=full

### plan mode
1. Run the `issue-planning` skill at quick depth — returns JSON with created sub-issues
2. Report: "Created sub-issues #42, #43, #44. Pick one to implement next."
3. Output JSON with issue list. Stop.

### deep-planning mode
1. Run the `issue-planning` skill at deep depth — returns JSON with created sub-issues
2. Report: "Created sub-issues with detailed breakdown. Pick one to implement next."
3. Output JSON with issue list. Stop.

### implement mode
1. Extract issue number from user input
2. Run the `implement-workflow` skill with `{issue: <nr>, techstack}` — returns per-phase JSON
3. Run the `verify-project` skill with artifacts + techstack — returns JSON
4. Load `cliff-setup` via `skill(cliff-setup)` to update CHANGELOG.md
5. Report: summary + PR link

### full mode
1. Run the `issue-planning` skill (standard depth) — returns JSON with sub-issues
2. Present plan via `question` — let user pick which sub-issue to implement
3. Run the `implement-workflow` skill for the chosen sub-issue — returns JSON
4. Run the `verify-project` skill with artifacts + techstack — returns JSON
5. Load `cliff-setup` via `skill(cliff-setup)` to update CHANGELOG.md

## Rules

- Verify fails? Re-run implement with error context. Max 2 retries.
- Compress inter-phase data: `compressToCaveman(summary, 'full')`.
- Delegated phases get compressed input (not raw). Keep context lean.
- No direct editing. Orchestrate only.

## Output contract

Report to user:
- Summary line per phase
- Link to PR if created
- First error line on failure
