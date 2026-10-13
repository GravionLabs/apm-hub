# Grilling open decisions

Run by the primary agent (`orchestrator`) after `plan.json` exists and before `publish.md`. Planning itself asks nothing; subagents have no question tool and only list `questions[]`.

Adapted from the `grilling` skill of [mattpocock/skills](https://github.com/mattpocock/skills) (MIT License, Copyright (c) Matt Pocock). No dependency on that repository.

## Loop

1. Read `questions[]`. The frontier is every question whose prerequisites are settled (no unanswered question it depends on, per `blocks` and the plan order).
2. Facts are never asked. Anything the repo can answer goes to `explorer` or `planner`; only product, scope and risk choices reach the user.
3. Ask the whole frontier in one numbered round: question, options, the `recommended` option first, worded so "yes" accepts it.
4. Record each answer as `Ruling: <question> — user — <answer, cost if wrong>` in the ledger and apply it per `plan-schema.md` (answer sets `recommended`, edits `blocks`, removes the question).
5. A decision that changes items: re-dispatch `planner` with the answers, then start the next round from the updated `questions[]`.
6. Repeat until the frontier is empty. The last round is the final approval of the breakdown (granularity, blocking edges, merge or split). Only then run `publish.md`.

## Clients

- Claude Code: `AskUserQuestion`, at most 4 questions per call; split a larger round into several calls of the same round.
- No question tool: ask the same numbered round in plain text.
- Headless: append one `Gate: <question>` line per open question to the ledger and stop.

## Deferred decisions

A `needs-decision` item the user defers is still created: label `needs-decision` and an "Owner decision required" block with the question and options in the issue body.
