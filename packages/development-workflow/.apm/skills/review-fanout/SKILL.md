---
name: review-fanout
description: 'Parallel multi-dimension review of a diff with dedupe and adversarial verification; returns APPROVE or CHANGES_REQUESTED. Use for "review my changes" or "review PR #N".'
---

Read-only: never edit or commit.

## Steps

1. **Input** — local: `git diff HEAD` + `git diff --name-only HEAD`; PR: `gh pr diff <nr>` + `gh pr view <nr> --json files` (`<nr>` must be an integer). Empty diff → stop. Drop binary/generated files.
2. **Fan out** — load `detect-techstack`. Spawn one fresh `reviewer` agent per dimension in a single parallel batch (a generic read-only sub-agent when `reviewer` is not installed), each given only the diff, the dimension and its brief:
   - `correctness`: bugs, edge cases, error handling, races
   - `security`: injection, authz, secrets, unsafe input (always when auth/crypto/network/SQL files changed)
   - `conventions`: the `code-review` skill (it loads each language's `## Review rules`; stack skill not installed → one advisory finding "install `<stack>@apm-hub`")
   - `tests`: missing or weak tests

   Each returns `[{file,line,severity: CRITICAL|HIGH|MEDIUM|LOW,evidence,issue}]`.
   Claude: `Agent` calls with `subagent_type: reviewer` in one message · OpenCode: parallel `task()` with agent `reviewer` · VS Code Copilot: `#runSubagent` with agent `reviewer` · otherwise run inline sequentially.
3. **Dedupe** by file + normalized evidence; keep highest severity.
4. **Verify** — a sub-agent tries to disprove each CRITICAL/HIGH finding: `confirmed`, `refuted` (→ advisory), `unverifiable` (stays blocking).

## Output (JSON only; also write `.orch/<slug>/review.json` during an orch run)

`{"verdict":"APPROVE|CHANGES_REQUESTED","incomplete":false,"failedDimensions":[],"blocking":[{file,line,severity,issue,evidence}],"advisory":[]}`

Fail closed: a failed dimension → `incomplete: true` and `CHANGES_REQUESTED`. Any blocking finding → `CHANGES_REQUESTED`.
