# Retro categories

Adapted from mattpocock/skills `skills/engineering/retro/SKILL.md` (MIT), commit 49dd158d1076134a641b33efb035946536778336 (default branch HEAD when fetched; the upstream file was not pinned to an older revision). Categories 7-9 are ours.

Goal: improve the agent **environment**, not the code under review. Rank candidates by severity (cost or rework caused). Each candidate cites evidence: a transcript turn, a review finding or a metric.

1. **Navigation** - did the agent take long to find the right files? Hidden dependencies between files? A navigation pointer (one line in `AGENTS.md` to a doc) fixes it. Use when exploration dominated the run.
2. **Automated checks** - could lint, types, tests or a filesystem check have caught a mistake? Read the repo's own check command and CI first: an existing check that is unwired or broken is the finding. A repo with no guardrail (no hook, no CI job) is itself a finding. Mechanical mistakes (fixed pattern, banned API, import shape, file location) get a deterministic check, never a prose rule.
3. **Review rules** - the reviewer failed to catch something: add or clarify a rule in the `<lang>-implementation` `## Review rules`. Classify first: mechanical -> category 2; judgement call (cross-file consistency, surrounding style) -> a review rule. The reviewer has the least context pressure and enforces standards; the implementer should not carry them.
4. **AGENTS.md / steering size** - steering files are pushed into every context. Keep them for navigation pointers; move standards to review rules or checks. Flag a large file in the repo or the global scope.
5. **No-op instructions** - lines that do not change agent behaviour (the agent already does it, or it is unverifiable). Candidates for deletion.
6. **Tool economy** - expensive tool calls that could be streamlined (whole-file reads, noisy CLI output, token-heavy MCP tools). Check request counts and the largest tool results.
7. **Information access** - a crucial fact was unavailable (dev-server logs, read-only access to a third-party service, an issue field). Propose access, not instructions.
8. **Model per role** - compare cost per role with its outcome. An expensive role that produced rework may need a stronger model; a role that only reads may need a cheaper one. Cite the `Escalation:` lines of the report (one per escalated task) as evidence.
9. **Context growth across issues** - compare main-thread peak context between issues in one session. Growth means the run was not cleared or the orchestrator kept detail; propose `/clear` points or tighter phase summaries (see `docs/working-mode.md`).
10. **Rulings that should have been gates** - every `Ruling:` line is a decision the agent made alone. Flag rulings with real risk or cost of being wrong, and rulings repeated across runs; each becomes a gate or a rule.

## Metric reading

- Fix rounds above 1 per PBI: review rules or task briefs were too thin (categories 2, 3).
- Many rulings, few gates: category 10.
- `costEstimated` uses a price table in the script; treat it as +-30 % (Opus 4.5+ $5/$25, Sonnet $3/$15, Haiku $1/$5 per MTok; unknown models count 0). `costMeasured` is present only when the transcript records `costUSD`.
