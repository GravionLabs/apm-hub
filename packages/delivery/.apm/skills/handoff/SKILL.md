---
name: handoff
description: 'Write a hand-off document for the next session: state per issue, open gates, ordered next steps, suggested skills. Use for "handoff" before /clear on multi-issue or multi-repo work.'
disable-model-invocation: true
metadata:
  opencode/autoinvoke: 'false'
---

Write a hand-off document so a fresh session continues the work without this conversation. Adapted from mattpocock/skills `skills/productivity/handoff/SKILL.md` (MIT), commit 0f5e033ebc47b142f5ffa56a582ede6d9d9bada3. Differences: output goes into the `<state>` directory (`state_dir` of `detect-techstack`), and the document has a fixed template.

## Input

Arguments describe what the next session will focus on (`handoff finish the API migration in repo B`). Use them to choose which issues, gates and steps to detail and which to reduce to one line. An argument is the output path only if it is a single token ending in `.md`; everything else is the focus.

## Steps

1. **Collect state from sources, not memory.** `git status`, `git log --oneline -10`, open PRs (`gh pr list`), the issues involved (`gh issue view <nr>`), ledgers `<state>/<issue>/progress.md`, memory notes. Per repo for multi-repo work.
2. **Fill `templates/handoff.md`** (relative to the skill directory). Sections: goal, state per issue, open gates and decisions, next steps, suggested skills and agents, gotchas. Drop an empty section instead of writing "none".
3. **Link, do not copy.** Reference issues, PRs, commits, plans, ADRs and ledgers by URL or path. One line of state per issue; never paste issue bodies, diffs or commit messages.
4. **Make next steps executable.** Ordered, one exact command per step (`claude --agent orchestrator "next <nr>"`, `git switch <branch>`), working directory named when it is not the repo root.
5. **Name the decider** of every open gate or decision (user, reviewer, an issue owner) and where the question is recorded (`Gate:` line in the ledger, issue comment).
6. **Redact** API keys, tokens, passwords, connection strings and personal data. Refer to where a secret lives (`.env`, a vault name), never its value.
7. **Save** to `<state>/handoff-<YYYY-MM-DD>.md` (a second handoff the same day gets `-2`), or to the path argument. Create the directory if needed.
8. **Reply** with the path and at most 3 lines: the focus, the first next step, the open gate count. Remind the user to `/clear` and start the next session with `Read <path> and continue`.

## Rules

- Do not commit the file, do not edit issues or the ledger.
- Facts you did not verify in this step (a test result from memory) are marked `unverified`.
- The document stays under about 60 lines; if longer, link more and describe less.
