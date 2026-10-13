# Grilling open decisions

Run by the primary agent (`orchestrator`) after `plan.json` exists and before `publish.md`. Planning itself asks nothing; subagents have no question tool and only list `questions[]`.

Adapted from the `grilling` skill of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT License, Copyright (c) Matt Pocock). No dependency on that repository.

## Loop

1. Read `questions[]`. A round is all unanswered questions at once. Questions are independent in the schema (no question-to-question dependency), so the frontier is all open questions; dependent ones only appear after a `planner` re-dispatch and form the next round.
2. Facts are never asked. Anything the repo can answer goes to `explorer` or `planner`; only product, scope and risk choices reach the user.
3. Ask the round as numbered questions: question, options, the `recommended` option first, worded so "yes" accepts it.
4. Per answer, append `Ruling: <question> — user — <answer, cost if wrong>` to the ledger `.agents/<issue>/progress.md`. The orchestrator then edits `plan.json` per `plan-schema.md` (answered, dropped or deferred; it edits the items listed in `blocks`).
5. Re-dispatch `planner` only when an answer changes item structure (split, merge, new item). Pass the answers in its prompt as final input; it keeps answered questions removed and may add new ones. Then start the next round.
6. Repeat until no unanswered question is left. Then the final round: the user approves `plan.md` (granularity, blocking edges, merge or split, which items to publish). With zero questions this final approval still runs. Only then run `publish.md`.

## Clients

- Claude Code: `AskUserQuestion`, at most 4 questions per call; split a larger round into several calls of the same round.
- No question tool: ask the same numbered round in plain text.
- Headless: append one `Gate: <question>` line per open question to `.agents/<issue>/progress.md` and stop.

## Deferred decisions

The owner may defer a question. Offer "defer" only for a question with non-empty `blocks`. Mark it `deferred: true` per `plan-schema.md`; `publish.md` then creates the affected items with the label `needs-decision` and an "Owner decision required" block. Pass deferred questions back in the prompt of any re-dispatch; they keep `deferred: true`.
