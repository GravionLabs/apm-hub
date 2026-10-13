---
name: review-fanout
description: 'Parallel multi-dimension review of a diff; returns APPROVE or CHANGES_REQUESTED. Use for "review my changes" or "review PR #N".'
---

Read-only: never edit or commit.

## Steps

1. **Input** — write ONE package file instead of pasting the diff: `.agents/<issue>/review-<n>.diff` (else a unique file in `$TMPDIR`) with `git log --oneline <base>..<head>`, `git diff --stat <base>..<head>` and `git diff -U10 <base>..<head>`; no range given → `git diff HEAD`. PR: `gh pr view <nr> --json commits,files` + `gh pr diff <nr>` (`<nr>` must be an integer). Redirect into the file so nothing enters your context. Empty diff → stop. Before any dispatch (step 2 and step 4) check the package file exists and is non-empty; otherwise stop, report `incomplete: true` and dispatch nothing. Drop binary/generated files. Optional issue number (argument, branch `<type>/<nr>-<slug>`, or `Closes #n` in the range): append issue title, body and Task sub-issue bodies to the package file, see `references/spec-dimension.md`; none found → `spec` reports "no spec available" as advisory.
2. **Fan out** — first classify (local range or working tree only; PR number without a resolvable local `<base>..<head>` is always `full`, do not run it): `pwsh -NoProfile -File scripts/Classify-Diff.ps1 -Range "<base>..<head>"` with refs validated by git, returns `{mode,dimensions,reason}`. Run only the returned `dimensions`; any script error or doubt is `full`. Rules: `references/mechanical-classifier.md`. The caller forces `full` with `-Force full` (argument `--full`). Then load `detect-techstack`. Spawn one fresh `reviewer` agent per dimension of the chosen mode in a single parallel batch (a generic read-only sub-agent when `reviewer` is not installed), each given only the package path, the dimension and its brief:
   - `correctness`: bugs, edge cases, error handling, races
   - `security`: injection, authz, secrets, unsafe input (always when auth/crypto/network/SQL files changed)
   - `conventions`: the `code-review` skill (it loads each language's `## Review rules`; stack skill not installed → one advisory finding "install `<stack>@apm-hub`")
   - `tests`: missing or weak tests; tests coupled to internals, tautological assertions (expected value recomputed like the code), missing behavior tests (rules: `implementation` skill, `references/test-quality.md`)
   - `spec`: issue criteria missing, partial or wrong, and scope creep; brief and severities in `references/spec-dimension.md`

   Each returns `[{file,line,severity: CRITICAL|HIGH|MEDIUM|LOW,evidence,issue}]`. A finding with empty or missing `file` or a `line` below 1 is invalid, never advisory: drop it and mark its dimension failed. Advisories without a natural location (`spec` "no spec available", `conventions` "install `<stack>@apm-hub`") use the placeholder `file` = the package path, `line` = 1. A reply `[]` plus a `NO_PACKAGE:` line also marks the dimension failed.
   Claude: `Agent` calls with `subagent_type: reviewer` in one message · OpenCode: parallel `task()` with agent `reviewer` · VS Code Copilot: `#runSubagent` with agent `reviewer` · otherwise run inline sequentially.
3. **Dedupe** by file + normalized evidence; keep highest severity. Never merge `spec` with `conventions` findings.
4. **Verify** — a sub-agent (given the package path, not the diff) tries to disprove each CRITICAL/HIGH finding: `confirmed`, `refuted` (→ advisory), `unverifiable` (stays blocking).

## Output (JSON only; also write `.orch/<slug>/review.json` during an orch run)

`{"mode":"mechanical|full","dimensions":[],"verdict":"APPROVE|CHANGES_REQUESTED","incomplete":false,"failedDimensions":[],"blocking":[{file,line,severity,issue,evidence}],"advisory":[]}`

Fail closed: a failed dimension (including invalid findings or `NO_PACKAGE`) → `incomplete: true` and `CHANGES_REQUESTED`. Any blocking finding → `CHANGES_REQUESTED`.
