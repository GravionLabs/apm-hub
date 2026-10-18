# Roadmap

Order of work and release assignment for the open issues. Created 2026-10-18, last release `v2.3.0` (2026-10-16). Each release has a GitHub milestone of the same name. Work runs one PBI at a time on `release/next` (several PBIs edit `orchestrator.agent.md` or the ledger hook).

## 2.4.0 — Feature runs and hardening (`release/next`, already contains #250 #253 #307 #309 #338 #339 #350 #354 #357 #358 #363)

| Order | Issue | Title | Size | Note |
| --- | --- | --- | --- | --- |
| 1 | #375 | loop-mode ledger lines before the PBI branch exists | S | before #389: same hook file |
| 2 | #367 | git-guardrails scanner quadratic on bash 3.2 | S | independent |
| 3 | #252 | `github-release` refuses an already released branch | S | protects this very release; do before cutting |
| 4 | #251 | model policy, opus in `plan.json`, escalation at fix round 2 | M | `needs-decision`: decide first, otherwise it moves to 2.5.0 |

Closing: Feature #248 and Epic #300 once #251 is merged. Then `github-release` finish.

## 2.5.0 — Epic #384: format changed sources

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #383 | format changed sources as a fixed implementer step | M | — |
| 2 | #386 | per-project override in `.agents/format.json` | S | #383 |

Feature #385 closes with #386.

## 2.6.0 — Epic #387, Feature #388: agent-bus MVP

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #389 | `SubagentStop` hook sends `progress` to `$AGENT_BUS_URL/ingest` | M | #375; `POST /ingest` in `GravionLabs/agent-bus` |

Opt-in through `AGENT_BUS_URL`; without it nothing changes.

## 2.7.0 — Feature #390: attention, queue, usage, `/bus-mux`

| Order | Issue | Title | Size | Depends on |
| --- | --- | --- | --- | --- |
| 1 | #391 | `pbi-runner` `GATE|BLOCKED|FAILED` as `attention` | S | #389 |
| 2 | #392 | queue runner reports `queue.item`, supports `-Mux` | M | #389 |
| 3 | #393 | status line reports `usage` | S | #389 |
| 4 | #394 | user-invoked `/bus-mux` skill in `delivery` | M | #392, bus-mux released |

Epic #387 closes with #394.

## 3.0.0 — breaking

| Issue | Title | Depends on |
| --- | --- | --- |
| #280 | remove `orch-pipeline`, `/orch` prompt and `.orch/` mentions | everything above released in 2.x |

## Risks

- 2.6.0 and 2.7.0 depend on the agent-bus repository (ingest endpoint, bus-mux); if it lags, those releases shift, nothing else does.
- 2.5.0 and 2.6.0 can swap without harm; 2.4.0 comes first because it is nearly done.
